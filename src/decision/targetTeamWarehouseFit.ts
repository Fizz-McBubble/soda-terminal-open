import type { CoreWarehouse } from '../accounts/coreFlow'
import { contentHash } from '../evaluation/contentHash'
import {
  candidateRecommendationForSetPlan,
  createAccountCandidateGenerationCache,
  solveCandidateWarehouse,
  type CandidateWarehouseOptions,
  type CandidateWarehousePlan,
} from '../optimizer/candidateWarehouseSolver'
import {
  candidateSetPlansForConstraint,
  type CandidateWarehouseRecommendation,
} from '../gameDataPacks/candidateWarehouseConstraints'
import type { BangbooSelection } from '../teamEngine/contracts'
import { projectTeamEquipmentRecommendations } from './teamEquipmentRecommendations'
import { optimizerOptionsFromBuildIntent, type TeamJointBuildIntent } from './buildIntent'
import type { TeamAssignmentObjective } from '../optimizer/selectTeamObjectiveAssignment'
import { compareCandidatePanelObjective } from '../optimizer/candidatePanelObjective'
import { candidateTeamSetScore } from '../optimizer/candidateTeamSetScore'
import {
  candidateSetPlanPriority,
  candidateSetPlanIdentity,
  orderedCandidateSetPlans,
} from '../gameDataPacks/candidateSetPlanPolicy'

export type TargetTeamWarehouseFit = ReturnType<typeof calculateTargetTeamWarehouseFit>

const sourceBranchTeamSolveBudget = 16

type SourceBranchChoice = {
  recommendation: CandidateWarehouseRecommendation
  /** Explicit preference relative to the best feasible branch, never its array position. */
  sourceRank: number
}

type SourceBranchOptions = {
  choices: SourceBranchChoice[]
  hasIndividuallyFeasibleBranch: boolean
  remainingBranches: CandidateWarehouseRecommendation[]
}

function sourceBranchChoiceIdentity(choice: SourceBranchChoice) {
  const constraint = choice.recommendation.constraint
  const plan = constraint ? candidateSetPlansForConstraint(constraint)[0] : undefined
  return plan
    ? candidateSetPlanIdentity(plan)
    : `${choice.recommendation.agentId}|no-executable-source-plan`
}

function targetTeamPlanCompletion(plan: CandidateWarehousePlan, memberIds: readonly string[]) {
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

function completeTargetTeamPlan(plan: CandidateWarehousePlan, memberIds: readonly string[]) {
  const discIds = plan.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id))
  const completion = targetTeamPlanCompletion(plan, memberIds)
  return (
    completion.completeMemberCount === memberIds.length &&
    discIds.length === memberIds.length * 6 &&
    completion.uniqueDiscCount === discIds.length
  )
}

function improvesTargetTeamCompletion(
  candidate: CandidateWarehousePlan,
  baseline: CandidateWarehousePlan,
  memberIds: readonly string[],
) {
  const candidateCompletion = targetTeamPlanCompletion(candidate, memberIds)
  const baselineCompletion = targetTeamPlanCompletion(baseline, memberIds)
  return (
    candidateCompletion.completeMemberCount > baselineCompletion.completeMemberCount ||
    (candidateCompletion.completeMemberCount === baselineCompletion.completeMemberCount &&
      candidateCompletion.uniqueDiscCount > baselineCompletion.uniqueDiscCount)
  )
}

function agentOnlyOptions(options: CandidateWarehouseOptions, agentId: string) {
  const fixedDiscId = options.fixedDiscByAgent?.[agentId]
  return {
    ...options,
    priorityAgentIds: [agentId],
    fixedDiscByAgent: fixedDiscId ? { [agentId]: fixedDiscId } : {},
    panelInputsByAgent: options.panelInputsByAgent?.[agentId]
      ? { [agentId]: options.panelInputsByAgent[agentId]! }
      : undefined,
    teamAssignmentObjective: undefined,
  }
}

function excludesFixedDisc(
  discs: CoreWarehouse['discs'],
  recommendation: CandidateWarehouseRecommendation,
  options: CandidateWarehouseOptions,
) {
  const fixedId = options.fixedDiscByAgent?.[recommendation.agentId]
  const fixed = fixedId ? discs.find((disc) => disc.id === fixedId) : undefined
  if (!fixed || !recommendation.constraint) return false
  return !candidateSetPlansForConstraint(recommendation.constraint).some((plan) =>
    [...plan.primarySetIds, ...plan.secondarySetIds].includes(fixed.setId),
  )
}

