import {
  synchronizeVisualAssetPack,
  removePersonalVisualAssetCaches,
  isVisualAssetPackCached,
  getVisualAssetPackState,
  officialCatalogEntityTypes,
  visualAssetManifest,
} from './visualAssets'
import { getCacheableVisualAssets } from './visualAssetCacheLookup'

let sharedInstall: Promise<void> | null = null
let sharedRemoval: Promise<void> | null = null
let readyStateKey: string | null = null
let sharedProgress = 0
let automaticLoadingSuppressed = false
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

export async function ensureOfficialCatalogInstalled(options: { verifyCache?: boolean } = {}) {
  if (sharedRemoval) await sharedRemoval
  if (automaticLoadingSuppressed && !options.verifyCache) return
  if (options.verifyCache) automaticLoadingSuppressed = false
  if (!options.verifyCache && readyStateKey && readyStateKey === currentCatalogStateKey()) return
  if (sharedInstall) return sharedInstall
  sharedInstall = (async () => {
    publishStatus({ kind: 'loading', completed: 0, total: sharedStatus.total, failed: 0 })
    if (await isVisualAssetPackCached(visualAssetManifest, undefined, 'all')) {
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
    )
    window.dispatchEvent(new Event('soda-visual-assets-ready'))
    if (result.failed) {
      readyStateKey = null
      publishStatus({
        kind: result.installed ? 'partial' : 'error',
        completed: result.total,
        total: result.total,
        failed: result.failed,
      })
      throw new Error(`${result.failed} 张图片未加载，已保留成功缓存；可以继续使用并稍后补齐。`)
    }
    readyStateKey = currentCatalogStateKey()
    publishStatus({ kind: 'ready', completed: result.total, total: result.total, failed: 0 })
  })()
    .catch((error: unknown) => {
      if (sharedStatus.kind === 'loading') publishStatus({ ...sharedStatus, kind: 'error' })
      throw error
    })
    .finally(() => {
      sharedInstall = null
    })
  return sharedInstall
}

export async function removeOfficialCatalogImages() {
  if (sharedInstall) throw new Error('图片正在下载，请完成后再删除。')
  if (sharedRemoval) return sharedRemoval
  sharedRemoval = removePersonalVisualAssetCaches()
    .then(() => {
      readyStateKey = null
      automaticLoadingSuppressed = true
      publishStatus({ kind: 'idle', completed: 0, total: sharedStatus.total, failed: 0 })
      window.dispatchEvent(new Event('soda-visual-assets-ready'))
    })
    .finally(() => {
      sharedRemoval = null
    })
  return sharedRemoval
}
