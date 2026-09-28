// Build-time binding: public builds resolve the generated display projection, desktop builds the
// internal manifest. One implementation, one import, no runtime branching and no top-level await.
import manifestJson from '@soda/visual-asset-manifest'
import {
  getOfficialAgentFullBodyAssets,
  getOfficialCatalogAssets,
  getVisualAssetCoverage as getVisualAssetCoverageFor,
  isCatalogVisualAsset,
  isOfficialCatalogPackReady as isOfficialCatalogPackReadyFor,
  officialCatalogEntityTypes,
} from './visualAssetCatalogSupport'
import {
  getOfficialVisualAssetDownloadUrl,
  getOfficialWEngineDownloadUrl,
} from './visualAssetDownloadSupport'
import {
  createVisualAssetIndex,
  isOfficialCacheableAsset,
  resolveDefaultVisualAsset,
} from './visualAssetIndexSupport'
import {
  createVisualAssetStagingCacheName,
  fetchWithTimeout,
  runBoundedConcurrentTasks,
  takeFetchedResponseBytes,
} from './visualAssetCacheRuntimeSupport'
import {
  visualAssetEntityTypeSchema,
  visualAssetManifestSchema,
  type VisualAsset,
  type VisualAssetManifest,
  type VisualAssetEntityType,
} from './visualAssetSchemas'
export {
  visualAssetEntityTypeSchema,
  visualAssetManifestSchema,
  type VisualAsset,
  type VisualAssetManifest,
  type VisualAssetEntityType,
} from './visualAssetSchemas'

/** The build-time binding entry validates its own shape: strict for the internal manifest, the
 *  display subset for the public projection. */
export const visualAssetManifest: VisualAssetManifest = manifestJson
export const officialCatalogAssets = getOfficialCatalogAssets(visualAssetManifest.assets)
export const officialAgentFullBodyAssets = getOfficialAgentFullBodyAssets(
  visualAssetManifest.assets,
)

const visualAssetIndex = createVisualAssetIndex(visualAssetManifest.assets)

export function getVisualAsset(
  entityType: VisualAssetEntityType,
  entityId: string,
  variant?: string,
) {
  return visualAssetIndex.get(`${entityType}:${entityId}:${variant ?? ''}`) ?? null
}

export function isOfficialWEngineAvailable(entityId: string) {
  return isOfficialCacheableAsset(
    resolveDefaultVisualAsset(visualAssetManifest.assets, 'wengine', entityId),
  )
}

export { isCatalogVisualAsset, officialCatalogEntityTypes }

export function getVisualAssetCoverage() {
  return getVisualAssetCoverageFor(visualAssetManifest.assets, visualAssetEntityTypeSchema.options)
}

export function isOfficialCatalogPackReady(state: VisualAssetPackState) {
  return isOfficialCatalogPackReadyFor(state, visualAssetManifest.packVersion)
}

export type VisualAssetPackState = {
  activeCache: string | null
  previousCache: string | null
  installedAt: string | null
  packVersion: string | null
  catalogProfile?: string | null
  wEngineCache: string | null
  previousWEngineCache: string | null
  wEngineInstalledAt: string | null
  wEnginePackVersion: string | null
  activeCaches?: Partial<Record<VisualAssetEntityType, string>>
  previousCaches?: Partial<Record<VisualAssetEntityType, string>>
}

export type VisualAssetInstallProgress = {
  completed: number
  total: number
  asset: VisualAsset
}

/** Optional offline source used by a fully prevalidated personal cache pack. */
export type VisualAssetInstallOptions = {
  reuseCached?: boolean
  responseForAsset?: (asset: VisualAsset & { remoteUrl: string }) => Promise<Response>
}

export { getVisualAssetInstallErrorMessage } from './visualAssetCacheRuntimeSupport'

export type VisualAssetCacheRuntime = {
  cacheStorage: Pick<CacheStorage, 'open' | 'delete'>
  fetcher: typeof fetch
  getState: () => VisualAssetPackState
  setState: (state: VisualAssetPackState) => void
  digest: (bytes: ArrayBuffer) => Promise<string>
  now: () => string
}

const stateStorageKey = 'soda-terminal:visual-assets:state:v1'
const cachePrefix = 'soda-terminal-visual-assets'
const visualAssetFetchTimeoutMs = 15_000
export { getOfficialVisualAssetDownloadUrl, getOfficialWEngineDownloadUrl }

