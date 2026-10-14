import { current31StrengthGoldSet } from './current31StrengthGoldSet'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { reviewCurrent31ProductionPairwiseEvidence } from './current31ProductionPairwiseEvidence'
import {
  canApplyReviewedReferenceSupport32,
  isExistingReviewed31Formation,
} from '../gameDataPacks/reviewedReferenceSupportContinuity32'

const goldContentHash = stableContentHash(current31StrengthGoldSet)
const continuedReference = () =>
  canApplyReviewedReferenceSupport32({
    targetVersion: currentVersionProjection.gameVersion,
    sourceReviewVersion: '3.1',
    sourceKind: 'strengthGold',
    sourceContentHash: goldContentHash,
  })

/**
 * Runtime ordering is deliberately a separate contract from the calibration
 * holdout.  These ten relations were already adjudicated from public facts,
 * but consuming them in production means they can no longer be represented as
 * a source-disjoint acceptance set.
 */
export const current31ProductionPartialOrderContractId =
  'soda-current-3.1-production-partial-order/v3' as const

type VariantIdentity = {
  memberIds: readonly string[]
  bangbooId: string | null
}

export function current31ProductionPartialOrderVariantKey(identity: VariantIdentity) {
  return identity.memberIds.length === 3 && new Set(identity.memberIds).size === 3
    ? [...identity.memberIds].sort().join('|')
    : null
}

const caseById = new Map(current31StrengthGoldSet.cases.map((item) => [item.caseId, item]))

const relations = current31StrengthGoldSet.highConfidencePairwise.map((pair) => {
  const stronger = caseById.get(pair.strongerCaseId)
  const weaker = caseById.get(pair.weakerCaseId)
  if (!stronger || !weaker)
    throw new Error(
      `Production partial order refers to an unknown Gold case: ${pair.strongerCaseId}.`,
    )
  return Object.freeze({
    stronger: current31ProductionPartialOrderVariantKey(stronger),
    weaker: current31ProductionPartialOrderVariantKey(weaker),
    evidenceRefs: pair.labelEvidenceRefs,
    basis: pair.basis,
    review: reviewCurrent31ProductionPairwiseEvidence(stronger.memberIds, weaker.memberIds),
  })
})

const strongerByWeaker = new Map<string, readonly string[]>()
for (const relation of relations) {
  if (!relation.review.defaultSameBandOrderingEligible) continue
  const existing = strongerByWeaker.get(relation.weaker!) ?? []
  strongerByWeaker.set(relation.weaker!, [...existing, relation.stronger!])
}

function isStronger(stronger: string, weaker: string) {
  const pending = [...(strongerByWeaker.get(weaker) ?? [])]
  const seen = new Set<string>()
  while (pending.length) {
    const current = pending.pop()!
    if (current === stronger) return true
    if (seen.has(current)) continue
    seen.add(current)
    pending.push(...(strongerByWeaker.get(current) ?? []))
  }
  return false
}

export function knownCurrent31ProductionStrongerKeys(identity: VariantIdentity) {
  if (
    currentVersionProjection.gameVersion !== '3.1' &&
    (!continuedReference() || !isExistingReviewed31Formation(identity.memberIds))
  )
    return []
  const key = current31ProductionPartialOrderVariantKey(identity)
  if (!key) return []
  const pending = [...(strongerByWeaker.get(key) ?? [])]
  const seen = new Set<string>()
  while (pending.length) {
    const current = pending.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    pending.push(...(strongerByWeaker.get(current) ?? []))
  }
  return [...seen]
}

/** -1: left is known stronger; 1: right is known stronger; 0: intentionally tied/unknown. */
export function compareCurrent31ProductionPartialOrder(
  left: VariantIdentity,
  right: VariantIdentity,
) {
  if (
    currentVersionProjection.gameVersion !== '3.1' &&
    (!continuedReference() ||
      !isExistingReviewed31Formation(left.memberIds) ||
      !isExistingReviewed31Formation(right.memberIds))
  )
    return 0
  const leftKey = current31ProductionPartialOrderVariantKey(left)
  const rightKey = current31ProductionPartialOrderVariantKey(right)
  if (!leftKey || !rightKey || leftKey === rightKey) return 0
  if (isStronger(leftKey, rightKey)) return -1
  if (isStronger(rightKey, leftKey)) return 1
  return 0
}

export const current31ProductionPartialOrder = Object.freeze({
  contract: current31ProductionPartialOrderContractId,
  gameVersion: '3.1',
  grain: 'exact_3_agent' as const,
  relationCount: relations.length,
  activeRelationCount: relations.filter(
    (relation) => relation.review.defaultSameBandOrderingEligible,
  ).length,
  contextualRelationCount: relations.filter(
    (relation) => !relation.review.defaultSameBandOrderingEligible,
  ).length,
  orderingScope: 'same_coarse_strength_band_local_preference' as const,
  relations,
  sourceDisjointHoldout: false as const,
  boundary:
    '生产偏序保留精确三人的本地来源偏好，仅作同粗档细序，邦布不参与身份。观测分区出现反向记录的关系保留上下文但不用于默认排序，也不反向定档；无关系时并列，不以均值、来源顺序或单人评级补成全序。这些关系不是独立留出验证。',
})
