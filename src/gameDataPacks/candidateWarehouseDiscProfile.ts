import type { AgentDiscProfile } from '../assault/engine'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraintTypes'
import type { CandidateSetPlan } from './candidateSetPlans'
import {
  qualifyCandidateSetPlan,
  evaluateCandidateSetPlanEligibility,
} from './candidateSetPlanEligibility'
import { candidateGuidanceFieldAvailable } from './candidateWarehouseGuidanceApplicability'

/** The one field/source admission check shared by plan readers, UI and the solver. */
export function candidateSetPlanAvailable(
  constraint: CandidateWarehouseConstraint,
  plan: CandidateSetPlan,
): boolean {
  const fieldPaths = new Set([
    ...(plan.dependencyFieldPaths ?? ['build.drive_disc_sets']),
    ...(plan.condition ? (['build.team_bangboo_scenario'] as const) : []),
  ])
  const sourceId =
    plan.condition?.sourceId ??
    (constraint.reviewedTeamDirectionId &&
    plan.dependencyFieldPaths?.includes('build.team_bangboo_scenario')
      ? `reviewed-team-disc-${constraint.reviewedTeamDirectionId}`
      : undefined)
  return [...fieldPaths].every((fieldPath) =>
    candidateGuidanceFieldAvailable(constraint, fieldPath, sourceId),
  )
}

/** Adapts sourced candidate directions to the existing optimizer input without making it formal. */
export function candidateConstraintToDiscProfile(
  constraint: CandidateWarehouseConstraint,
): AgentDiscProfile | null {
  if (constraint.status !== 'candidate' || constraint.setPlanReadiness.status !== 'executable')
    return null
  const setPlans = candidateSetPlansForConstraint(constraint)
  if (!setPlans.length) return null
  const setIds = [
    ...new Set(setPlans.flatMap((plan) => [...plan.primarySetIds, ...plan.secondarySetIds])),
  ]
  const setFit = Object.fromEntries(setIds.map((setId) => [setId, 1]))
  const reviewedTeamSourceId = constraint.reviewedTeamDirectionId
    ? `reviewed-team-disc-${constraint.reviewedTeamDirectionId}`
    : undefined
  const mainStatsAvailable = candidateGuidanceFieldAvailable(
    constraint,
    'build.main_sub_stats',
    constraint.reviewedIndependentDirectionId ?? reviewedTeamSourceId,
  )
  return {
    agentId: constraint.agentId,
    version: `candidate-${constraint.contentHash.slice(0, 12)}`,
    statWeights: mainStatsAvailable ? constraint.subStatWeights : {},
    mainStatFit: {
      1: { hp_flat: 1 },
      2: { atk_flat: 1 },
      3: { def_flat: 1 },
      ...(mainStatsAvailable
        ? {
            4: Object.fromEntries((constraint.mainStats['4'] ?? []).map((stat) => [stat, 1])),
            5: Object.fromEntries((constraint.mainStats['5'] ?? []).map((stat) => [stat, 1])),
            6: Object.fromEntries((constraint.mainStats['6'] ?? []).map((stat) => [stat, 1])),
          }
        : {}),
    },
    setFit,
    setPlans: setPlans.map((plan) => ({
      pattern: plan.pattern,
      primarySets: plan.primarySetIds,
      secondarySets: plan.secondarySetIds,
      personalFitBonusEligible:
        !['conditional', 'transition', 'historical'].includes(plan.purpose ?? '') &&
        evaluateCandidateSetPlanEligibility(constraint.agentId, plan).status === 'unrestricted',
    })),
    confidence: 'low',
    gameVersion: constraint.gameVersion,
    scenario: constraint.teamAndBangbooPreconditions.join('；'),
    teamAssumptions: constraint.teamAndBangbooPreconditions,
    contextRationale: [
      constraint.boundary,
      ...setPlans.flatMap((plan) => (plan.sourceText ? [plan.sourceText] : [])),
    ],
  }
}

/** One branch-preserving read for the solver and player-facing recommendation. */
export function candidateSetPlansForConstraint(
  constraint: CandidateWarehouseConstraint,
): CandidateSetPlan[] {
  if (constraint.setPlanReadiness.status !== 'executable') return []
  const plans = constraint.setPlans ?? [
    {
      pattern: constraint.setPlanReadiness.pattern,
      primarySetIds: constraint.setPlanReadiness.primarySetIds,
      secondarySetIds: constraint.setPlanReadiness.secondarySetIds,
    },
  ]
  return plans
    .flatMap((plan) =>
      plan.pattern === '4+2'
        ? plan.primarySetIds.flatMap((primarySetId) => {
            const secondarySetIds = plan.secondarySetIds.filter(
              (secondarySetId) => secondarySetId !== primarySetId,
            )
            return secondarySetIds.length
              ? [
                  qualifyCandidateSetPlan(constraint.agentId, {
                    ...plan,
                    primarySetIds: [primarySetId],
                    secondarySetIds,
                  }),
                ]
              : []
          })
        : [qualifyCandidateSetPlan(constraint.agentId, plan)],
    )
    .filter((plan) => candidateSetPlanAvailable(constraint, plan))
}