function firstFeasibleSourceBranch(input: {
  discs: CoreWarehouse['discs']
  recommendation: CandidateWarehouseRecommendation
  options: CandidateWarehouseOptions
}): SourceBranchOptions {
  const { recommendation } = input
  const branches = recommendation.constraint
    ? orderedCandidateSetPlans(candidateSetPlansForConstraint(recommendation.constraint))
    : []
  if (!branches.length)
    return {
      choices: [{ recommendation, sourceRank: 0 }] satisfies SourceBranchChoice[],
      hasIndividuallyFeasibleBranch: true,
      remainingBranches: [],
    }
  const options = agentOnlyOptions(input.options, recommendation.agentId)
  for (let index = 0; index < branches.length; index += 1) {
    const branch = branches[index]!
    const narrowed = candidateRecommendationForSetPlan(recommendation, branch)
    if (excludesFixedDisc(input.discs, narrowed, options)) continue
    const plan = solveCandidateWarehouse(input.discs, [recommendation.agentId], 'agent', options, [
      narrowed,
    ])
    if (!plan.inventoryTransition && plan.loadouts[0]?.discs.length === 6)
      return {
        choices: [{ recommendation: narrowed, sourceRank: 0 }],
        hasIndividuallyFeasibleBranch: true,
        remainingBranches: branches
          .slice(index + 1)
          .map((remaining) => candidateRecommendationForSetPlan(recommendation, remaining)),
      }
  }
  // No source branch can form six legal discs independently. Keep the complete source union so
  // the ordinary solver can return its existing fail-closed diagnostics.
  return {
    choices: [{ recommendation, sourceRank: 0 }],
    hasIndividuallyFeasibleBranch: false,
    remainingBranches: [],
  }
}

function completeFeasibleSourceBranches(
  input: Pick<Parameters<typeof firstFeasibleSourceBranch>[0], 'discs' | 'options'>,
  first: SourceBranchOptions,
) {
  if (!first.hasIndividuallyFeasibleBranch || !first.remainingBranches.length) return first
  const choices = [...first.choices]
  for (const recommendation of first.remainingBranches) {
    const options = agentOnlyOptions(input.options, recommendation.agentId)
    if (excludesFixedDisc(input.discs, recommendation, options)) continue
    const plan = solveCandidateWarehouse(input.discs, [recommendation.agentId], 'agent', options, [
      recommendation,
    ])
    if (!plan.inventoryTransition && plan.loadouts[0]?.discs.length === 6)
      choices.push({
        recommendation,
        sourceRank:
          candidateSetPlanPriority(recommendation.constraint!.setPlans![0]!) -
          candidateSetPlanPriority(first.choices[0]!.recommendation.constraint!.setPlans![0]!),
      })
  }
  return { ...first, choices, remainingBranches: [] }
}

function orderedBranchCombinations(choicesByAgent: readonly SourceBranchChoice[][]) {
  const compare = (left: SourceBranchChoice[], right: SourceBranchChoice[]) => {
    const leftPreferred = left.filter((choice) => choice.sourceRank === 0).length
    const rightPreferred = right.filter((choice) => choice.sourceRank === 0).length
    return (
      rightPreferred - leftPreferred ||
      left.reduce((sum, choice) => sum + choice.sourceRank, 0) -
        right.reduce((sum, choice) => sum + choice.sourceRank, 0) ||
      left
        .map(sourceBranchChoiceIdentity)
        .join('|')
        .localeCompare(right.map(sourceBranchChoiceIdentity).join('|'))
    )
  }
  // Bound intermediate products as well as expensive team solves.
  return choicesByAgent.reduce<SourceBranchChoice[][]>(
    (partial, choices) =>
      partial
        .flatMap((selected) => choices.map((choice) => [...selected, choice]))
        .sort(compare)
        .slice(0, sourceBranchTeamSolveBudget),
    [[]],
  )
}

function improvesCompletePlan(
  candidate: { plan: CandidateWarehousePlan; combination: SourceBranchChoice[] },
  baseline: { plan: CandidateWarehousePlan; combination: SourceBranchChoice[] },
  objective?: TeamAssignmentObjective,
) {
  const uncertain = (plan: CandidateWarehousePlan) =>
    plan.loadouts.filter((item) => item.degraded).length
  const uncertaintyDelta = uncertain(candidate.plan) - uncertain(baseline.plan)
  if (uncertaintyDelta !== 0) return uncertaintyDelta < 0
  const priority = (choices: SourceBranchChoice[]) =>
    choices.reduce((sum, choice) => sum + choice.sourceRank, 0)
  const priorityDelta = priority(candidate.combination) - priority(baseline.combination)
  if (priorityDelta !== 0) return priorityDelta < 0
  const panelComparisons = candidate.plan.loadouts.map((loadout) =>
    compareCandidatePanelObjective(
      loadout.panelObjective,
      baseline.plan.loadouts.find((item) => item.agentId === loadout.agentId)?.panelObjective,
    ),
  )
  // Never trade away one member's accepted cultivation objective for another member's scalar score.
  if (panelComparisons.some((value) => value > 0)) return false
  if (panelComparisons.some((value) => value < 0)) return true
  const candidateValue = objective?.evaluate(candidate.plan.loadouts)
  const baselineValue = objective?.evaluate(baseline.plan.loadouts)
  if (
    typeof candidateValue === 'number' &&
    Number.isFinite(candidateValue) &&
    typeof baselineValue === 'number' &&
    Number.isFinite(baselineValue) &&
    candidateValue !== baselineValue
  )
    return candidateValue > baselineValue
  return (
    candidateTeamSetScore(candidate.plan.loadouts) > candidateTeamSetScore(baseline.plan.loadouts)
  )
}

