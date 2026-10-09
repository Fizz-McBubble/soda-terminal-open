import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import { stableContentHash } from '../gameDataPacks/types'
import { candidateConstraintToDiscProfile } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import {
  functionalSatisfied,
  type ObjectiveEvaluation,
} from '../calculation/dynamic/objectiveEvidence'
import { searchDynamicAssignments, type RawAssignment } from '../optimizer/dynamicObjectiveSearch'
import {
  compileDynamicCandidateLoadout,
  dynamicLegalInventory,
} from '../optimizer/teamDynamicDomain'
import { toBuildProfile } from '../optimizer/accountBuildCandidates'
import { scoreActualDisc } from '../optimizer/scoreActualDisc'
import { candidateDiscFactKey } from '../optimizer/candidateSearchFacts'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmark'
import { evaluateDevelopmentStatWeights } from './developmentStatWeights'
import { optimizerOptionsFromBuildIntent, type AgentIndependentBuildIntent } from './buildIntent'
import { preservesTeamFunctionalConstraints32 } from './teamFunctionalConstraints32'

export const developmentDynamicSearchPolicy =
  'raw-six-disc-full-objective-r2-functional-preservation'
type SearchDisc = { id: string; slot: number; factsKey: string }
const physicalKey = (discs: readonly DriveDisc[]) =>
  JSON.stringify(discs.toSorted((a, b) => a.slot - b.slot).map((disc) => [disc.slot, disc.id]))

/** Producer for the existing comparison/save journey. Raw game-legal inventory
 * remains available to search; guide scores only seed/order budgeted visits. */
