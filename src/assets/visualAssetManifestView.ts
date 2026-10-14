import { type VisualAssetPackState } from './visualAssetBrowserRuntime'
// Build-time binding: public builds resolve the generated display projection, desktop builds the
// internal manifest. One implementation, one import, no runtime branching and no top-level await.
import manifestJson from '@soda/visual-asset-manifest'
import {
  getOfficialAgentFullBodyAssets,
  getOfficialCatalogAssets,
  getVisualAssetCoverage as getVisualAssetCoverageFor,
  isOfficialCatalogPackReady as isOfficialCatalogPackReadyFor,
} from './visualAssetCatalogSupport'
import {
  createVisualAssetIndex,
  isOfficialCacheableAsset,
  resolveDefaultVisualAsset,
} from './visualAssetIndexSupport'
import {
  visualAssetEntityTypeSchema,
  type VisualAssetEntityType,
  type VisualAssetManifest,
} from './visualAssetSchemas'

/** The build-time binding entry validates its own shape: strict for the internal manifest, the
 *  display subset for the public projection. */
export const visualAssetManifest: VisualAssetManifest = manifestJson
export const officialCatalogAssets = getOfficialCatalogAssets(visualAssetManifest.assets)
export const officialAgentFullBodyAssets = getOfficialAgentFullBodyAssets(
  visualAssetManifest.assets,
)

export const visualAssetIndex = createVisualAssetIndex(visualAssetManifest.assets)

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

export function getVisualAssetCoverage() {
  return getVisualAssetCoverageFor(visualAssetManifest.assets, visualAssetEntityTypeSchema.options)
}

export function isOfficialCatalogPackReady(state: VisualAssetPackState) {
  return isOfficialCatalogPackReadyFor(state, visualAssetManifest.packVersion)
}
