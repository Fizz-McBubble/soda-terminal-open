import {
  installVisualAssetPack,
  removePersonalVisualAssetCaches,
  isCatalogVisualAsset,
  isVisualAssetPackCached,
  getVisualAssetPackState,
  officialCatalogEntityTypes,
  visualAssetManifest,
} from './visualAssets'

let sharedInstall: Promise<void> | null = null
let sharedRemoval: Promise<void> | null = null
let readyStateKey: string | null = null
let sharedProgress = 0
const progressListeners = new Set<(completed: number) => void>()

function currentCatalogStateKey() {
  const state = getVisualAssetPackState()
  return [
    state.packVersion ?? '',
    state.catalogProfile ?? '',
    state.activeCache ?? '',
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
  if (!options.verifyCache && readyStateKey && readyStateKey === currentCatalogStateKey()) return
  if (sharedInstall) return sharedInstall
  sharedInstall = (async () => {
    if (await isVisualAssetPackCached()) {
      readyStateKey = currentCatalogStateKey()
      // A verified retry can repair a mounted image even when the cache pointer is unchanged.
      if (options.verifyCache) window.dispatchEvent(new Event('soda-visual-assets-ready'))
      return
    }
    sharedProgress = 0
    const install = installVisualAssetPack(
      visualAssetManifest,
      undefined,
      ({ completed }) => {
        sharedProgress = completed
        progressListeners.forEach((listener) => listener(completed))
      },
      'catalog',
    )
      .catch(async (error) => {
        // Keep one bad upstream object from blanking every catalog domain. Each
        // domain still activates atomically and only after its own hashes pass.
        let recoveredDomains = 0
        for (const entityType of officialCatalogEntityTypes) {
          const assets = visualAssetManifest.assets.filter(
            (asset) => asset.entityType === entityType && isCatalogVisualAsset(asset),
          )
          try {
            await installVisualAssetPack(
              { ...visualAssetManifest, assets },
              undefined,
              undefined,
              'catalog',
            )
            recoveredDomains += 1
          } catch {
            // Preserve the previous pointer for this domain and continue the
            // independent recovery attempts for the remaining domains.
          }
        }
        window.dispatchEvent(new Event('soda-visual-assets-ready'))
        if (recoveredDomains > 0 && (await isVisualAssetPackCached())) return
        throw error
      })
      .then(() => {
        readyStateKey = currentCatalogStateKey()
        window.dispatchEvent(new Event('soda-visual-assets-ready'))
      })
    await install
  })().finally(() => {
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
      sharedProgress = 0
      window.dispatchEvent(new Event('soda-visual-assets-ready'))
    })
    .finally(() => {
      sharedRemoval = null
    })
  return sharedRemoval
}
