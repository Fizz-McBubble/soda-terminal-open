import type { VisualAsset, VisualAssetManifest } from './visualAssetSchemas'
import type { VisualAssetCacheRuntime, VisualAssetPackState } from './visualAssets'
import { getOfficialVisualAssetDownloadUrl } from './visualAssetDownloadSupport'
import { isCatalogVisualAsset } from './visualAssetCatalogSupport'
import { fetchWithTimeout } from './visualAssetCacheRuntimeSupport'

const visualAssetFetchTimeoutMs = 15_000

export async function fetchOfficialVisualAsset(
  asset: VisualAsset & { remoteUrl: string },
  runtime: VisualAssetCacheRuntime,
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    let response: Response
    try {
      response = await fetchWithTimeout(
        runtime.fetcher,
        getOfficialVisualAssetDownloadUrl(asset),
        { credentials: 'omit' },
        visualAssetFetchTimeoutMs,
      )
    } catch (error) {
      lastError =
        error instanceof DOMException && error.name === 'AbortError'
          ? new Error(`${asset.name} 下载失败（请求超时）`)
          : error
      if (attempt === 5) throw lastError
      continue
    }
    const proxyError = response.headers.get('x-soda-asset-error')
    if (proxyError) {
      const upstreamStatus = response.headers.get('x-soda-upstream-status') ?? '502'
      lastError = new Error(`${asset.name} 下载失败（HTTP ${upstreamStatus}）`)
      if (attempt === 5) throw lastError
      continue
    }
    if (response.ok) return response
    lastError = new Error(`${asset.name} 下载失败（HTTP ${response.status}）`)
    if (response.status === 429 && attempt < 5) {
      const retryAfter = Number(response.headers.get('retry-after'))
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * attempt,
        ),
      )
      continue
    }
    if (response.status < 500 || attempt === 5) throw lastError
  }
  throw lastError
}

function getCacheNamesForAsset(
  asset: VisualAsset & { remoteUrl: string },
  state: VisualAssetPackState,
) {
  return [
    state.activeCaches?.[asset.entityType],
    asset.entityType === 'wengine' ? state.wEngineCache : null,
    state.activeCache,
  ].filter((cacheName): cacheName is string => Boolean(cacheName))
}

export async function openActiveVisualAssetCaches(
  state: VisualAssetPackState,
  runtime: VisualAssetCacheRuntime,
) {
  const cacheNames = new Set(
    [state.activeCache, state.wEngineCache, ...Object.values(state.activeCaches ?? {})].filter(
      (cacheName): cacheName is string => Boolean(cacheName),
    ),
  )
  return new Map(
    await Promise.all(
      [...cacheNames].map(
        async (cacheName) => [cacheName, await runtime.cacheStorage.open(cacheName)] as const,
      ),
    ),
  )
}

export async function findVerifiedCachedAsset(
  asset: VisualAsset & { remoteUrl: string },
  state: VisualAssetPackState,
  runtime: VisualAssetCacheRuntime,
  activeCaches?: ReadonlyMap<string, Cache>,
) {
  const cacheNames = getCacheNamesForAsset(asset, state)
  for (const cacheName of new Set(cacheNames)) {
    const cache = activeCaches?.get(cacheName) ?? (await runtime.cacheStorage.open(cacheName))
    if (typeof cache.match !== 'function') continue
    const response = await cache.match(asset.remoteUrl)
    if (!response) continue
    const actualHash = await runtime.digest(await response.clone().arrayBuffer())
    if (actualHash === asset.contentHash) return response
  }
  return null
}

export function getCacheableVisualAssets(manifest: VisualAssetManifest, scope: 'catalog' | 'all') {
  return manifest.assets
    .filter(
      (item): item is typeof item & { remoteUrl: string } =>
        item.status === 'verified' &&
        item.cachePolicy === 'explicit-personal-cache' &&
        Boolean(item.remoteUrl),
    )
    .filter((item) => scope === 'all' || isCatalogVisualAsset(item))
}
