import { boundedAlternatives } from './boundedCandidateWarehouseAlternatives'
import type { DriveDisc } from '../domain/schemas'
import {
  selectedSourceCondition,
  excludeDisprovenSourcePlans,
} from './candidateWarehouseSourceConditions'
import { compareCandidatePanelObjective } from './optimizeBuild'
import {
  candidateConstraintToDiscProfile,
  candidateSetPlansForConstraint,
  getCandidateWarehouseConstraint,
  type CandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { getAgentProfile } from '../gameDataPacks/agentProfile'
import {
  createAccountCandidateGenerationCache,
  optimizeAccountBuilds,
  type AccountLoadout,
  type AccountOptimizerOptions,
} from './optimizeAccountBuilds'
import type { CandidateWarehouseRecommendation } from '../gameDataPacks/candidateWarehouseConstraints'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import { candidateTransitionProfile, transitionWarehouseNote } from './candidateTransitionWarehouse'
import {
  candidateLoadoutSourcePlanRank,
  candidateLoadoutMatchesSetPlan,
} from './candidateWarehouseAlternativeRanking'
import { orderedCandidateSetPlans } from '../gameDataPacks/candidateSetPlanPolicy'

export type CandidateWarehousePlan = {
  scope: 'agent' | 'team' | 'portfolio'
  agentIds: string[]
  loadouts: AccountLoadout[]
  totalScore: number
  alternatives: AccountLoadout[]
  gaps: string[]
  solver?: {
    method: 'bounded_heuristic'
    exactWithinModel: false
    search?: NonNullable<ReturnType<typeof optimizeAccountBuilds>['teamSearch']>
    domain:
      | 'single_agent_six_discs'
      | 'target_team_three_agents_eighteen_discs'
      | 'target_portfolio_mutually_exclusive_discs'
  }
  boundary: string
  panelObjectiveNote?: string
  /** Inventory feasibility fallback, never a sourced set-combination recommendation. */
  inventoryTransition?: true
}

export {
  solveExactTeamWarehouseFitOracle,
  type ExactTeamWarehouseFitOracleResult,
} from './exactTeamWarehouseFitOracle'
import { loadoutKey } from './exactTeamWarehouseFitOracle'

export type CandidateWarehouseOptions = Pick<
  AccountOptimizerOptions,
  | 'fixedDiscByAgent'
  | 'excludedDiscIds'
  | 'allowLocked'
  | 'priorityAgentIds'
  | 'panelInputsByAgent'
  | 'teamAssignmentObjective'
  | 'candidateGenerationCache'
>

export { createAccountCandidateGenerationCache }

const boundary =
  '候选仓库匹配分只比较目标成员的实际驱动盘、套装、主词条和有效副词条强化；生产求解当前为 bounded heuristic，不代表 DPS、最高伤害、全仓正式最优或自动装备。'

export function candidateConstraintForAgent(agentId: string): CandidateWarehouseConstraint | null {
  const constraint = getCandidateWarehouseConstraint(agentId)
  if (constraint?.status !== 'candidate') return null
  // 3.1 catalogue intake is a separate candidate layer until the agent receives a
  // formal game ID/Profile projection. Do not let the 3.0-only profile fallback
  // erase an otherwise sourced candidate warehouse constraint.
  if (constraint.gameVersion === '3.1') return constraint
  return getAgentProfile(agentId).warehouseStatus === 'candidate' ? constraint : null
}

function candidateConstraintFromIntent(
  agentId: string,
  recommendations?: readonly CandidateWarehouseRecommendation[],
): CandidateWarehouseConstraint | null {
  const compiled = recommendations?.find((item) => item.agentId === agentId)
  if (recommendations) return compiled?.constraint ?? null
  return candidateConstraintForAgent(agentId)
}

/** Keep a source-declared set branch intact when a caller compares or coordinates its discs. */
export function candidateRecommendationForSetPlan(
  recommendation: CandidateWarehouseRecommendation,
  branch: CandidateSetPlan,
): CandidateWarehouseRecommendation {
  if (!recommendation.constraint)
    throw new Error(`代理人 ${recommendation.agentId} 缺少可绑定套装分支的候选约束。`)
  return {
    agentId: recommendation.agentId,
    // Preserve the complete allowed set domain; order does not contribute to score.
    constraint: {
      ...recommendation.constraint,
      setPlans: [branch],
      setPlanReadiness: { status: 'executable', ...branch },
    },
  }
}

export function getCandidateWarehouseProfiles(
  agentIds: string[],
  availableSetIds: string[],
  recommendations?: readonly CandidateWarehouseRecommendation[],
) {
  return agentIds.flatMap((agentId) => {
    const constraint = candidateConstraintFromIntent(agentId, recommendations)
    const profile = constraint ? candidateConstraintToDiscProfile(constraint) : null
    if (!profile) return []
    // Candidate constraints can retain a historical evidence id while the
    // account and solver use the released stable id. Keep provenance on the
    // constraint, but solve and return the plan for the selected account agent.
    const accountProfile = { ...profile, agentId }
    if (constraint!.setIds.length > 1) return [accountProfile]
    return [
      {
        ...accountProfile,
        setPlans: [
          {
            pattern: '4+2' as const,
            primarySets: [constraint!.setIds[0]!],
            // The source supports the 4-piece direction but does not claim a specific 2-piece.
            // Keep the unscored two-piece explicit in the result instead of fabricating a set bonus.
            secondarySets: availableSetIds.filter((setId) => setId !== constraint!.setIds[0]),
          },
        ],
      },
    ]
  })
}

function asGaps(
  agentIds: string[],
  resolvedIds: string[],
  diagnostics: ReturnType<typeof optimizeAccountBuilds>['diagnostics'],
) {
  return [
    ...agentIds
      .filter((agentId) => !resolvedIds.includes(agentId))
      .map(() => '该角色缺少可消费的候选仓库约束。'),
    ...diagnostics.flatMap((item) => item.reasons),
  ]
}

/**
 * Adapts only the sourced candidate constraints to the existing concrete-disc solver.
 * Standalone matching does not request a damage calculation. The explicit target-team
 * caller may supply a fixed-event objective to search raw legal disc assignments.
 */
export function solveCandidateWarehouse(
  discs: DriveDisc[],
  agentIds: string[],
  scope: CandidateWarehousePlan['scope'],
  options: CandidateWarehouseOptions = {},
  recommendations?: readonly CandidateWarehouseRecommendation[],
): CandidateWarehousePlan {
  let profiles = getCandidateWarehouseProfiles(
    agentIds,
    [...new Set(discs.map((disc) => disc.setId))],
    recommendations,
  )
  const solveOptions = {
    ...options,
    // A single-agent development recommendation still coordinates against the
    // account cultivation queue. Only active plans occupy discs; alternatives do not.
    priorityAgentIds: options.priorityAgentIds ?? (scope === 'agent' ? [] : agentIds),
  }
  let result = optimizeAccountBuilds(discs, profiles, solveOptions)
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
    result = optimizeAccountBuilds(discs, profiles, solveOptions)
  }
  // A sourced six-disc result always takes precedence. This fallback proves only
  // one selected agent's transition use; it does not widen team/source authority.
  let transitionUsed = false
  if (scope === 'agent' && agentIds.length === 1 && !result.independent.length) {
    const agentId = agentIds[0]!
    const constraint = candidateConstraintFromIntent(agentId, recommendations)
    const transition = constraint ? candidateTransitionProfile(agentId, constraint, discs) : null
    if (transition) {
      const fallback = optimizeAccountBuilds(discs, [transition], solveOptions)
      if (fallback.independent.some((loadout) => loadout.discs.length === 6)) {
        profiles = [transition]
        result = fallback
        transitionUsed = true
      }
    }
  }
  let loadouts =
    scope !== 'agent'
      ? agentIds.flatMap((agentId) => result.global.filter((item) => item.agentId === agentId))
      : result.independent
          .filter((item) => item.agentId === agentIds[0])
          .map((item) =>
            transitionUsed
              ? {
                  ...item,
                  degraded: true,
                  degradeReasons: [...item.degradeReasons, transitionWarehouseNote],
                }
              : item,
          )
  const sourceConditionGaps = loadouts.flatMap((loadout) => {
    const condition = selectedSourceCondition(
      loadout,
      loadouts,
      agentIds,
      candidateConstraintFromIntent(loadout.agentId, effectiveRecommendations),
    )
    if (!condition) return []
    return condition.status === 'condition-not-met' || condition.status === 'condition-unknown'
      ? [condition.reason]
      : []
  })
  loadouts = loadouts.map((loadout) => {
    const constraint = candidateConstraintFromIntent(loadout.agentId, effectiveRecommendations)
    const matchingPlans = constraint
      ? candidateSetPlansForConstraint(constraint).filter((plan) =>
          candidateLoadoutMatchesSetPlan(loadout, plan),
        )
      : []
    if (matchingPlans.length && matchingPlans.every((plan) => plan.purpose === 'transition')) {
      transitionUsed = true
      return {
        ...loadout,
        degraded: true,
        degradeReasons: [...loadout.degradeReasons, transitionWarehouseNote],
      }
    }
    const condition = selectedSourceCondition(
      loadout,
      loadouts,
      agentIds,
      candidateConstraintFromIntent(loadout.agentId, effectiveRecommendations),
    )
    return condition?.status === 'condition-not-met' || condition?.status === 'condition-unknown'
      ? {
          ...loadout,
          degraded: true,
          degradeReasons: [...loadout.degradeReasons, condition.reason],
        }
      : loadout
  })
  const alternatives = scope === 'agent' ? loadouts.slice(1) : []
  const gaps = [
    ...sourceConditionGaps,
    ...rejectedConditions
      .filter(
        (condition) =>
          !loadouts.some(
            (loadout) => loadout.agentId === condition.agentId && loadout.discs.length === 6,
          ),
      )
      .map((condition) => condition.reason),
  ]
    .concat(
      asGaps(
        agentIds,
        profiles.map((profile) => profile.agentId),
        result.diagnostics,
      ),
    )
    .concat(loadouts.flatMap((loadout) => loadout.degradeReasons))
    .concat(
      agentIds
        .filter(
          (agentId) => candidateConstraintFromIntent(agentId, recommendations)?.setIds.length === 1,
        )
        .map(() => '来源未指定第二个 2 件套；该两件套仅作未评分库存补位。'),
    )
  return {
    scope,
    agentIds,
    loadouts,
    totalScore:
      Math.round(loadouts.reduce((total, item) => total + item.totalScore, 0) * 100) / 100,
    alternatives,
    gaps: [...new Set(gaps)],
    solver: {
      method: 'bounded_heuristic',
      exactWithinModel: false,
      ...(result.teamSearch ? { search: result.teamSearch } : {}),
      domain:
        scope === 'agent'
          ? 'single_agent_six_discs'
          : agentIds.length === 3
            ? 'target_team_three_agents_eighteen_discs'
            : 'target_portfolio_mutually_exclusive_discs',
    },
    boundary: transitionUsed ? `${boundary} ${transitionWarehouseNote}` : boundary,
    ...(transitionUsed ? { inventoryTransition: true as const } : {}),
    ...(loadouts.some((loadout) => loadout.panelObjectiveStatus)
      ? {
          panelObjectiveNote: loadouts
            .filter((loadout) => loadout.panelObjectiveStatus)
            .flatMap((loadout) => loadout.degradeReasons)
            .join('；'),
        }
      : {}),
  }
}

