import { getReviewedExternalSupportFact } from './reviewedExternalSupportFacts'

/** A source-bound initial-HP target, not an observation of active team damage. */
export function resolveReviewedZhaoHpTarget(input: { agentId: string; coreLevel?: number | null }) {
  if (input.agentId !== 'agent-zhao' || input.coreLevel !== 7) return null
  const fact = getReviewedExternalSupportFact(input.agentId)
  const effect = fact?.effects.find((row) => row.channel === 'all_damage_bonus')
  const minimum = effect?.value.initialMaxHpAtMaximum
  if (
    fact?.targetVersionStatus !== 'selected_3.1_fields_compared' ||
    !fact.targetVersionReview?.selectedFields.some((row) => row.coreLevel === 7) ||
    typeof minimum !== 'number' ||
    !Number.isFinite(minimum) ||
    minimum <= 0 ||
    effect?.eligibility.magnitudeBoundary !== 'core_independent'
  )
    return null
  return {
    stat: 'hp' as const,
    basis: 'initial' as const,
    minimum,
    sourceId: fact.sourceEvidenceHash,
    sourceRefs: [effect.reviewedSource.url],
    conditions: [
      '核心技7；追加能力队伍条件成立且位于以太帷幕中。',
      '这是初始生命对应的追加增益满档目标，不是全部生命收益的上限。',
    ],
  }
}