function solveSourceOrderedTargetTeam(input: {
  warehouse: CoreWarehouse
  buildIntent: TeamJointBuildIntent
  options: CandidateWarehouseOptions
}) {
  const options = {
    ...input.options,
    candidateGenerationCache: createAccountCandidateGenerationCache(input.warehouse.discs),
  }
  const hasAlternatives = input.buildIntent.recommendations.some(
    (recommendation) =>
      recommendation.constraint &&
      candidateSetPlansForConstraint(recommendation.constraint).length > 1,
  )
  if (!hasAlternatives) {
    return {
      plan: solveCandidateWarehouse(
        input.warehouse.discs,
        [...input.buildIntent.agentIds],
        'team',
        options,
        input.buildIntent.recommendations,
      ),
      branchSearch: {
        status: 'not_needed' as const,
        attempts: 1,
        budget: sourceBranchTeamSolveBudget,
        preferredMemberCount: input.buildIntent.agentIds.length,
      },
    }
  }

  const firstBranchOptions = input.buildIntent.recommendations.map((recommendation) =>
    firstFeasibleSourceBranch({
      discs: input.warehouse.discs,
      recommendation,
      options,
    }),
  )
  if (firstBranchOptions.some((option) => !option.hasIndividuallyFeasibleBranch)) {
    const preferredPartial = solveCandidateWarehouse(
      input.warehouse.discs,
      [...input.buildIntent.agentIds],
      'team',
      options,
      firstBranchOptions.map((option) => option.choices[0]!.recommendation),
    )
    const completionFallback = solveCandidateWarehouse(
      input.warehouse.discs,
      [...input.buildIntent.agentIds],
      'team',
      options,
      input.buildIntent.recommendations,
    )
    if (
      improvesTargetTeamCompletion(completionFallback, preferredPartial, input.buildIntent.agentIds)
    )
      return {
        plan: completionFallback,
        branchSearch: {
          status: 'completion_fallback' as const,
          attempts: 2,
          budget: sourceBranchTeamSolveBudget,
          preferredMemberCount: null,
        },
      }
    return {
      plan: preferredPartial,
      branchSearch: {
        status: 'source_preferred_partial' as const,
        attempts: 2,
        budget: sourceBranchTeamSolveBudget,
        preferredMemberCount: firstBranchOptions.filter(
          (option) => option.hasIndividuallyFeasibleBranch,
        ).length,
      },
    }
  }

  const preferredCombination = firstBranchOptions.map((option) => option.choices[0]!)
  const preferredPlan = solveCandidateWarehouse(
    input.warehouse.discs,
    [...input.buildIntent.agentIds],
    'team',
    options,
    preferredCombination.map((choice) => choice.recommendation),
  )
  const branchOptions = firstBranchOptions.map((first) =>
    completeFeasibleSourceBranches({ discs: input.warehouse.discs, options }, first),
  )
  const combinations = orderedBranchCombinations(branchOptions.map((option) => option.choices))
  const totalCombinations = branchOptions.reduce(
    (count, option) => count * option.choices.length,
    1,
  )
  let bestPartial: { plan: CandidateWarehousePlan; combination: SourceBranchChoice[] } = {
    plan: preferredPlan,
    combination: preferredCombination,
  }
  let attempts = 1
  let completePlansCompared = completeTargetTeamPlan(preferredPlan, input.buildIntent.agentIds)
    ? 1
    : 0
  for (const combination of combinations.slice(1, sourceBranchTeamSolveBudget)) {
    attempts += 1
    const plan = solveCandidateWarehouse(
      input.warehouse.discs,
      [...input.buildIntent.agentIds],
      'team',
      options,
      combination.map((choice) => choice.recommendation),
    )
    if (
      improvesTargetTeamCompletion(plan, bestPartial.plan, input.buildIntent.agentIds) ||
      (completeTargetTeamPlan(plan, input.buildIntent.agentIds) &&
        completeTargetTeamPlan(bestPartial.plan, input.buildIntent.agentIds) &&
        improvesCompletePlan({ plan, combination }, bestPartial, options.teamAssignmentObjective))
    )
      bestPartial = { plan, combination }
    if (!completeTargetTeamPlan(plan, input.buildIntent.agentIds)) continue
    completePlansCompared += 1
  }
  if (completeTargetTeamPlan(bestPartial.plan, input.buildIntent.agentIds)) {
    const preferredMemberCount = bestPartial.combination.filter(
      (choice) => choice.sourceRank === 0,
    ).length
    return {
      plan: bestPartial.plan,
      branchSearch: {
        status:
          preferredMemberCount === input.buildIntent.agentIds.length
            ? ('preferred' as const)
            : ('conflict_fallback' as const),
        attempts,
        budget: sourceBranchTeamSolveBudget,
        preferredMemberCount,
        completePlansCompared,
        searchComplete: totalCombinations <= sourceBranchTeamSolveBudget,
      },
    }
  }
  const completionFallback = solveCandidateWarehouse(
    input.warehouse.discs,
    [...input.buildIntent.agentIds],
    'team',
    options,
    input.buildIntent.recommendations,
  )
  if (
    !improvesTargetTeamCompletion(completionFallback, bestPartial.plan, input.buildIntent.agentIds)
  ) {
    return {
      plan: bestPartial.plan,
      branchSearch: {
        status: 'source_preferred_partial' as const,
        attempts: attempts + 1,
        budget: sourceBranchTeamSolveBudget,
        preferredMemberCount: bestPartial.combination.filter((choice) => choice.sourceRank === 0)
          .length,
      },
    }
  }
  return {
    plan: completionFallback,
    branchSearch: {
      status:
        totalCombinations > sourceBranchTeamSolveBudget
          ? ('budget_fallback' as const)
          : ('completion_fallback' as const),
      attempts: attempts + 1,
      budget: sourceBranchTeamSolveBudget,
      preferredMemberCount: null,
    },
  }
}

