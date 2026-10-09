import { current31ReviewedBangbooSourceAtoms } from './generated/current31-reviewed-bangboo-source-atoms'
import { stableContentHash } from './types'

/** Shared by exact-team discovery and Bangboo defaults; neither may bypass the source gate. */
export function isReviewedSourceAtomContractValid() {
  const { contentHash, runtimeContentHash, ...content } = current31ReviewedBangbooSourceAtoms
  const actualRuntimeHash = stableContentHash(content)
  // The community build replaces the census's private locator with its opaque
  // source reference. Admit only the reviewed projection of this exact source
  // snapshot; changed lineups, source hashes or arbitrary redactions still fail.
  const reviewedCommunityProjection =
    runtimeContentHash === 'fnv1a-ea59dd18' && actualRuntimeHash === 'fnv1a-b999d7d6'
  return (
    current31ReviewedBangbooSourceAtoms.schema ===
      'soda-current31-reviewed-bangboo-source-atoms/v1' &&
    current31ReviewedBangbooSourceAtoms.gameVersion === '3.1' &&
    current31ReviewedBangbooSourceAtoms.sourceRegistry.sha256 ===
      '5F806B7E56470D4D7A1B41A80433068C392014685E227BAE916113C70CB2EBE9' &&
    current31ReviewedBangbooSourceAtoms.sourceCensus.sha256 ===
      '07DDC0AC20D5E8964CE576ADAB224AD4FBB5E17B69297D05E8A0894A9E350D81' &&
    contentHash === '2C062BFF6E30688B7F76BF5A4AF5BFF0CFDAA7BE8BD2005FE3F5A4890582D93D' &&
    (runtimeContentHash === actualRuntimeHash || reviewedCommunityProjection)
  )
}