function readBrowserState(): VisualAssetPackState {
  const fallback = {
    activeCache: null,
    previousCache: null,
    installedAt: null,
    packVersion: null,
    catalogProfile: null,
    wEngineCache: null,
    previousWEngineCache: null,
    wEngineInstalledAt: null,
    wEnginePackVersion: null,
    activeCaches: {},
    previousCaches: {},
  }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(stateStorageKey) ?? '{}') }
  } catch {
    return fallback
  }
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `sha256-${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export function createBrowserVisualAssetRuntime(): VisualAssetCacheRuntime {
  return {
    cacheStorage: caches,
    fetcher: (...args) => fetch(...args),
    getState: readBrowserState,
    setState: (state) => localStorage.setItem(stateStorageKey, JSON.stringify(state)),
    digest: sha256,
    now: () => new Date().toISOString(),
  }
}

async function fetchOfficialVisualAsset(
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

async function openActiveVisualAssetCaches(
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

async function findVerifiedCachedAsset(
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

function getCacheableVisualAssets(manifest: VisualAssetManifest, scope: 'catalog' | 'all') {
  return manifest.assets
    .filter(
      (item): item is typeof item & { remoteUrl: string } =>
        item.status === 'verified' &&
        item.cachePolicy === 'explicit-personal-cache' &&
        Boolean(item.remoteUrl),
    )
    .filter((item) => scope === 'all' || isCatalogVisualAsset(item))
}

/**
 * A pack pointer alone is not proof that its current manifest is usable. Old
 * browser state can survive a manifest update while the newly introduced files
 * were never written to Cache Storage. Verify the full shared catalog before
 * any page treats the visual system as ready.
 */
export async function isVisualAssetPackCached(
  manifest: VisualAssetManifest = visualAssetManifest,
  runtime: VisualAssetCacheRuntime = createBrowserVisualAssetRuntime(),
  scope: 'catalog' | 'all' = 'catalog',
) {
  const parsed = visualAssetManifestSchema.parse(manifest)
  const state = runtime.getState()
  if (!isOfficialCatalogPackReadyFor(state, parsed.packVersion)) return false
  const assets = getCacheableVisualAssets(parsed, scope)
  const activeCaches = await openActiveVisualAssetCaches(state, runtime)
  return (
    await Promise.all(
      assets.map((asset) => findVerifiedCachedAsset(asset, state, runtime, activeCaches)),
    )
  ).every(Boolean)
}

async function installAssetsIntoCache(
  assets: Array<VisualAsset & { remoteUrl: string }>,
  cache: Cache,
  previousState: VisualAssetPackState,
  runtime: VisualAssetCacheRuntime,
  onProgress?: (progress: VisualAssetInstallProgress) => void,
  options: VisualAssetInstallOptions = {},
) {
  const activeCaches = await openActiveVisualAssetCaches(previousState, runtime)
  let completed = 0
  await runBoundedConcurrentTasks(assets, 3, async (asset) => {
    const cached =
      options.reuseCached === false
        ? null
        : await findVerifiedCachedAsset(asset, previousState, runtime, activeCaches)
    const response =
      cached ??
      (options.responseForAsset
        ? await options.responseForAsset(asset)
        : await fetchOfficialVisualAsset(asset, runtime))
    if (!cached) {
      const actualHash = await runtime.digest(
        takeFetchedResponseBytes(response) ?? (await response.clone().arrayBuffer()),
      )
      if (actualHash !== asset.contentHash) throw new Error(`${asset.name} 内容哈希不一致`)
    }
    await cache.put(asset.remoteUrl, response.clone())
    completed += 1
    onProgress?.({ completed, total: assets.length, asset })
  })
}

export async function installVisualAssetPack(
  manifest: VisualAssetManifest = visualAssetManifest,
  runtime: VisualAssetCacheRuntime = createBrowserVisualAssetRuntime(),
  onProgress?: (progress: VisualAssetInstallProgress) => void,
  scope: 'catalog' | 'all' = 'catalog',
  options: VisualAssetInstallOptions = {},
) {
  const parsed = visualAssetManifestSchema.parse(manifest)
  const cacheName = createVisualAssetStagingCacheName(
    `${cachePrefix}:${parsed.packVersion}:${parsed.contentHash.slice(-12)}:${runtime.now().replace(/\D/g, '')}`,
  )
  const previousState = runtime.getState()
  const stagingCache = await runtime.cacheStorage.open(cacheName)
  const cacheableAssets = getCacheableVisualAssets(parsed, scope)

  try {
    await installAssetsIntoCache(
      cacheableAssets,
      stagingCache,
      previousState,
      runtime,
      onProgress,
      options,
    )
    runtime.setState({
      ...previousState,
      activeCache: cacheName,
      previousCache:
        previousState.activeCache && previousState.activeCache !== cacheName
          ? previousState.activeCache
          : previousState.previousCache,
      installedAt: runtime.now(),
      packVersion: parsed.packVersion,
      catalogProfile: 'r6-purpose-variants-v2',
      activeCaches: {
        ...previousState.activeCaches,
        ...Object.fromEntries(cacheableAssets.map((asset) => [asset.entityType, cacheName])),
      },
      previousCaches: {
        ...previousState.previousCaches,
        ...Object.fromEntries(
          cacheableAssets.map((asset) => [
            asset.entityType,
            previousState.activeCaches?.[asset.entityType] ??
              previousState.activeCache ??
              undefined,
          ]),
        ),
      },
    })
    return { installed: cacheableAssets.length, cacheName }
  } catch (error) {
    await runtime.cacheStorage.delete(cacheName)
    runtime.setState(previousState)
    throw error
  }
}

export async function installOfficialWEngineAssetPack(
  manifest: VisualAssetManifest = visualAssetManifest,
  runtime: VisualAssetCacheRuntime = createBrowserVisualAssetRuntime(),
  onProgress?: (progress: VisualAssetInstallProgress) => void,
) {
  const parsed = visualAssetManifestSchema.parse(manifest)
  const cacheName = createVisualAssetStagingCacheName(
    `${cachePrefix}:wengines:${parsed.packVersion}:${parsed.contentHash.slice(-12)}:${runtime.now().replace(/\D/g, '')}`,
  )
  const previousState = runtime.getState()
  const stagingCache = await runtime.cacheStorage.open(cacheName)
  const cacheableAssets = parsed.assets.filter(
    (item): item is typeof item & { remoteUrl: string } =>
      item.entityType === 'wengine' &&
      item.status === 'verified' &&
      item.sourceType === 'official' &&
      item.cachePolicy === 'explicit-personal-cache' &&
      Boolean(item.remoteUrl),
  )

  try {
    const activeCaches = await openActiveVisualAssetCaches(previousState, runtime)
    for (const [index, asset] of cacheableAssets.entries()) {
      const cached = await findVerifiedCachedAsset(asset, previousState, runtime, activeCaches)
      const response = cached ?? (await fetchOfficialVisualAsset(asset, runtime))
      if (!cached) {
        const actualHash = await runtime.digest(
          takeFetchedResponseBytes(response) ?? (await response.clone().arrayBuffer()),
        )
        if (actualHash !== asset.contentHash) throw new Error(`${asset.name} 内容哈希不一致`)
      }
      await stagingCache.put(asset.remoteUrl, response.clone())
      onProgress?.({ completed: index + 1, total: cacheableAssets.length, asset })
    }
    runtime.setState({
      ...previousState,
      wEngineCache: cacheName,
      previousWEngineCache:
        previousState.wEngineCache && previousState.wEngineCache !== cacheName
          ? previousState.wEngineCache
          : previousState.previousWEngineCache,
      wEngineInstalledAt: runtime.now(),
      wEnginePackVersion: parsed.packVersion,
      activeCaches: { ...previousState.activeCaches, wengine: cacheName },
      previousCaches: {
        ...previousState.previousCaches,
        wengine: previousState.activeCaches?.wengine ?? previousState.wEngineCache ?? undefined,
      },
    })
    return { installed: cacheableAssets.length, cacheName }
  } catch (error) {
    await runtime.cacheStorage.delete(cacheName)
    runtime.setState(previousState)
    throw error
  }
}

export async function rollbackVisualAssetPack(
  runtime: VisualAssetCacheRuntime = createBrowserVisualAssetRuntime(),
) {
  const state = runtime.getState()
  if (!state.previousCache) return false
  runtime.setState({
    ...state,
    activeCache: state.previousCache,
    previousCache: state.activeCache,
    installedAt: runtime.now(),
    activeCaches: Object.fromEntries(
      Object.entries(state.activeCaches ?? {}).map(([entityType, cacheName]) => {
        const typedEntityType = entityType as VisualAssetEntityType
        return [
          typedEntityType,
          cacheName === state.activeCache
            ? (state.previousCaches?.[typedEntityType] ?? state.previousCache)
            : cacheName,
        ]
      }),
    ),
  })
  return true
}

export async function rollbackOfficialWEngineAssetPack(
  runtime: VisualAssetCacheRuntime = createBrowserVisualAssetRuntime(),
) {
  const state = runtime.getState()
  if (!state.previousWEngineCache) return false
  runtime.setState({
    ...state,
    wEngineCache: state.previousWEngineCache,
    previousWEngineCache: state.wEngineCache,
    wEngineInstalledAt: runtime.now(),
    activeCaches: {
      ...state.activeCaches,
      wengine: state.previousCaches?.wengine ?? state.previousWEngineCache,
    },
    previousCaches: {
      ...state.previousCaches,
      wengine: state.activeCaches?.wengine ?? state.wEngineCache ?? undefined,
    },
  })
  return true
}

export function getVisualAssetPackState() {
  return readBrowserState()
}

export async function resolveCachedVisualAsset(asset: VisualAsset) {
  if (!asset.remoteUrl || !('caches' in window)) return null
  const state = readBrowserState()
  const cacheNames =
    asset.entityType === 'wengine'
      ? [state.activeCaches?.wengine, state.wEngineCache, state.activeCache]
      : [state.activeCaches?.[asset.entityType], state.activeCache]
  for (const cacheName of cacheNames) {
    if (!cacheName) continue
    const cache = await caches.open(cacheName)
    const response = await cache.match(asset.remoteUrl)
    if (response) return URL.createObjectURL(await response.blob())
  }
  return null
}

/** Deletes only Soda image caches, including obsolete and rollback image versions. */
export async function removePersonalVisualAssetCaches(
  cacheStorage: Pick<CacheStorage, 'keys' | 'delete'> = caches,
  clearState: () => void = () => localStorage.removeItem(stateStorageKey),
) {
  const names = (await cacheStorage.keys()).filter((name) => name.startsWith(`${cachePrefix}:`))
  for (const name of names) await cacheStorage.delete(name)
  clearState()
  return { deleted: names.length }
}
