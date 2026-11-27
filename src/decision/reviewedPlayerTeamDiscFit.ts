import {
  reviewedPlayerDiscAlternative,
  type ReviewedPlayerDiscBinding,
} from '../gameDataPacks/reviewedPlayerDiscAlternatives'
import { candidateLoadoutMatchesSetPlan } from '../optimizer/candidateWarehouseAlternativeRanking'
import {
  candidateRecommendationForSetPlan,
  solveCandidateWarehouse,
} from '../optimizer/candidateWarehouseSolver'
import { optimizerOptionsFromBuildIntent, type TeamJointBuildIntent } from './buildIntent'
import { completeTargetTeamPlan, improvesCompletePlan } from './targetTeamWarehouseFitComparison'
import {
  projectTargetTeamWarehouseFit,
  type TargetTeamWarehouseFitSourceResult,
} from './targetTeamWarehouseFitProjection'

export function reviewedTeamDiscAlternative(intent: TeamJointBuildIntent, agentId: string) {
  if (intent.exactTeam.selectedDirectionIdByAgentId?.[agentId]) return undefined
  const row = intent.recommendations.find((value) => value.agentId === agentId)
  const constraint = row?.constraint
  const alternative = reviewedPlayerDiscAlternative(constraint)
  if (!row || !constraint || !alternative) return undefined
  return {
    ...alternative,
    recommendation: candidateRecommendationForSetPlan(
      {
        ...row,
        constraint: {
          ...constraint,
          setIds: [
            ...new Set([
              ...constraint.setIds,
              ...alternative.plan.primarySetIds,
              ...alternative.plan.secondarySetIds,
            ]),
          ],
          sources: [...constraint.sources, ...alternative.sources],
        },
      },
      alternative.plan,
    ),
  }
}

/** Compare only on a requested physical team solve. The certified ranking intent is unchanged. */
export function compareReviewedPlayerTeamDiscs(
  input: Parameters<typeof projectTargetTeamWarehouseFit>[0],
  baseline: ReturnType<typeof projectTargetTeamWarehouseFit>,
) {
  const { buildIntent, teamAssignmentObjective } = input
  const alternative = buildIntent.agentIds
    .map((id) => reviewedTeamDiscAlternative(buildIntent, id))
    .find((option) => option !== undefined)
  if (!alternative) return baseline
  const agentId = alternative.recommendation.agentId
  const current = baseline.warehousePlan.loadouts.find((row) => row.agentId === agentId)
  if (current && candidateLoadoutMatchesSetPlan(current, alternative.plan)) return baseline

  const plan = solveCandidateWarehouse(
    input.warehouse.discs,
    buildIntent.agentIds,
    'team',
    optimizerOptionsFromBuildIntent(buildIntent),
    buildIntent.recommendations.map((row) =>
      row.agentId === agentId ? alternative.recommendation : row,
    ),
  )
  const member = plan.loadouts.find((row) => row.agentId === agentId)
  if (
    !member ||
    !candidateLoadoutMatchesSetPlan(member, alternative.plan) ||
    !completeTargetTeamPlan(plan, buildIntent.agentIds)
  )
    return baseline
  if (completeTargetTeamPlan(baseline.warehousePlan, buildIntent.agentIds)) {
    const previous = teamAssignmentObjective?.evaluate(baseline.warehousePlan.loadouts) ?? null
    const next = teamAssignmentObjective?.evaluate(plan.loadouts) ?? null
    // A supported objective takes precedence. When both outcomes are unknown,
    // the ordinary source-backed path still compares legal physical loadouts.
    if (
      (baseline.sourceBranchSearch.status === 'dynamic_objective' ||
        previous !== null ||
        next !== null) &&
      (previous === null ||
        next === null ||
        !Number.isFinite(previous) ||
        !Number.isFinite(next) ||
        next <= previous)
    )
      return baseline
    const objective =
      previous === null || next === null || !teamAssignmentObjective
        ? undefined
        : {
            ...teamAssignmentObjective,
            evaluate: (loadouts: readonly unknown[]) =>
              loadouts === plan.loadouts ? next : previous,
          }
    if (
      !improvesCompletePlan(
        { plan, combination: [{ sourceRank: 0 }] },
        { plan: baseline.warehousePlan, combination: [{ sourceRank: 0 }] },
        objective,
      )
    )
      return baseline
  }

  member.reviewedDiscAlternative = { ...alternative.binding }
  const branchSearch: TargetTeamWarehouseFitSourceResult['branchSearch'] = {
    status: 'reviewed_play',
    attempts: baseline.sourceBranchSearch.attempts + 1,
    budget: baseline.sourceBranchSearch.budget + 1,
    preferredMemberCount: 1,
  }
  return projectTargetTeamWarehouseFit(input, { plan, branchSearch })
}

/** Validate the recorded player source before scoring the saved entity discs. */
export function requireSavedReviewedTeamDiscAlternative(
  intent: TeamJointBuildIntent,
  agentId: string,
  binding: ReviewedPlayerDiscBinding,
) {
  const current = reviewedTeamDiscAlternative(intent, agentId)
  if (current?.binding.id !== binding.id || current.binding.sourceHash !== binding.sourceHash)
    throw new Error('保存方案的备选套装来源已变化；原方案仍保留，请重新计算。')
  return current
}
