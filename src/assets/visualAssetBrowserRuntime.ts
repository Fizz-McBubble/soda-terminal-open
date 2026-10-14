// Build-time binding: public builds resolve the generated display projection, desktop builds the
// internal manifest. One implementation, one import, no runtime branching and no top-level await.
import { type VisualAsset, type VisualAssetEntityType } from './visualAssetSchemas'

export type VisualAssetPackState = {
  /** Verified automatic downloads, including successful entries from a partial run. */
  automaticCache?: string | null
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
  failed?: number
}

/** Optional offline source used by a fully prevalidated personal cache pack. */
export type VisualAssetInstallOptions = {
  reuseCached?: boolean
  responseForAsset?: (asset: VisualAsset & { remoteUrl: string }) => Promise<Response>
}

export type VisualAssetCacheRuntime = {
  cacheStorage: Pick<CacheStorage, 'open' | 'delete'>
  fetcher: typeof fetch
  getState: () => VisualAssetPackState
  setState: (state: VisualAssetPackState) => void
  digest: (bytes: ArrayBuffer) => Promise<string>
  now: () => string
}

export const stateStorageKey = 'soda-terminal:visual-assets:state:v1'

export function readBrowserState(): VisualAssetPackState {
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

export async function sha256(bytes: ArrayBuffer) {
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
