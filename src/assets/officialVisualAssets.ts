import displayProjection from './visual-assets-display.v1.json'
import { isOfficialCacheableAsset, resolveDefaultVisualAsset } from './visualAssetIndexSupport'
import { visualAssetManifestSchema } from './visualAssetSchemas'

/**
 * Availability facts that the calculation worker also needs. It deliberately reads the generated
 * display projection with a synchronously parsed manifest: workers are bundled in a format without
 * top-level await, and the projection carries the same identity and policy facts as the internal
 * manifest (verified by the catalog gate and the display parity test).
 */
const displayAssets = visualAssetManifestSchema.parse(displayProjection).assets

export function isOfficialWEngineAvailable(entityId: string) {
  return isOfficialCacheableAsset(resolveDefaultVisualAsset(displayAssets, 'wengine', entityId))
}