/** Explicit, read-only target-team calculation. List/snapshot queries must never call this eagerly. */
export function calculateTargetTeamWarehouseFit(input: {
  warehouse: CoreWarehouse
  buildIntent: TeamJointBuildIntent
  bangbooSelection: BangbooSelection
  teamAssignmentObjective?: TeamAssignmentObjective
}) {
  const { buildIntent } = input
  const memberIds = buildIntent.agentIds
  const { plan, branchSearch } = solveSourceOrderedTargetTeam({
    warehouse: input.warehouse,
    buildIntent,
    options: {
      ...optimizerOptionsFromBuildIntent(buildIntent),
      teamAssignmentObjective: input.teamAssignmentObjective,
    },
  })
  const equipmentRecommendations = projectTeamEquipmentRecommendations({
    memberIds,
    bangbooSelection: input.bangbooSelection,
    roster: input.warehouse.roster,
  })
  const loadouts = plan.loadouts.map((loadout) => ({
    agentId: loadout.agentId,
    discIds: loadout.discs.map((choice) => choice.disc.id),
  }))
  const discIds = loadouts.flatMap((loadout) => loadout.discIds)
  const discsReady =
    loadouts.length === 3 &&
    loadouts.every((loadout) => loadout.discIds.length === 6) &&
    new Set(discIds).size === 18
  const namedDiscGaps = memberIds.flatMap((agentId) => {
    const assigned = loadouts.find((loadout) => loadout.agentId === agentId)?.discIds.length ?? 0
    return assigned === 6 ? [] : [`成员“${agentId}”当前只形成 ${assigned}/6 张可验证实体驱动盘。`]
  })
  const status = discsReady
    ? ('ready' as const)
    : discIds.length > 0
      ? ('partial' as const)
      : ('unavailable' as const)
  const result = {
    contract: 'soda-target-team-warehouse-fit/v2' as const,
    candidateId: buildIntent.exactTeam.candidateId,
    memberIds,
    buildIntent,
    status,
    solverMethod: 'bounded_heuristic' as const,
    exactWithinModel: false as const,
    discCount: discIds.length,
    uniqueDiscCount: new Set(discIds).size,
    totalScore: candidateTeamSetScore(plan.loadouts),
    gaps: [
      ...namedDiscGaps,
      ...plan.gaps,
      ...(branchSearch.status === 'conflict_fallback'
        ? [
            `为避免共用驱动盘，已调整 ${memberIds.length - branchSearch.preferredMemberCount} 名代理人的套装搭配。`,
          ]
        : []),
    ],
    warehousePlan: plan,
    sourceBranchSearch: branchSearch,
    loadouts,
    equipmentRecommendations,
    sideEffect: 'read_only' as const,
    boundary: `${plan.boundary} 仅代理人与驱动盘绑定真实账号状态；音擎与邦布为默认候选推荐，不作为实体库存或完成度门槛。仅在用户显式选择目标队伍后执行，列表、评级与短名单查询不得预加载本求解。`,
  }
  return { ...result, fingerprint: contentHash(result) }
}