export function solveCandidateAgentAlternatives(
  discs: DriveDisc[],
  agentId: string,
  limit = 3,
  options: CandidateWarehouseOptions = {},
  recommendations?: readonly CandidateWarehouseRecommendation[],
): CandidateWarehousePlan[] {
  const constraint = candidateConstraintFromIntent(agentId, recommendations)
  const sourcePlans = constraint
    ? orderedCandidateSetPlans(candidateSetPlansForConstraint(constraint))
    : []
  const global = boundedAlternatives(discs, limit, [agentId], (excluded) =>
    solveCandidateWarehouse(
      discs,
      [agentId],
      'agent',
      {
        ...options,
        excludedDiscIds: [...new Set([...(options.excludedDiscIds ?? []), ...excluded])],
      },
      recommendations,
    ),
  )
  if (!global.length || !constraint) return global
  // Retain a feasible representative of each adopted recommendation. Secondary
  // sets inside one branch are alternatives, not an invented efficacy ranking.
  const branches = sourcePlans.flatMap((plan) =>
    plan.pattern === '4+2'
      ? [...plan.primarySetIds].sort().flatMap((primary) =>
          [...plan.secondarySetIds]
            .sort()
            .filter((secondary) => secondary !== primary)
            .map((secondary) => ({
              ...plan,
              primarySetIds: [primary],
              secondarySetIds: [secondary],
            })),
        )
      : [plan],
  )
  const representatives = branches.slice(0, 10).flatMap((branch) => {
    const plan = solveCandidateWarehouse(discs, [agentId], 'agent', options, [
      {
        agentId,
        constraint: {
          ...constraint,
          setPlans: [branch],
          setPlanReadiness: { status: 'executable', ...branch },
        },
      },
    ])
    return !plan.inventoryTransition && plan.loadouts[0]?.discs.length === 6 ? [plan] : []
  })
  const count = Math.min(10, Math.floor(limit))
  const unique = new Map(
    [global[0]!, ...representatives].map((plan) => [loadoutKey(plan.loadouts), plan]),
  )
  for (const plan of global) {
    if (unique.size >= count) break
    unique.set(loadoutKey(plan.loadouts), plan)
  }
  return [...unique.values()]
    .sort(
      (a, b) =>
        Number(Boolean(a.loadouts[0]?.degraded)) - Number(Boolean(b.loadouts[0]?.degraded)) ||
        candidateLoadoutSourcePlanRank(a.loadouts[0], sourcePlans) -
          candidateLoadoutSourcePlanRank(b.loadouts[0], sourcePlans) ||
        compareCandidatePanelObjective(
          a.loadouts[0]?.panelObjective,
          b.loadouts[0]?.panelObjective,
        ) ||
        b.totalScore - a.totalScore ||
        loadoutKey(a.loadouts).localeCompare(loadoutKey(b.loadouts)),
    )
    .slice(0, count)
}

/** Team alternatives retain per-plan physical exclusivity without locking independent saved teams. */
export function solveCandidateTeamAlternatives(
  discs: DriveDisc[],
  agentIds: string[],
  limit = 3,
): CandidateWarehousePlan[] {
  return boundedAlternatives(discs, limit, agentIds, (excluded) =>
    solveCandidateWarehouse(discs, agentIds, 'team', { excludedDiscIds: excluded }),
  )
}