export function searchDevelopmentDynamicCandidates(input: {
  warehouse: CoreWarehouse
  agentId: string
  buildIntent: AgentIndependentBuildIntent
  parameters?: DevelopmentComparisonParameters
  candidates: readonly CandidateWarehousePlan[]
  evaluationBudget?: number
}) {
  const options = optimizerOptionsFromBuildIntent(input.buildIntent)
  const constraint = input.buildIntent.recommendations.find(
    (row) => row.agentId === input.agentId,
  )?.constraint
  const profile = constraint ? candidateConstraintToDiscProfile(constraint) : null
  if (!profile) return { candidates: [...input.candidates], search: null }
  const excluded = new Set(options.excludedDiscIds ?? [])
  const legal = dynamicLegalInventory(input.warehouse.discs).filter(
    (disc) => !excluded.has(disc.id),
  )
  const byId = new Map(legal.map((disc) => [disc.id, disc]))
  const fixedId = options.fixedDiscByAgent?.[input.agentId]
  const fixed = fixedId ? byId.get(fixedId) : undefined
  if (fixedId && !fixed) return { candidates: [...input.candidates], search: null }
  const equippedIds =
    input.warehouse.roster.agents.find((row) => row.agentId === input.agentId)?.equippedDiscIds ??
    []
  // Single-agent equivalent records have the same complete objective. Keep an
  // equipped representative first; physical alternatives remain in the account.
  const equivalents = new Map<string, DriveDisc>()
  for (const disc of legal.toSorted(
    (a, b) =>
      Number(equippedIds.includes(b.id)) - Number(equippedIds.includes(a.id)) ||
      a.id.localeCompare(b.id),
  )) {
    if (fixed && disc.slot === fixed.slot && disc.id !== fixed.id) continue
    const key = candidateDiscFactKey(disc)
    if (!equivalents.has(key)) equivalents.set(key, disc)
  }
  const inventory = [...equivalents.values()]
  const pools = Array.from({ length: 6 }, (_, slot) =>
    inventory.filter((disc) => disc.slot === slot + 1),
  )
  if (pools.some((pool) => !pool.length)) return { candidates: [...input.candidates], search: null }
  const lookup = (discs: readonly DriveDisc[]) =>
    discs.map((disc) => equivalents.get(candidateDiscFactKey(disc)) ?? disc)
  const panelInput = options.panelInputsByAgent?.[input.agentId]
  const compiled = new Map<string, CandidateWarehousePlan>()
  const compile = (discs: DriveDisc[]) => {
    const key = physicalKey(discs)
    if (compiled.has(key)) return compiled.get(key)!
    const loadout = compileDynamicCandidateLoadout(
      discs,
      { ...profile, agentId: input.agentId },
      panelInput,
    )
    if (!loadout) return null
    const plan: CandidateWarehousePlan = {
      scope: 'agent',
      agentIds: [input.agentId],
      loadouts: [loadout],
      totalScore: loadout.totalScore,
      alternatives: [],
      gaps: [],
      solver: {
        method: 'bounded_heuristic',
        exactWithinModel: false,
        domain: 'single_agent_six_discs',
      },
      boundary:
        '按相同条件完整比较合法六盘。搜索预算有限；仅在已覆盖的比较目标内取舍，未计入的收益保持未知。',
    }
    compiled.set(key, plan)
    return plan
  }
  const sides = new Map<string, ValueBenchmarkSide>()
  const side = (discs: DriveDisc[]) => {
    const key = physicalKey(discs)
    if (!sides.has(key))
      sides.set(key, evaluateDevelopmentValueBenchmarkSide({ ...input, discs, stale: false }))
    return sides.get(key)!
  }
  const originalDiscs = input.candidates.map((plan) =>
    plan.loadouts[0]!.discs.map((row) => row.disc),
  )
  const equipped = equippedIds
    .map((id) => byId.get(id))
    .filter((disc): disc is DriveDisc => Boolean(disc))
  const sourceProfile = toBuildProfile(profile)
  const initial =
    equipped.length === 6 && compile(lookup(equipped))
      ? lookup(equipped)
      : originalDiscs.length
        ? lookup(originalDiscs[0]!)
        : pools.map(
            (pool) =>
              pool.toSorted(
                (a, b) =>
                  scoreActualDisc(b, sourceProfile).score -
                    scoreActualDisc(a, sourceProfile).score || a.id.localeCompare(b.id),
              )[0]!,
          )
  const baseline = side(initial)
  // A single prepared anomaly settlement has no sourced elapsed cycle and is
  // deliberately not a full actor objective. Its comparison remains available
  // in the existing player flow; it must not overwrite whole-loadout ranking.
  if (baseline.coverage?.domain === 'prepared_anomaly_settlement')
    return { candidates: [...input.candidates], search: null }
  const baselinePanel = compile(initial)?.loadouts[0]?.panelObjective
  const utilityStats = (value: ValueBenchmarkSide) =>
    new Map(
      value.functionalStats32
        ? [
            [
              input.agentId,
              [
                value.functionalStats32.impact,
                value.functionalStats32.enerRegen,
                value.functionalStats32.anomMas,
                value.functionalStats32.anomProf,
              ],
            ] as const,
          ]
        : [],
    )
  const baselineUtility = utilityStats(baseline)
  const weightCache = new Map<string, ReturnType<typeof evaluateDevelopmentStatWeights>>()
  const hints = (discs: DriveDisc[]) => {
    const key = physicalKey(discs)
    if (!weightCache.has(key))
      weightCache.set(key, evaluateDevelopmentStatWeights({ ...input, discs, stale: false }))
    const rows = weightCache.get(key)!.rows
    return (disc: DriveDisc) => {
      const main = resolveDriveDiscMainStatValue(disc)
      const lines = [
        ...disc.subStats,
        ...(main ? [{ stat: disc.mainStat, value: main.value }] : []),
      ]
      return (
        lines.reduce((sum, line) => {
          const row = rows.find((row) => row.stat === line.stat)
          return (
            sum +
            (row?.normalizedWeight == null ? 0 : (line.value / row.step) * row.normalizedWeight)
          )
        }, 0) +
        scoreActualDisc(disc, sourceProfile).score * 0.0001
      )
    }
  }
  const initialHint = hints(initial)
  const orderedPools = pools.map((pool) =>
    pool.toSorted((a, b) => initialHint(b) - initialHint(a) || a.id.localeCompare(b.id)),
  )
  const seeds: DriveDisc[][] = [
    initial,
    ...originalDiscs.map(lookup),
    orderedPools.map((pool) => pool[0]!),
  ]
  // Complete four-piece changes are explicit seeds: they can cross a valley
  // that no one-/two-disc move improves. All sets still remain in the raw domain.
  for (const setId of [...new Set(inventory.map((disc) => disc.setId))]) {
    const possible = orderedPools
      .map((pool, slot) => ({ slot, disc: pool.find((disc) => disc.setId === setId) }))
      .filter((row) => row.disc)
    if (possible.length < 4) continue
    for (let rotation = 0; rotation < Math.min(3, possible.length); rotation++) {
      const selected = orderedPools.map((pool) => pool[0]!)
      for (let offset = 0; offset < 4; offset++) {
        const row = possible[(rotation + offset) % possible.length]!
        selected[row.slot] = row.disc!
      }
      seeds.push(selected)
    }
  }
  const raw = (discs: readonly DriveDisc[]): SearchDisc[] =>
    discs.map((disc) => ({ id: disc.id, slot: disc.slot, factsKey: candidateDiscFactKey(disc) }))
  const assignment = (discs: DriveDisc[]): RawAssignment<SearchDisc> => ({
    [input.agentId]: raw(discs),
  })
  const unwrap = (value: RawAssignment<SearchDisc>) =>
    value[input.agentId]!.map((disc) => byId.get(disc.id)!)
  const evaluate = (value: RawAssignment<SearchDisc>): ObjectiveEvaluation => {
    const discs = unwrap(value),
      current = side(discs),
      plan = compile(discs)
    const comparison = compareValueBenchmarkSides({
      baseline,
      candidate: current,
      changedDimensions: ['disc_loadout'],
      labels: { baseline: '当前六盘', candidate: '仓库方案' },
    })
    const context = current.dimensions
    const panel = plan?.loadouts[0]?.panelObjective
    const protectedCapacity =
      baseline.functionalCapacities32?.status === 'supported' &&
      current.functionalCapacities32?.status === 'supported' &&
      baselineUtility.size === 1 &&
      preservesTeamFunctionalConstraints32({
        baselineCapacities: baseline.functionalCapacities32.capacities,
        candidateCapacities: current.functionalCapacities32.capacities,
        baselineUtility,
        candidateUtility: utilityStats(current),
      })
    return {
      context: {
        gameVersion: context.game_version,
        subjectKey: context.subject,
        scenarioKey: context.scenario,
        formulaKey: `${context.formula}:${context.runtime}:${context.w_engine}`,
        objectiveKey: developmentDynamicSearchPolicy,
        mode: 'fixed_events',
        policyKey: context.event_set,
        horizon: Number(context.duration),
      },
      inputKey: current.calculationFingerprint ?? stableContentHash(discs),
      eventKey: context.event_set,
      status:
        current.state === 'supported' && comparison.comparable && protectedCapacity
          ? 'evaluated'
          : 'unavailable',
      modeledValue: current.totalDamage,
      error: 0,
      gaps: [
        ...new Map(
          (current.coverage?.excludedEffects ?? []).map((effect) => [
            effect.effectKey,
            {
              id: effect.effectKey,
              expressionKey: stableContentHash(effect),
              dependencies: effect.fields,
              dependenciesComplete: false,
              composition: 'interaction' as const,
              sourceRefs: effect.sourceRefs,
            },
          ]),
        ).values(),
      ],
      dependencies: {},
      legality: plan ? 'verified' : 'invalid',
      stale: false,
      functional: baselinePanel
        ? {
            attack: {
              actual: panel ? -panel.attackDeficit : null,
              minimum: -baselinePanel.attackDeficit,
              authorityKey: stableContentHash(baselinePanel.priorityStat ?? 'anomalyProficiency'),
            },
            priority: {
              actual: panel?.[baselinePanel.priorityStat ?? 'anomalyProficiency'] ?? null,
              minimum:
                baselinePanel[baselinePanel.priorityStat ?? 'anomalyProficiency'] ?? Number.NaN,
              authorityKey: baselinePanel.priorityStat ?? 'anomalyProficiency',
            },
          }
        : {},
    }
  }
  const result = searchDynamicAssignments({
    domains: [
      {
        agentId: input.agentId,
        slots: pools.map(raw),
        isLegal: (discs) => Boolean(compile(discs.map((disc) => byId.get(disc.id)!))),
      },
    ],
    seeds: seeds.map(assignment),
    evaluate,
    hint: (disc, _agent, anchor) =>
      hints(anchor ? unwrap(anchor.loadouts) : initial)(byId.get(disc.id)!),
    budget: { nodes: 30000, evaluations: input.evaluationBudget ?? 384 },
  })
  // Unresolved comparisons retain the original source order. A partial slice
  // never silently wins against an unmodeled effect or missing actual baseline.
  const qualified = result.evaluated
    .filter(
      (row) =>
        row.evaluation.status === 'evaluated' &&
        row.evaluation.gaps.length === 0 &&
        functionalSatisfied(row.evaluation),
    )
    .toSorted((a, b) => {
      const delta = b.evaluation.modeledValue! - a.evaluation.modeledValue!
      const roundoff =
        Number.EPSILON * 32 * Math.max(1, a.evaluation.modeledValue!, b.evaluation.modeledValue!)
      if (Math.abs(delta) > roundoff) return delta
      const swaps = (row: typeof a) =>
        unwrap(row.loadouts).filter((disc) => !equippedIds.includes(disc.id)).length
      return (
        swaps(a) - swaps(b) ||
        physicalKey(unwrap(a.loadouts)).localeCompare(physicalKey(unwrap(b.loadouts)))
      )
    })
  const originalIsComplete = originalDiscs.every((discs) => {
    const value = side(discs)
    return value.state === 'supported' && value.coverage?.excludedEffects.length === 0
  })
  if (!qualified.length || !originalIsComplete)
    return { candidates: [...input.candidates], search: result }
  const unique = new Map<string, CandidateWarehousePlan>()
  for (const row of qualified) {
    const discs = unwrap(row.loadouts),
      plan = compile(discs)
    if (plan) unique.set(physicalKey(discs), plan)
  }
  return { candidates: [...unique.values()].slice(0, 10), search: result }
}
