import { agentCatalog } from '../assault/catalogData'
import { currentDriveDiscRecommendationCatalog } from '../gameDataPacks/currentDriveDiscRecommendationCatalog'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import type { UtilityEvidence } from './absoluteDiscRetentionContract'
import { getAgentSpecialtyLabel } from '../assault/catalog'

/** Human-readable predicates preserve their source identity without exposing a config object. */
export function retentionCondition(
  condition: string | CandidateSetPlan['condition'] | undefined,
  predicateId: string,
  evidenceIds: readonly string[],
): UtilityEvidence[] {
  if (!condition) return []
  if (typeof condition === 'string')
    return [{ state: 'conditional', predicateId, evidenceIds, detail: condition }]
  const rule = condition.rule
  const name =
    rule.kind === 'teammate'
      ? (agentCatalog.find((row) => row[0] === rule.agentId)?.[1] ?? rule.agentId)
      : ''
  const setName =
    'setId' in rule
      ? (currentDriveDiscRecommendationCatalog.find((row) => row.id === rule.setId)?.name ??
        rule.setId)
      : ''
  const detail =
    rule.kind === 'teammate'
      ? `需要队友 ${name}；未确认队伍时只作为潜在构筑方向。`
      : rule.kind === 'teammate_four_piece'
        ? `需要队友装备 ${setName} 四件套。`
        : rule.kind === 'teammate_not_four_piece'
          ? `需要确认队友没有装备 ${setName} 四件套，避免重复效果。`
          : rule.kind === 'teammate_specialty_and_action'
            ? `需要${rule.specialties.map(getAgentSpecialtyLabel).join(' / ')}队友，以及${rule.action === 'wearer_ex_special' ? '自身强化特殊技' : '队伍快速支援'}覆盖；效果窗口和叠层需另行核验。`
            : '需要满足来源指定的电属性队伍条件。'
  return [
    {
      state: condition.sourceTextVerified ? 'conditional' : 'missing_fact',
      predicateId,
      evidenceIds: [
        ...evidenceIds,
        condition.sourceId,
        ...[condition.sourceVersion, condition.contentHash].filter((value): value is string =>
          Boolean(value),
        ),
      ],
      detail: condition.sourceTextVerified ? detail : `条件来源尚未核实：${detail}`,
    },
  ]
}
