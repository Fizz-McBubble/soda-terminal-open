import manifest from '../data/visual-assets.v1.json'
import { visualAssetInternalManifestSchema } from './visualAssetSchemas'

/**
 * Desktop/private binding of the one visual-asset manifest: identity, display facts and the
 * internal source, licence, attribution and review ledger. This entry keeps the strict structural
 * validation of the internal manifest; the public projection is the only shape that relaxes it.
 */
export default visualAssetInternalManifestSchema.parse(manifest)
