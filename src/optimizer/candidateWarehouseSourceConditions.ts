import type { DriveDisc } from '../domain/schemas'
import {
  candidateConstraintFromIntent,
  getCandidateWarehouseProfiles,
} from './candidateWarehouseProfiles'
import type { AccountOptimizerOptions } from './optimizeAccountBuildsCore'
import type { optimizeAccountBuilds } from './optimizeAccountBuilds'
import { evaluateCandidateSetPlanEligibility, type CandidateSetPlanEligibilityContext } from '../gameDataPacks/candidateSetPlanEligibility'
import {
  candidateSetPlansForConstraint,
  deriveCandidateSetPlanReadiness,
  type CandidateWarehouseConstraint,
  type CandidateWarehouseRecommendation,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { stableContentHash } from '../gameDataPacks/types'
import { candidateSetPlanIdentity } from '../gameDataPacks/candidateSetPlanPolicy'
import type { AccountLoadout } from './optimizeAccountBuilds'

export type SourceOperationCoverageByAgent = Readonly<Record<string, CandidateSetPlanEligibilityContext['operationCoverage']>>

export function selectedSourceCondition(
  loadout: AccountLoadout,
  loadouts: readonly AccountLoadout[],
  agentIds: string[],
  constraint: CandidateWarehouseConstraint | null,
  operationCoverage?: SourceOperationCoverageByAgent,
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
        operationCoverage: operationCoverage?.[loadout.agentId],
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

/** A disproven source branch can degrade physical inventory use without becoming equipment-illegal. */
export function sourceConditionDegradeReasons(
  condition: ReturnType<typeof selectedSourceCondition>,
): string[] {
  return condition?.status === 'condition-not-met' || condition?.status === 'condition-unknown'
    ? [condition.reason]
    : []
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

/** Resolve source qualification without discarding a legal physical assignment. */
export function resolveCandidateSourceConditions(
  discs: DriveDisc[],
  agentIds: string[],
  scope: 'agent' | 'team' | 'portfolio',
  solveOptions: AccountOptimizerOptions,
  recommendations: readonly CandidateWarehouseRecommendation[] | undefined,
  initialProfiles: ReturnType<typeof getCandidateWarehouseProfiles>,
  optimize: typeof optimizeAccountBuilds,
  operationCoverage?: SourceOperationCoverageByAgent,
) {
  let profiles = initialProfiles
  let result = optimize(discs, profiles, solveOptions)
  const physicalFallbackResult = result
  const physicalFallbackProfiles = profiles
  let effectiveRecommendations = recommendations
  const rejectedConditions: Array<
    NonNullable<ReturnType<typeof selectedSourceCondition>> & { agentId: string }
  > = []
  const conditionPassBudget =
    scope === 'team' && agentIds.length === 3
      ? agentIds.reduce(
          (total, agentId) =>
            total +
            (candidateConstraintFromIntent(agentId, recommendations)?.setPlans?.length ?? 1),
          0,
        )
      : 0
  // Each pass removes disproven branches and checks the newly selected equipment.
  for (let pass = 0; pass < conditionPassBudget; pass += 1) {
    const rejected = result.global.flatMap((loadout) => {
      const condition = selectedSourceCondition(
        loadout,
        result.global,
        agentIds,
        candidateConstraintFromIntent(loadout.agentId, effectiveRecommendations),
        operationCoverage,
      )
      return condition?.status === 'condition-not-met' && condition.conditionalPrimarySetId
        ? [{ agentId: loadout.agentId, ...condition }]
        : []
    })
    if (!rejected.length) break
    rejectedConditions.push(...rejected)
    effectiveRecommendations = excludeDisprovenSourcePlans(
      agentIds.map((agentId) => ({
        agentId,
        constraint: candidateConstraintFromIntent(agentId, effectiveRecommendations),
      })),
      rejected,
    )
    profiles = getCandidateWarehouseProfiles(
      agentIds,
      [...new Set(discs.map((disc) => disc.setId))],
      effectiveRecommendations,
    )
    result = optimize(discs, profiles, solveOptions)
  }
  const completeTeam = (candidate: typeof result) => {
    const loadouts = agentIds
      .map((agentId) => candidate.global.find((loadout) => loadout.agentId === agentId))
      .filter((loadout) => loadout !== undefined)
    const ids = loadouts.flatMap((loadout) => loadout.discs.map(({ disc }) => disc.id))
    return (
      loadouts.length === agentIds.length &&
      loadouts.every((loadout) => loadout.discs.length === 6) &&
      new Set(ids).size === ids.length
    )
  }
  // Source qualification and entity feasibility are separate gates. If removing
  // a disproven source branch leaves the team incomplete, retain the already
  // validated physical assignment and mark its source condition as degraded.
  // A caller-pinned single branch remains fail-closed. One rejected agent with
  // an alternative cannot authorize a fallback for another rejected agent whose
  // source direction was explicitly pinned.
  const rejectedAgentIds = [...new Set(rejectedConditions.map((condition) => condition.agentId))]
  const allRejectedAgentsHaveSourceAlternative =
    rejectedAgentIds.length > 0 &&
    rejectedAgentIds.every(
      (agentId) =>
        (candidateConstraintFromIntent(agentId, recommendations)?.setPlans?.length ?? 0) > 1,
    )
  const sourceConditionFallbackUsed =
    scope === 'team' &&
    agentIds.length === 3 &&
    allRejectedAgentsHaveSourceAlternative &&
    !completeTeam(result) &&
    completeTeam(physicalFallbackResult)
  if (sourceConditionFallbackUsed) {
    result = physicalFallbackResult
    profiles = physicalFallbackProfiles
  }
  return {
    result,
    profiles,
    effectiveRecommendations,
    rejectedConditions,
    sourceConditionFallbackUsed,
  }
}
