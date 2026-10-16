import { getReviewedExternalSupportFact } from './reviewedExternalSupportFacts'

/** A source-bound initial-HP target, not an observation of active team damage. */
export function resolveReviewedZhaoHpTarget(input: { agentId: string; coreLevel?: number | null }) {
  if (input.agentId !== 'agent-zhao') return null
  const fact = getReviewedExternalSupportFact(input.agentId)
  const effect = fact?.effects.find((row) => row.channel === 'all_damage_bonus')
  const minimum = effect?.value.initialMaxHpAtMaximum
  if (
    fact?.targetVersionStatus !== 'selected_3.1_fields_compared' ||
    !fact.targetVersionReview?.selectedFields.some((row) => row.locator.endsWith('desc[1]')) ||
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
    sourceRef: {
      id: `reviewed-zhao-initial-hp-${fact.sourceEvidenceHash}`,
      url: effect.reviewedSource.url,
      sourceVersion: fact.targetVersionReview.sourceVersion,
      checkedAt: fact.targetVersionReview.checkedAt,
      contentHash: fact.sourceEvidenceHash,
      licenseBoundary: 'Reviewed numeric skill facts; no copied page prose or media.',
    },
    conditions: [
      '初始生命27000可使追加能力增益满档；该生命目标不随核心技等级变化。',
      '追加能力队伍条件成立且位于以太帷幕中时生效。',
      '这是初始生命对应的追加增益满档目标，不是全部生命收益的上限。',
    ],
  }
}
