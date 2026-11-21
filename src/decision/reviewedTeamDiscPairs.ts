import reviewed from '../gameDataPacks/data/reviewed-team-disc-pairs.3.3.json'
import scores from '../gameDataPacks/generated/graduated-team-scores.v1.json'
import { candidateSetPlansForConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { orderedCandidateSetPlans } from '../gameDataPacks/candidateSetPlanPolicy'
import {
  candidateRecommendationForSetPlan,
  solveCandidateWarehouse,
  type CandidateWarehouseOptions,
} from '../optimizer/candidateWarehouseSolver'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { TeamJointBuildIntent } from './buildIntent'
import type { TargetTeamWarehouseFitSourceResult } from './targetTeamWarehouseFitProjection'
import { completeTargetTeamPlan, improvesCompletePlan } from './targetTeamWarehouseFitComparison'

const current = new Map(reviewed.entries.map((entry) => [entry.playId, entry]))
for (const [id, entry] of current) {
  if (
    scores.gameVersion !== reviewed.gameVersion ||
    !scores.rows.some(
      (row) =>
        row.playId === id && row.members === entry.members && row.evidence === entry.evidence,
    )
  )
    current.delete(id)
}

export function findReviewedDiscPlay(memberIds: readonly string[], playId?: string | null) {
  const entry = playId ? current.get(playId) : undefined
  return entry?.members === [...memberIds].sort().join('|') ? entry : undefined
}

/** Try the reviewed holders together, with the same source conditions and warehouse constraints. */
export function compareReviewedDiscAssignment(
  source: TargetTeamWarehouseFitSourceResult,
  intent: TeamJointBuildIntent,
  warehouse: CoreWarehouse,
  options: CandidateWarehouseOptions,
): TargetTeamWarehouseFitSourceResult {
  const binding = intent.exactTeam.reviewedDiscPlay
  const review = findReviewedDiscPlay(intent.agentIds, binding?.playId)
  if (!review || review.evidence !== binding?.evidence || options.teamAssignmentObjective)
    return source
  const matches = (plan: typeof source.plan) =>
    review.pairs.every((pair) => {
      const member = plan.loadouts.find((row) => row.agentId === pair.agentId)
      return member?.setCounts[pair.four] === 4 && member.setCounts[pair.two] === 2
    })
  if (matches(source.plan)) return source
  const recommendations = [...intent.recommendations]
  for (const pair of review.pairs) {
    const index = recommendations.findIndex((row) => row.agentId === pair.agentId)
    const row = recommendations[index]
    if (!row?.constraint || intent.exactTeam.selectedDirectionIdByAgentId?.[row.agentId])
      return source
    const eligible = orderedCandidateSetPlans(candidateSetPlansForConstraint(row.constraint)).find(
      (plan) =>
        plan.pattern === '4+2' &&
        plan.primarySetIds.includes(pair.four) &&
        plan.secondarySetIds.includes(pair.two) &&
        plan.purpose !== 'transition' &&
        plan.purpose !== 'historical',
    )
    if (!eligible) return source
    recommendations[index] = candidateRecommendationForSetPlan(row, {
      ...eligible,
      primarySetIds: [pair.four],
      secondarySetIds: [pair.two],
    })
  }
  const reviewedOptions: CandidateWarehouseOptions = {
    ...options,
    operationCoverageByAgent: Object.fromEntries(
      review.verifiedQuickAssistAgentIds.map((agentId) => [
        agentId,
        { basis: 'source-confirmed', teamQuickAssist: 'verified' },
      ]),
    ),
  }
  const plan = solveCandidateWarehouse(
    warehouse.discs,
    intent.agentIds,
    'team',
    reviewedOptions,
    recommendations,
  )
  const branchSearch = {
    ...source.branchSearch,
    attempts: source.branchSearch.attempts + 1,
    budget: source.branchSearch.budget + 1,
  }
  if (
    !matches(plan) ||
    !completeTargetTeamPlan(plan, intent.agentIds) ||
    (completeTargetTeamPlan(source.plan, intent.agentIds) &&
      !improvesCompletePlan(
        { plan, combination: [{ sourceRank: 0 }] },
        { plan: source.plan, combination: [{ sourceRank: 1 }] },
      ))
  )
    return { plan: source.plan, branchSearch }
  return {
    plan,
    branchSearch: {
      ...branchSearch,
      status: 'reviewed_play',
      preferredMemberCount: review.pairs.length,
    },
  }
}
