import { stableContentHash } from '../gameDataPacks/types'
import { inspectCurrent31FormationMechanicState } from './current31FormationMechanicAudit'
import { current31LegalAgentFormations } from './current31LegalCandidateUniverse'

export type ExhaustiveAccountFormationCandidate = {
  candidateId: string
  memberIds: readonly [string, string, string]
  mechanicState: 'closed_at_base' | 'limited'
  limitations: string[]
}

/**
 * Projects every owned formation before ranking. A missing observed relation,
 * field-time fit, resource loop or Additional Ability is a limitation, not a
 * hard-invalid prune. This keeps the exhaustive denominator independent from
 * the curated community kernel catalogue.
 */
export function projectCurrent31ExhaustiveAccountCandidates(ownedAgentIds: readonly string[]) {
  const owned = new Set(ownedAgentIds)
  const formations = current31LegalAgentFormations.filter((memberIds) =>
    memberIds.every((agentId) => owned.has(agentId)),
  )
  const candidates: ExhaustiveAccountFormationCandidate[] = formations.map((memberIds) => {
    const state = inspectCurrent31FormationMechanicState(memberIds)
    const limitations = [
      ...(state.fieldTimeWithinBudget ? [] : ['field_time_budget_open']),
      ...(state.resourceLoopClosed ? [] : ['resource_loop_open']),
      ...(state.activationAtBase ? [] : ['additional_ability_inactive_at_base']),
      ...(state.observedPartnerRelationForEveryMember
        ? []
        : ['observed_partner_relation_incomplete']),
    ]
    return {
      candidateId: `formation:${memberIds.join('+')}`,
      memberIds,
      mechanicState:
        state.fieldTimeWithinBudget && state.resourceLoopClosed && state.activationAtBase
          ? ('closed_at_base' as const)
          : ('limited' as const),
      limitations,
    }
  })
  return {
    contract: 'soda-exhaustive-account-formation-candidates/v1' as const,
    candidates,
    coverage: {
      ownedAgentCount: owned.size,
      eligibleFormationCount: formations.length,
      projectedFormationCount: candidates.length,
      mechanicClosedAtBaseCount: candidates.filter(
        (candidate) => candidate.mechanicState === 'closed_at_base',
      ).length,
      limitedButNotPrunedCount: candidates.filter(
        (candidate) => candidate.mechanicState === 'limited',
      ).length,
      hardPrunedCount: 0,
      complete: candidates.length === formations.length,
    },
    fingerprint: stableContentHash(
      candidates.map((candidate) => [
        candidate.candidateId,
        candidate.mechanicState,
        candidate.limitations,
      ]),
    ),
    boundary:
      '这是生产候选母集投影，不是 Team DPS；只有 hard-invalid/unsupported 才允许剪枝，机制未闭合保留为 limited 并进入后续数值/解释链。',
  }
}
