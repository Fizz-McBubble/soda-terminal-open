import type {
  VisualAssetCacheRuntime,
  VisualAssetInstallOptions,
  VisualAssetInstallProgress,
  VisualAssetPackState,
} from './visualAssetBrowserRuntime'
import {
  fetchOfficialVisualAsset,
  findVerifiedCachedAsset,
  getCacheableVisualAssets,
  openActiveVisualAssetCaches,
} from './visualAssetCacheLookup'
import {
  classifyAbortSignal,
  isQuotaExceededError,
  runBoundedConcurrentTasks,
  takeFetchedResponseBytes,
  throwIfAborted,
  waitForAbortable,
} from './visualAssetCacheRuntimeSupport'
import { visualAssetManifestSchema, type VisualAssetManifest } from './visualAssetSchemas'
import { visualAssetDownloadOrder } from './visualAssetDownloadOrder'

export type VisualAssetSyncResult = {
  installed: number
  total: number
  failed: number
  cacheName: string
  cancelled?: boolean
  quotaExceeded?: boolean
  timedOut?: boolean
}

/** Fill the complete personal cache without discarding successful entries on an unrelated failure.
 * Offline personal-pack imports retain their separate all-or-nothing installation contract. */
export async function synchronizeVisualAssetPackIntoCache(
  manifest: VisualAssetManifest,
  runtime: VisualAssetCacheRuntime,
  onProgress: ((progress: VisualAssetInstallProgress) => void) | undefined,
  options: VisualAssetInstallOptions,
  cachePrefix: string,
  invalidateVisualAssetPackVerification: () => void,
): Promise<VisualAssetSyncResult> {
  const parsed = visualAssetManifestSchema.parse(manifest)
  const assets = getCacheableVisualAssets(parsed, 'all')
  const cacheName = `${cachePrefix}:automatic:${parsed.packVersion}:${parsed.contentHash.slice(-12)}`
  let completed = 0
  let failed = 0
  let quotaExceeded = false
  let stopRequested = false

  const internalController = new AbortController()
  let packTimer: ReturnType<typeof setTimeout> | undefined
  if (options.packTimeoutMs && options.packTimeoutMs > 0) {
    packTimer = setTimeout(() => {
      internalController.abort(new DOMException('素材同步超时（包截止期已到）', 'TimeoutError'))
    }, options.packTimeoutMs)
  }

  const onUserAbort = () => {
    internalController.abort(
      options.signal?.reason ?? new DOMException('用户取消素材下载', 'AbortError'),
    )
  }
  if (options.signal) {
    if (options.signal.aborted) {
      onUserAbort()
    } else {
      options.signal.addEventListener('abort', onUserAbort, { once: true })
    }
  }

  const signal = internalController.signal
  let previousState: VisualAssetPackState | undefined
  try {
    const cache = await waitForAbortable(runtime.cacheStorage.open(cacheName), signal)
    previousState = runtime.getState()
    const activeCaches = await waitForAbortable(
      openActiveVisualAssetCaches(previousState, runtime),
      signal,
    )
    throwIfAborted(signal)
    // The pointer makes verified partial entries visible without asserting full readiness.
    runtime.setState({ ...previousState, automaticCache: cacheName })
    await runBoundedConcurrentTasks(
      visualAssetDownloadOrder(assets),
      3,
      async (asset) => {
        if (signal.aborted) return
        try {
          const cached = await waitForAbortable(
            findVerifiedCachedAsset(asset, runtime.getState(), runtime, activeCaches),
            signal,
          )
          throwIfAborted(signal)
          const response =
            cached ??
            (options.responseForAsset
              ? await waitForAbortable(
                  Promise.resolve().then(() => options.responseForAsset!(asset)),
                  signal,
                )
              : await fetchOfficialVisualAsset(asset, runtime, { signal }))
          throwIfAborted(signal)
          if (!response) throw new Error(`${asset.name} 未返回可用图片`)
          if (!cached) {
            const bytes =
              takeFetchedResponseBytes(response) ??
              (await waitForAbortable(response.clone().arrayBuffer(), signal))
            throwIfAborted(signal)
            const actualHash = await waitForAbortable(runtime.digest(bytes), signal)
            throwIfAborted(signal)
            if (actualHash !== asset.contentHash) throw new Error(`${asset.name} 内容哈希不一致`)
          }
          const existing = await waitForAbortable(cache.match(asset.remoteUrl), signal)
          const existingBytes = existing
            ? await waitForAbortable(existing.clone().arrayBuffer(), signal)
            : null
          throwIfAborted(signal)
          const existingHash = existingBytes
            ? await waitForAbortable(runtime.digest(existingBytes), signal)
            : null
          throwIfAborted(signal)
          if (!existing || existingHash !== asset.contentHash) {
            await waitForAbortable(cache.put(asset.remoteUrl, response.clone()), signal)
            throwIfAborted(signal)
          }
        } catch (error) {
          if (isQuotaExceededError(error)) {
            quotaExceeded = true
            stopRequested = true
            return
          }
          if (classifyAbortSignal(signal)) return
          failed += 1
          onProgress?.({ completed, total: assets.length, failed, asset })
          return
        }
        completed += 1
        onProgress?.({ completed, total: assets.length, failed, asset })
      },
      signal,
      () => stopRequested,
    )
  } catch (error) {
    if (isQuotaExceededError(error)) {
      quotaExceeded = true
      stopRequested = true
    } else if (!signal.aborted) throw error
  } finally {
    if (packTimer) clearTimeout(packTimer)
    if (options.signal) options.signal.removeEventListener('abort', onUserAbort)
  }

  const abortKind = quotaExceeded ? null : classifyAbortSignal(signal)
  const cancelled = abortKind === 'cancelled'
  const timedOut = abortKind === 'timeout'

  if (failed === 0 && !cancelled && !quotaExceeded && !timedOut && previousState) {
    throwIfAborted(signal)
    const currentState = runtime.getState()
    runtime.setState({
      ...currentState,
      automaticCache: null,
      activeCache: cacheName,
      previousCache:
        previousState.activeCache !== cacheName
          ? previousState.activeCache
          : previousState.previousCache,
      installedAt: runtime.now(),
      packVersion: parsed.packVersion,
      catalogProfile: 'r6-purpose-variants-v2',
      activeCaches: {
        ...currentState.activeCaches,
        ...Object.fromEntries(assets.map((asset) => [asset.entityType, cacheName])),
      },
      previousCaches: {
        ...currentState.previousCaches,
        ...Object.fromEntries(
          assets.map((asset) => [asset.entityType, previousState.activeCaches?.[asset.entityType]]),
        ),
      },
    })
  }
  invalidateVisualAssetPackVerification()
  return {
    installed: completed,
    total: assets.length,
    failed: Math.max(0, assets.length - completed),
    cacheName,
    cancelled,
    quotaExceeded,
    timedOut,
  }
}
