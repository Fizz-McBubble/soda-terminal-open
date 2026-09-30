import type { Decision, Disc, QualityPolicy } from './absoluteDiscRetentionContract'

/** Record validity and account protection remain separate from the approved rarity rule. */
export function approvedRarityRetention(
  disc: Disc,
  policy: QualityPolicy,
  protectedDisc: boolean,
): Decision | null {
  const rule = policy.rarityCleanup
  if (
    !rule?.id ||
    rule.approval !== 'approved' ||
    !rule.sourceIds.length ||
    rule.sourceIds.some((source) => !source) ||
    (disc.rarity !== 'A' && disc.rarity !== 'B') ||
    !rule.rarities.includes(disc.rarity)
  )
    return null
  return {
    discId: disc.id,
    qualityDisposition: 'cleanup_candidate',
    recommendation: protectedDisc ? 'protected' : 'cleanup_candidate',
    reasons: [
      ...(protectedDisc ? ['explicit_account_reference_protection'] : []),
      'approved_rarity_cleanup_policy',
    ],
    evidence: [],
    bestUseProfileId: null,
    bestUseScore: null,
    ownedUseAgentIds: [],
    unownedUseAgentIds: [],
    policyId: policy.id,
    // This attests the rarity rule only; it does not claim character or kit coverage.
    sourceCoverage: 'complete',
    reasonKind: 'approved_rarity_cleanup',
    nextAction: {
      kind: 'manual_cleanup',
      targetLevel: null,
      detail: '按已确认的规则，A/B 级盘直接列为清理候选，不再判断品质或强化价值。',
      stopWhen: '收藏、装备或方案引用生效时继续保留；本工具不会自动删除。',
    },
    blockedBy: [],
    witnessProfileIds: [],
    reviewedUseScope: `${rule.id}:${rule.sourceIds.join(',')}`,
  }
}
