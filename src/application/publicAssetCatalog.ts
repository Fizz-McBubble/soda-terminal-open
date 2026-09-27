import type { CatalogItem } from '../components/assets/r6/types'
import snapshot from './publicAssetCatalog.data.json'

/** Display-only current catalog. Its private source projection is checked in the paired test. */
export const publicAssetCatalog = {
  agents: snapshot.agents as CatalogItem[],
  wengines: snapshot.wengines as CatalogItem[],
  bangboos: snapshot.bangboos as CatalogItem[],
  driveDiscSets: snapshot.driveDiscSets as CatalogItem[],
}

export const publicAssetDiscSetById = new Map(
  publicAssetCatalog.driveDiscSets.map((entry) => [entry.stableId, entry]),
)
