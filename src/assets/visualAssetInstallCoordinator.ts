import {
  synchronizeVisualAssetPack,
  removePersonalVisualAssetCaches,
  isVisualAssetPackCached,
  getVisualAssetPackState,
  officialCatalogEntityTypes,
  visualAssetManifest,
  invalidateVisualAssetPackVerification,
} from './visualAssets'
import { getCacheableVisualAssets } from './visualAssetCacheLookup'
import { throwIfAborted, waitForAbortable } from './visualAssetCacheRuntimeSupport'
import {
  enableVisibleCatalogDownloads,
  stopVisibleCatalogDownloads,
} from './visibleCatalogDownload'

let sharedInstall: Promise<void> | null = null
let sharedRemoval: Promise<void> | null = null
let activeInstallAbortController: AbortController | null = null
let readyStateKey: string | null = null
let sharedProgress = 0
let automaticLoadingSuppressed = false

function waitForCatalogWarmup(signal: AbortSignal) {
  if (typeof window.requestIdleCallback !== 'function') return
  let handle = 0
  const idle = new Promise<void>((resolve) => {
    handle = window.requestIdleCallback(() => resolve(), { timeout: 1500 })
  })
  return waitForAbortable(idle, signal).finally(() => window.cancelIdleCallback?.(handle))
}

export type OfficialCatalogInstallStatus = {
  kind: 'idle' | 'loading' | 'ready' | 'partial' | 'error'
  completed: number
  total: number
  failed: number
}
let sharedStatus: OfficialCatalogInstallStatus = {
  kind: 'idle',
  completed: 0,
  total: getCacheableVisualAssets(visualAssetManifest, 'all').length,
  failed: 0,
}
const progressListeners = new Set<(completed: number) => void>()
const statusListeners = new Set<(status: OfficialCatalogInstallStatus) => void>()

export function getOfficialCatalogInstallStatus() {
  return sharedStatus
}
export function subscribeOfficialCatalogInstallStatus(
  listener: (status: OfficialCatalogInstallStatus) => void,
) {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}
function publishStatus(status: OfficialCatalogInstallStatus) {
  sharedStatus = status
  sharedProgress = status.completed
  statusListeners.forEach((listener) => listener(status))
  progressListeners.forEach((listener) => listener(status.completed))
}

function currentCatalogStateKey() {
  const state = getVisualAssetPackState()
  return [
    state.packVersion ?? '',
    state.catalogProfile ?? '',
    state.activeCache ?? '',
    state.automaticCache ?? '',
    state.previousAutomaticCache ?? '',
    ...officialCatalogEntityTypes.map((entityType) => state.activeCaches?.[entityType] ?? ''),
  ].join('|')
}

export function getOfficialCatalogInstallProgress() {
  return sharedProgress
}

