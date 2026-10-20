import {
  candidateConstraintFromIntent,
  getCandidateWarehouseProfiles,
} from './candidateWarehouseProfiles'
export {
  candidateConstraintForAgent,
  getCandidateWarehouseProfiles,
} from './candidateWarehouseProfiles'
import { boundedAlternatives } from './boundedCandidateWarehouseAlternatives'
import type { DriveDisc } from '../domain/schemas'
import {
  selectedSourceCondition,
  excludeDisprovenSourcePlans,
} from './candidateWarehouseSourceConditions'
import { compareCandidatePanelObjective } from './optimizeBuild'
import { candidateSetPlansForConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
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
import { compareCandidateEffectiveCritObjective } from './candidateEffectiveCritObjective'

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
  | 'effectiveCritObjectivesByAgent'
  | 'teamAssignmentObjective'
  | 'candidateGenerationCache'
>

export { createAccountCandidateGenerationCache }

const boundary =
  '候选仓库匹配分只比较目标成员的实际驱动盘、套装、主词条和有效副词条强化；生产求解当前为 bounded heuristic，不代表 DPS、最高伤害、全仓正式最优或自动装备。'

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

function asGaps(
  agentIds: string[],
  resolvedIds: string[],
  diagnostics: ReturnType<typeof optimizeAccountBuilds>['diagnostics'],
  filtered: boolean,
) {
  return [
    ...agentIds
      .filter((agentId) => !resolvedIds.includes(agentId))
      .map(() => '该角色缺少可消费的候选仓库约束。'),
    ...diagnostics.flatMap((item) => [
      ...item.reasons.map((reason) =>
        reason
          .replace('该场景允许的套装盘', '推荐套装的驱动盘')
          .replace('Profile允许的完整', '推荐的完整'),
      ),
      ...item.actions.filter(
        (action) =>
          !action.includes('切换') &&
          !action.includes('场景') &&
          (filtered || !action.includes('取消')),
      ),
    ]),
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
  if (scope === 'agent' && agentIds.length === 1 && result.independent[0]) {
    const agentId = agentIds[0]!
    const currentConstraints = agentIds.map((id) => ({
      agentId: id,
      constraint: candidateConstraintFromIntent(id, effectiveRecommendations),
    }))
    const selected = result.independent[0]
    const currentConstraint = currentConstraints[0]?.constraint
    const selectedAsTransition = currentConstraint
      ? candidateSetPlansForConstraint(currentConstraint).some(
          (plan) => plan.purpose === 'transition' && candidateLoadoutMatchesSetPlan(selected, plan),
        )
      : false
    if (selectedAsTransition) {
      const sourceOnlyRecommendations = currentConstraints.map((row) => ({
        ...row,
        constraint: row.constraint && {
          ...row.constraint,
          setPlans: candidateSetPlansForConstraint(row.constraint).filter(
            (plan) => plan.purpose !== 'transition',
          ),
        },
      }))
      const sourceProfiles = getCandidateWarehouseProfiles(
        agentIds,
        [...new Set(discs.map((disc) => disc.setId))],
        sourceOnlyRecommendations,
      )
      const sourceResult = optimizeAccountBuilds(discs, sourceProfiles, solveOptions)
      if (
        sourceResult.independent.some(
          (loadout) => loadout.agentId === agentId && loadout.discs.length === 6,
        )
      ) {
        effectiveRecommendations = sourceOnlyRecommendations
        profiles = sourceProfiles
        result = sourceResult
      }
    }
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
  const conditionalPlanGaps =
    scope === 'agent' && agentIds.length === 1 && !loadouts.length
      ? (() => {
          const constraint = candidateConstraintFromIntent(agentIds[0]!, recommendations)
          return constraint ? candidateSetPlansForConstraint(constraint) : []
        })()
          .filter((plan) => Boolean(plan.condition))
          .map(
            (plan) =>
              `来源条件方案需要完整、唯一三人队伍与对应队友条件：${plan.sourceText ?? plan.primarySetIds.join(' + ')}`,
          )
      : []
  const alternatives = scope === 'agent' ? loadouts.slice(1) : []
  const gaps = [
    ...(!loadouts.length
      ? !discs.length
        ? ['当前账户还没有驱动盘，请先扫描或导入仓库。']
        : options.excludedDiscIds?.length || Object.keys(options.fixedDiscByAgent ?? {}).length
          ? ['当前固定或排除条件下没有完整配装；可取消冲突条件后重新搭配。']
          : ['当前仓库暂不满足推荐套装与六个号位的组合；请补充以下库存后重新搭配。']
      : []),
    ...conditionalPlanGaps,
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
        Boolean(
          options.excludedDiscIds?.length || Object.keys(options.fixedDiscByAgent ?? {}).length,
        ),
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
    gaps:
      !discs.length && !loadouts.length
        ? ['当前账户还没有驱动盘，请先扫描或导入仓库。']
        : [...new Set(gaps)],
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
  const global = boundedAlternatives(
    discs,
    limit,
    [agentId],
    (excluded) =>
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
    options.fixedDiscByAgent?.[agentId] ? [options.fixedDiscByAgent[agentId]!] : [],
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
    const fixedId = options.fixedDiscByAgent?.[agentId]
    const fixedDisc = fixedId ? discs.find((disc) => disc.id === fixedId) : undefined
    // A fixed disc selects a feasible subset of the source branches. It must
    // not make an unrelated representative abort the entire alternatives list.
    if (
      fixedDisc &&
      ![...branch.primarySetIds, ...branch.secondarySetIds].includes(fixedDisc.setId)
    )
      return []
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
  // One branch can contribute several better event-scored physical solutions.
  // Merge them all before the final count cut; source representatives do not
  // reserve that quota or erase an already discovered stronger alternative.
  const unique = new Map(
    [...representatives, ...global].map((plan) => [loadoutKey(plan.loadouts), plan]),
  )
  return [...unique.values()]
    .sort(
      (a, b) =>
        Number(Boolean(a.loadouts[0]?.degraded)) - Number(Boolean(b.loadouts[0]?.degraded)) ||
        compareCandidatePanelObjective(
          a.loadouts[0]?.panelObjective,
          b.loadouts[0]?.panelObjective,
        ) ||
        compareCandidateEffectiveCritObjective(
          a.loadouts[0]?.effectiveCritObjective,
          b.loadouts[0]?.effectiveCritObjective,
        ) ||
        candidateLoadoutSourcePlanRank(a.loadouts[0], sourcePlans) -
          candidateLoadoutSourcePlanRank(b.loadouts[0], sourcePlans) ||
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
