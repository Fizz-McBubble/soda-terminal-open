import { agentCatalog } from '../assault/catalogData'
import { currentVersionAdoption32 } from './currentVersionAdoption32'
import { gameData31CurrentCanonical } from './gameData31CurrentCanonical'
import { gameData32CatalogEntities } from './gameData32CatalogEntities'
import { stableContentHash } from './types'
import { currentReleasedIdentitySourceRegistry } from './currentReleasedIdentityMap'

/** User-adopted continuity of existing reference support, not a new publisher
 * review or Formal combat promotion. Restricted to this locked 3.1 -> 3.2 delta. */
export const reviewedReferenceSupportContinuity32 = Object.freeze({
  id: 'reviewed-reference-support-3.1-to-3.2-r1',
  sourceReviewVersion: '3.1',
  adoptedForVersion: '3.2',
  previousCommit: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  currentCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  deltaSha256: 'e1625ddfe6c45e5157e01f258142bd68b9137cde1defa41b91a47c3dc4c48ce8',
  sourceHashes: {
    canonical: 'fnv1a-5cb6c902',
    strengthGold: 'fnv1a-973a11f4',
    intrinsicIndex: 'fnv1a-5505c7cb',
    realityProfiles: 'fnv1a-f7f8e201',
    publishedStrength: 'fnv1a-1e5a7ef7',
    editorialAnalysis: 'fnv1a-5567c1c0',
  },
  adoptionContentHash: currentVersionAdoption32.contentHash,
  boundary:
    '沿用已接受3.1参考支持及原档位；原来源和审核版本不变，不宣称作者重审3.2，不扩展到新增队伍、未来版或Formal/Import。真实机制与缺字段门仍独立执行。',
})

const newIds = new Set<string>(gameData32CatalogEntities.map((entity) => entity.id))
const oldAgentIds = new Set<string>(
  [
    ...agentCatalog.map((row) => row[0]),
    ...currentReleasedIdentitySourceRegistry.sources
      .filter((source) => source.sourceVersion === '3.1')
      .flatMap((source) => source.stableIds.filter((id) => id.startsWith('agent-'))),
  ].filter((id) => !newIds.has(id)),
)
export function isExistingReviewed31Formation(memberIds: readonly string[]) {
  return (
    memberIds.length === 3 &&
    new Set(memberIds).size === 3 &&
    memberIds.every((id) => oldAgentIds.has(id))
  )
}

export function canApplyReviewedReferenceSupport32(input: {
  targetVersion: string
  sourceReviewVersion: string
  sourceKind: keyof typeof reviewedReferenceSupportContinuity32.sourceHashes
  sourceContentHash: string
}) {
  const identity = reviewedReferenceSupportContinuity32
  const delta = currentVersionAdoption32.sourceIdentity.deltaIdentity
  return (
    input.targetVersion === identity.adoptedForVersion &&
    input.sourceReviewVersion === identity.sourceReviewVersion &&
    input.sourceContentHash === identity.sourceHashes[input.sourceKind] &&
    delta.previousCommit === identity.previousCommit &&
    delta.currentCommit === identity.currentCommit &&
    delta.deltaSha256 === identity.deltaSha256 &&
    gameData31CurrentCanonical.contentHash === identity.sourceHashes.canonical
  )
}

export function reviewedBuildFieldReferenceContinuity32(input: {
  agentId: string
  targetVersion: string
  field?: {
    path: string
    gameVersion: string
    currentApplicability: string
    status: string
    conflict: unknown
    sourceRefs: readonly unknown[]
  }
}) {
  const field = input.field
  if (
    !field ||
    !oldAgentIds.has(input.agentId) ||
    field.status === 'missing' ||
    field.conflict ||
    field.currentApplicability !== 'continuous' ||
    !field.sourceRefs.length ||
    field.path === 'build.version_change_impact' ||
    (field.path === 'progression.potential_overlay' &&
      ['agent-koleda', 'agent-miyabi', 'agent-nekomata', 'agent-piper'].includes(input.agentId)) ||
    !canApplyReviewedReferenceSupport32({
      targetVersion: input.targetVersion,
      sourceReviewVersion: field.gameVersion,
      sourceKind: 'canonical',
      sourceContentHash: gameData31CurrentCanonical.contentHash,
    })
  )
    return null
  return {
    adoptionId: reviewedReferenceSupportContinuity32.id,
    sourceReviewVersion: field.gameVersion,
    adoptedForVersion: input.targetVersion,
    referenceContentHash: stableContentHash(field),
    sourceIdentity: reviewedReferenceSupportContinuity32,
  }
}