export function subscribeOfficialCatalogInstallProgress(listener: (completed: number) => void) {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

export function cancelOfficialCatalogInstall(): boolean {
  if (activeInstallAbortController) {
    automaticLoadingSuppressed = true
    stopVisibleCatalogDownloads()
    activeInstallAbortController.abort(new DOMException('已取消素材下载', 'AbortError'))
    return true
  }
  return false
}

export async function ensureOfficialCatalogInstalled(
  options: {
    verifyCache?: boolean
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
) {
  if (sharedRemoval) await sharedRemoval
  if (automaticLoadingSuppressed && !options.verifyCache) return
  if (options.verifyCache) automaticLoadingSuppressed = false
  enableVisibleCatalogDownloads()
  if (!options.verifyCache && readyStateKey && readyStateKey === currentCatalogStateKey()) return
  if (sharedInstall) return sharedInstall

  const controller = new AbortController()
  activeInstallAbortController = controller
  const deadline = setTimeout(() => {
    controller.abort(
      new DOMException('素材加载超时，已保留成功图片；请稍后点击“补齐图片”重试。', 'TimeoutError'),
    )
  }, options.timeoutMs ?? 60_000)

  const onExternalAbort = () => {
    stopVisibleCatalogDownloads()
    controller.abort(options.signal?.reason ?? new DOMException('用户取消素材下载', 'AbortError'))
  }
  if (options.signal) {
    if (options.signal.aborted) {
      onExternalAbort()
    } else {
      options.signal.addEventListener('abort', onExternalAbort, { once: true })
    }
  }

  sharedInstall = (async () => {
    publishStatus({ kind: 'loading', completed: 0, total: sharedStatus.total, failed: 0 })
    throwIfAborted(controller.signal)
    if (!options.verifyCache && options.timeoutMs === undefined) {
      const idle = waitForCatalogWarmup(controller.signal)
      if (idle) await idle
    }
    if (options.verifyCache) invalidateVisualAssetPackVerification()
    if (
      await waitForAbortable(
        isVisualAssetPackCached(visualAssetManifest, undefined, 'all'),
        controller.signal,
      )
    ) {
      throwIfAborted(controller.signal)
      readyStateKey = currentCatalogStateKey()
      publishStatus({
        kind: 'ready',
        completed: sharedStatus.total,
        total: sharedStatus.total,
        failed: 0,
      })
      // A verified retry can repair a mounted image even when the cache pointer is unchanged.
      if (options.verifyCache) window.dispatchEvent(new Event('soda-visual-assets-ready'))
      return
    }
    const result = await synchronizeVisualAssetPack(
      visualAssetManifest,
      undefined,
      ({ completed, total, failed = 0 }) => {
        publishStatus({ kind: 'loading', completed, total, failed })
        // Make verified partial results usable during the run without refreshing every image
        // for every individual object. This event never starts a network download.
        if (completed === 1 || completed % 10 === 0)
          window.dispatchEvent(new Event('soda-visual-assets-progress'))
      },
      {
        signal: controller.signal,
        packTimeoutMs: options.timeoutMs ?? 60_000,
      },
    )
    window.dispatchEvent(
      new Event(options.verifyCache ? 'soda-visual-assets-ready' : 'soda-visual-assets-progress'),
    )

    if (result.quotaExceeded) {
      readyStateKey = null
      automaticLoadingSuppressed = true
      publishStatus({
        kind: result.installed ? 'partial' : 'error',
        completed: result.installed,
        total: result.total,
        failed: result.failed,
      })
      throw new DOMException(
        `${result.failed} 张图片未能缓存（存储空间不足），已保留成功图片；请清理空间后点击“补齐图片”重试。`,
        'QuotaExceededError',
      )
    }

    if (result.timedOut) {
      readyStateKey = null
      automaticLoadingSuppressed = true
      publishStatus({
        kind: result.installed ? 'partial' : 'error',
        completed: result.installed,
        total: result.total,
        failed: result.failed,
      })
      throw new DOMException(
        `素材加载超时，已保留 ${result.installed} 张成功图片；请稍后点击“补齐图片”重试。`,
        'TimeoutError',
      )
    }

    if (result.cancelled) {
      readyStateKey = null
      automaticLoadingSuppressed = true
      publishStatus({
        kind: result.installed ? 'partial' : 'idle',
        completed: result.installed,
        total: result.total,
        failed: result.failed,
      })
      throw new DOMException(
        `已取消素材下载，已保留 ${result.installed} 张成功图片；可随时继续下载。`,
        'AbortError',
      )
    }

    if (result.failed) {
      readyStateKey = null
      publishStatus({
        kind: result.installed ? 'partial' : 'error',
        completed: result.installed,
        total: result.total,
        failed: result.failed,
      })
      throw new Error(`${result.failed} 张图片未加载，已保留成功缓存；可以继续使用并稍后补齐。`)
    }
    readyStateKey = currentCatalogStateKey()
    publishStatus({ kind: 'ready', completed: result.total, total: result.total, failed: 0 })
  })()
    .catch((error: unknown) => {
      if (controller.signal.aborted) {
        automaticLoadingSuppressed = true
        readyStateKey = null
        invalidateVisualAssetPackVerification()
      }
      if (sharedStatus.kind === 'loading') {
        if (error instanceof DOMException && error.name === 'AbortError') {
          publishStatus({
            ...sharedStatus,
            kind: sharedStatus.completed > 0 ? 'partial' : 'idle',
          })
        } else {
          publishStatus({ ...sharedStatus, kind: 'error' })
        }
      }
      throw error
    })
    .finally(() => {
      clearTimeout(deadline)
      if (options.signal) options.signal.removeEventListener('abort', onExternalAbort)
      activeInstallAbortController = null
      sharedInstall = null
    })
  return sharedInstall
}

export async function removeOfficialCatalogImages() {
  if (sharedInstall) throw new Error('图片正在下载，请完成后再删除。')
  if (sharedRemoval) return sharedRemoval
  // A failed removal can still have deleted part of the cache. Its previous
  // verification must not survive, and deletion must not trigger auto-download.
  readyStateKey = null
  automaticLoadingSuppressed = true
  stopVisibleCatalogDownloads()
  invalidateVisualAssetPackVerification()
  sharedRemoval = removePersonalVisualAssetCaches()
    .then(() => undefined)
    .finally(() => {
      publishStatus({ kind: 'idle', completed: 0, total: sharedStatus.total, failed: 0 })
      sharedRemoval = null
      window.dispatchEvent(new Event('soda-visual-assets-ready'))
    })
  return sharedRemoval
}
