import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { TeamAssignmentObjective } from '../optimizer/selectTeamObjectiveAssignment'
import { compareCandidatePanelObjective } from '../optimizer/candidatePanelObjective'
import { candidateTeamSetScore } from '../optimizer/candidateTeamSetScore'
export function improvesCompletePlan(
  candidate: { plan: CandidateWarehousePlan; combination: Array<{ sourceRank: number }> },
  baseline: { plan: CandidateWarehousePlan; combination: Array<{ sourceRank: number }> },
  objective?: TeamAssignmentObjective,
) {
  const uncertain = (plan: CandidateWarehousePlan) =>
    plan.loadouts.filter((item) => item.degraded).length
  const uncertaintyDelta = uncertain(candidate.plan) - uncertain(baseline.plan)
  if (uncertaintyDelta !== 0) return uncertaintyDelta < 0
  const priority = (choices: Array<{ sourceRank: number }>) =>
    choices.reduce((sum, choice) => sum + choice.sourceRank, 0)
  const priorityDelta = priority(candidate.combination) - priority(baseline.combination)
  const panelComparisons = candidate.plan.loadouts.map((loadout) =>
    compareCandidatePanelObjective(
      loadout.panelObjective,
      baseline.plan.loadouts.find((item) => item.agentId === loadout.agentId)?.panelObjective,
    ),
  )
  // Never trade away one member's accepted cultivation objective for another member's scalar score.
  if (panelComparisons.some((value) => value > 0)) return false
  const baselineValue = objective?.evaluate(baseline.plan.loadouts)
  const candidateValue = objective?.evaluate(candidate.plan.loadouts)
  if (
    typeof candidateValue === 'number' &&
    Number.isFinite(candidateValue) &&
    typeof baselineValue === 'number' &&
    Number.isFinite(baselineValue) &&
    candidateValue !== baselineValue
  )
    return candidateValue > baselineValue
  // Source preference is a fallback for incomparable/unsupported objectives.
  if (priorityDelta !== 0) return priorityDelta < 0
  if (panelComparisons.some((value) => value < 0)) return true
  return (
    candidateTeamSetScore(candidate.plan.loadouts) > candidateTeamSetScore(baseline.plan.loadouts)
  )
}

export function targetTeamPlanCompletion(
  plan: CandidateWarehousePlan,
  memberIds: readonly string[],
) {
  const discIds = plan.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id))
  return {
    completeMemberCount: memberIds.filter(
      (agentId) =>
        plan.loadouts.filter((loadout) => loadout.agentId === agentId).length === 1 &&
        plan.loadouts.find((loadout) => loadout.agentId === agentId)?.discs.length === 6,
    ).length,
    uniqueDiscCount: new Set(discIds).size,
  }
}

export function completeTargetTeamPlan(plan: CandidateWarehousePlan, memberIds: readonly string[]) {
  const discIds = plan.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id))
  const completion = targetTeamPlanCompletion(plan, memberIds)
  return (
    completion.completeMemberCount === memberIds.length &&
    discIds.length === memberIds.length * 6 &&
    completion.uniqueDiscCount === discIds.length
  )
}
