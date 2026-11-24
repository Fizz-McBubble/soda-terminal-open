import {
  createBrowserVisualAssetRuntime,
  visualAssetCachePrefix,
} from './visualAssetBrowserRuntime'
import { isPersonalCacheableVisualAsset } from './visualAssetCacheLookup'
import { throwIfAborted, waitForAbortable } from './visualAssetCacheRuntimeSupport'
import { visualAssetManifest } from './visualAssetManifestView'
import { automaticVisualAssetCacheName, downloadVisualAsset } from './visualAssetSharedDownload'
import type { VisualAsset } from './visualAssetSchemas'

let visibleDownloads: AbortController | null = null

export function enableVisibleCatalogDownloads() {
  visibleDownloads ??= new AbortController()
}

export function stopVisibleCatalogDownloads() {
  visibleDownloads?.abort()
  visibleDownloads = null
}

export async function loadVisibleCatalogImage(asset: VisualAsset) {
  const signal = visibleDownloads?.signal
  if (!signal || navigator.onLine === false || !isPersonalCacheableVisualAsset(asset)) return null

  const runtime = createBrowserVisualAssetRuntime()
  const cacheName = automaticVisualAssetCacheName(visualAssetCachePrefix, visualAssetManifest)
  const save = async (response: Response) => {
    const cache = await waitForAbortable(runtime.cacheStorage.open(cacheName), signal)
    throwIfAborted(signal)
    await waitForAbortable(cache.put(asset.remoteUrl, response), signal)
    throwIfAborted(signal)
    const state = runtime.getState()
    if (state.automaticCache !== cacheName && state.activeCache !== cacheName) {
      runtime.setState({
        ...state,
        automaticCache: cacheName,
        previousAutomaticCache: state.automaticCache ?? state.previousAutomaticCache,
      })
    }
  }
  const download = downloadVisualAsset(asset, runtime, cacheName, save, signal, true)
  const response = await waitForAbortable(download.image, signal)
  const blob = await waitForAbortable(response.clone().blob(), signal)
  return blob
}
