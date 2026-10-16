import type { CoreWarehouse } from '../accounts/coreFlow'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { candidateSetPlansForConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { candidateLoadoutSourcePlanRank } from '../optimizer/candidateWarehouseAlternativeRanking'
import { compareCandidatePanelPriority } from '../optimizer/candidateSearchFacts'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { refineComparableCandidatePool } from '../optimizer/refineComparableCandidatePool'
import type { AgentIndependentBuildIntent } from './buildIntent'
import {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentValueBenchmarkEvaluator,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmark'
import { sourceReviewedProtectedUtilityIndices32 } from './teamFunctionalConstraints32'

export const developmentCandidateRankingVersion = 'same-source-fixed-event-slice-r1'
export type DevelopmentCandidateRankingScope =
  | 'fixed_event_slice'
  | 'declared_event'
  | 'panel_target'

/** Rank before comparison parameters, panel rows and saved identities are bound to ranks.
 * Limited coverage ranks only the declared slice, preserving source priority and utility;
 * its exclusions are retained and never treated as cancelling overall damage. */
export function rankDevelopmentCandidates(input: {
  evaluator?: DevelopmentValueBenchmarkEvaluator
  warehouse: CoreWarehouse
  agentId: string
  candidates: readonly CandidateWarehousePlan[]
  buildIntent: AgentIndependentBuildIntent
  parameters?: DevelopmentComparisonParameters
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclaration?: import('../calculation/reviewedTemplateEventConditions32').ReviewedTemplateEventConditionDeclaration32
}) {
  const direct = ['attack', 'rupture', 'armorer'].includes(
    getCurrentAgentEventContract(input.agentId)?.identity.specialty ?? '',
  )
  const records = (plan: CandidateWarehousePlan) =>
    plan.loadouts[0]?.discs.map((row) => row.disc) ?? []
  const key = (plan: CandidateWarehousePlan) =>
    JSON.stringify(
      records(plan)
        .toSorted((a, b) => a.slot - b.slot)
        .map((disc) => [disc.slot, disc.id]),
    )
  const sides = new Map<CandidateWarehousePlan, ValueBenchmarkSide>()
  const side = (plan: CandidateWarehousePlan) => {
    if (!sides.has(plan))
      sides.set(
        plan,
        (input.evaluator ?? evaluateDevelopmentValueBenchmarkSide)({
          ...input,
          discs: records(plan),
          stale: false,
        }),
      )
    return sides.get(plan)!
  }
  const constraint = input.buildIntent.recommendations.find(
    (row) => row.agentId === input.agentId,
  )?.constraint
  const sourcePlans = constraint ? candidateSetPlansForConstraint(constraint) : []
  const protectedIndices = sourceReviewedProtectedUtilityIndices32(input.agentId)
  const utility = (value: ValueBenchmarkSide) => {
    const stats = value.functionalStats32
    if (!stats) return null
    const values = [stats.impact, stats.enerRegen, stats.anomMas, stats.anomProf]
    return protectedIndices.every((index) => Number.isFinite(values[index]))
      ? protectedIndices.map((index) => values[index])
      : null
  }
  const coverage = (value: ValueBenchmarkSide) =>
    value.coverage
      ? [
          value.coverage.domain,
          [...value.coverage.includedEffectKeys].sort(),
          value.coverage.excludedEffects
            .map((effect) => [
              effect.effectKey,
              effect.reason,
              [...effect.fields].sort(),
              [...effect.sourceRefs].sort(),
            ])
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        ]
      : null
  const comparable = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) => {
    const left = side(a),
      right = side(b)
    if (
      left.state !== 'supported' ||
      right.state !== 'supported' ||
      !Number.isFinite(left.totalDamage) ||
      !Number.isFinite(right.totalDamage)
    )
      return false
    const leftPanel = a.loadouts[0]?.panelObjective,
      rightPanel = b.loadouts[0]?.panelObjective
    if (Boolean(leftPanel) !== Boolean(rightPanel)) return false
    if (
      leftPanel &&
      rightPanel &&
      (leftPanel.priorityStat ?? 'anomalyProficiency') !==
        (rightPanel.priorityStat ?? 'anomalyProficiency')
    )
      return false
    if (!direct && !leftPanel) return false
    if (
      left.coverage?.domain !== 'fixed_event_direct_damage' ||
      right.coverage?.domain !== 'fixed_event_direct_damage'
    )
      return false
    return compareValueBenchmarkSides({
      baseline: left,
      candidate: right,
      changedDimensions: ['disc_loadout'],
      labels: { baseline: '同条件候选', candidate: '同条件候选' },
    }).comparable
  }
  const group = (plan: CandidateWarehousePlan) => {
    const value = side(plan)
    const complete = value.coverage?.excludedEffects.length === 0
    return JSON.stringify([
      plan.inventoryTransition ?? false,
      plan.loadouts[0]?.degraded ?? false,
      plan.loadouts[0]?.panelObjectiveStatus ?? null,
      utility(value),
      // A complete objective can compare all sets; an incomplete slice cannot
      // overrule an explicitly ranked source branch or different missing effects.
      complete
        ? 'covered'
        : [candidateLoadoutSourcePlanRank(plan.loadouts[0], sourcePlans), coverage(value)],
    ])
  }
  const equippedIds =
    input.warehouse.roster.agents.find((row) => row.agentId === input.agentId)?.equippedDiscIds ??
    []
  const equipped = equippedIds.flatMap(
    (id) => input.warehouse.discs.find((disc) => disc.id === id) ?? [],
  )
  const hasBaseline =
    equippedIds.length === 6 &&
    new Set(equippedIds).size === 6 &&
    equipped.length === 6 &&
    new Set(equipped.map((disc) => disc.slot)).size === 6
  const swaps = (plan: CandidateWarehousePlan) =>
    hasBaseline ? records(plan).filter((disc) => !equippedIds.includes(disc.id)).length : 0
  const candidates = refineComparableCandidatePool(input.candidates, [], {
    key,
    group,
    comparable: (a, b) =>
      utility(side(a)) !== null && utility(side(b)) !== null && comparable(a, b),
    compare: (a, b) => {
      const left = a.loadouts[0]?.panelObjective,
        right = b.loadouts[0]?.panelObjective
      // Support thresholds answer a different question from personal damage.
      if (left && right) return compareCandidatePanelPriority(left, right)
      const before = side(a).totalDamage!,
        after = side(b).totalDamage!
      const epsilon = Number.EPSILON * 32 * Math.max(1, Math.abs(before), Math.abs(after))
      return Math.abs(after - before) > epsilon ? after - before : swaps(a) - swaps(b)
    },
  })
  const rankingScopes = [
    ...new Set(
      candidates.flatMap((plan, index): DevelopmentCandidateRankingScope[] => {
        if (plan === input.candidates[index]) return []
        return [
          plan.loadouts[0]?.panelObjective
            ? 'panel_target'
            : side(plan).coverage!.excludedEffects.length
              ? 'fixed_event_slice'
              : 'declared_event',
        ]
      }),
    ),
  ]
  return { candidates, rankingScopes }
}
