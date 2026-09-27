import { evaluateCandidateSetPlanEligibility } from '../gameDataPacks/candidateSetPlanEligibility'
import {
  candidateSetPlansForConstraint,
  deriveCandidateSetPlanReadiness,
  type CandidateWarehouseConstraint,
  type CandidateWarehouseRecommendation,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { stableContentHash } from '../gameDataPacks/types'
import { candidateSetPlanIdentity } from '../gameDataPacks/candidateSetPlanPolicy'
import type { AccountLoadout } from './optimizeAccountBuilds'

export function selectedSourceCondition(
  loadout: AccountLoadout,
  loadouts: readonly AccountLoadout[],
  agentIds: string[],
  constraint: CandidateWarehouseConstraint | null,
) {
  const matching = (constraint ? candidateSetPlansForConstraint(constraint) : [])
    .filter(
      (plan) =>
        plan.pattern === '4+2' &&
        plan.primarySetIds.some((id) => (loadout.setCounts[id] ?? 0) >= 4) &&
        plan.secondarySetIds.some((id) => (loadout.setCounts[id] ?? 0) >= 2),
    )
    .map((plan) => ({
      plan,
      eligibility: evaluateCandidateSetPlanEligibility(loadout.agentId, plan, {
        memberIds: agentIds,
        selectedLoadouts: {
          basis: 'final-candidate',
          setCountsByAgentId: Object.fromEntries(
            loadouts.map((item) => [item.agentId, item.setCounts]),
          ),
        },
      }),
    }))
    .sort((left, right) =>
      candidateSetPlanIdentity(left.plan).localeCompare(candidateSetPlanIdentity(right.plan)),
    )
  if (!matching.length) return null
  // One physical 4+2 may be backed by more than one adopted source branch. A
  // proven or unrestricted branch is enough to keep it; an unknown branch keeps
  // it visibly qualified. Reject only when every matching branch is disproven.
  const selected =
    matching.find(({ eligibility }) => eligibility.status === 'unrestricted') ??
    matching.find(({ eligibility }) => eligibility.status === 'eligible') ??
    matching.find(({ eligibility }) => eligibility.status === 'condition-unknown') ??
    matching[0]!
  return {
    ...selected.eligibility,
    sourcePlanIdentity: candidateSetPlanIdentity(selected.plan),
  }
}

export function excludeDisprovenSourcePlans(
  recommendations: readonly CandidateWarehouseRecommendation[],
  rejectedConditions: readonly { agentId: string; sourcePlanIdentity: string }[],
): CandidateWarehouseRecommendation[] {
  return recommendations.map(({ agentId, constraint }) => {
    const rejected = rejectedConditions.filter((condition) => condition.agentId === agentId)
    if (!constraint || !rejected.length) return { agentId, constraint }
    const setPlans = candidateSetPlansForConstraint(constraint).filter(
      (plan) =>
        !rejected.some(
          (condition) => candidateSetPlanIdentity(plan) === condition.sourcePlanIdentity,
        ),
    )
    const revised = {
      ...constraint,
      setPlans,
      setPlanReadiness: deriveCandidateSetPlanReadiness(setPlans),
    }
    return { agentId, constraint: { ...revised, contentHash: stableContentHash(revised) } }
  })
}
