import type { CoreWarehouse } from '../accounts/coreFlow'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import type { DriveDisc } from '../domain/schemas'
import { completeScoringDiscSelection, scoringDiscRecordIssue } from '../domain/discScoringInput'
import { driveDiscData } from '../data/gameData'
import { contentHash } from '../application/contentHash'
import { evaluateDevelopmentRecordedDiscs } from '../pages/developmentRecordedDiscEvaluation'
import type { CandidateSetPlanEligibilityContext } from '../gameDataPacks/candidateSetPlanEligibility'
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
  dynamicRecommendableInventory,
} from '../optimizer/teamDynamicDomain'
import { toBuildProfile } from '../optimizer/accountBuildCandidates'
import { scoreActualDisc } from '../optimizer/scoreActualDisc'
import { candidateDiscFactKey } from '../optimizer/candidateSearchFacts'
import { getCandidatePanelObjectiveTarget } from '../optimizer/candidatePanelObjective'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentValueBenchmarkEvaluator,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmark'
import { evaluateDevelopmentStatWeights } from './developmentStatWeights'
import {
  searchPreparedAnomalyCandidates,
  type PreparedAnomalyCandidateRanking,
} from './developmentPreparedAnomalySearch'
import { optimizerOptionsFromBuildIntent, type AgentIndependentBuildIntent } from './buildIntent'
import {
  preservesTeamFunctionalConstraints32,
  sourceReviewedProtectedUtilityIndices32,
} from './teamFunctionalConstraints32'
import {
  summarizeDevelopmentSearchDiagnostics,
  createDevelopmentSearchDiagnosticsRecorder,
  type DevelopmentSearchDiagnostics,
} from './developmentSearchDiagnostics'
import { developmentPanelFunctionalConstraints } from './developmentPanelFunctionalConstraints'
import {
  comparablePersonalFunctionalObjectives32,
  resolvePersonalDevelopmentObjective32,
  scopedPersonalFunctionalProtection32,
} from './personalDevelopmentObjective32'
export { developmentPanelFunctionalConstraints } from './developmentPanelFunctionalConstraints'

export const developmentDynamicSearchPolicy = 'raw-six-disc-full-objective-r3-functional-objective'
type SearchDisc = { id: string; slot: number; factsKey: string }
type DynamicSearchTrace = ReturnType<typeof searchDynamicAssignments<SearchDisc>>
export type DevelopmentDynamicCandidatesResult = {
  candidates: CandidateWarehousePlan[]
  search: DynamicSearchTrace | null
  rankingApplied: boolean
  diagnostics: DevelopmentSearchDiagnostics
  preparedCandidateRanking?: PreparedAnomalyCandidateRanking
  preparedAnomalySearch?: {
    status: 'budget_exhausted' | 'complete' | 'objective_unresolved'
    nodes: number
    evaluations: number
    exactWithinDeclaredModel: boolean
  }
}
const physicalKey = (discs: readonly DriveDisc[]) =>
  JSON.stringify(discs.toSorted((a, b) => a.slot - b.slot).map((disc) => [disc.slot, disc.id]))

/** Producer for the existing comparison/save journey. Raw game-legal inventory
 * remains available to search; guide scores only seed/order budgeted visits. */
export function searchDevelopmentDynamicCandidates(input: {
  evaluator?: DevelopmentValueBenchmarkEvaluator
  warehouse: CoreWarehouse
  agentId: string
  buildIntent: AgentIndependentBuildIntent
  parameters?: DevelopmentComparisonParameters
  eventConditionDeclaration?: import('../calculation/reviewedTemplateEventConditions32').ReviewedTemplateEventConditionDeclaration32
  scenarioSelection?: CurrentPlanningScenarioSelection32
  candidates: readonly CandidateWarehousePlan[]
  evaluationBudget?: number
  conditionContext?: CandidateSetPlanEligibilityContext
}): DevelopmentDynamicCandidatesResult {
  const options = optimizerOptionsFromBuildIntent(input.buildIntent)
  const excluded = new Set(options.excludedDiscIds ?? [])
  const fixedId = options.fixedDiscByAgent?.[input.agentId]
  const legal = dynamicRecommendableInventory(input.warehouse.discs).filter(
    (disc) =>
      !excluded.has(disc.id) &&
      (options.allowLocked !== false || !disc.locked) &&
      scoringDiscRecordIssue(disc, driveDiscData?.rules) === null,
  )
  const byId = new Map(legal.map((disc) => [disc.id, disc]))
  const candidateInputs = input.candidates.filter((plan) => {
    if (plan.loadouts.length !== 1 || plan.loadouts[0]?.agentId !== input.agentId) return false
    const discs = plan.loadouts[0].discs.map(({ disc }) => disc)
    return (
      completeScoringDiscSelection(discs) &&
      (!fixedId || discs.some((disc) => disc.id === fixedId)) &&
      discs.every((disc) => {
        const actual = byId.get(disc.id)
        return Boolean(
          actual &&
          contentHash(actual) === contentHash(disc) &&
          (options.allowLocked !== false || !actual.locked),
        )
      })
    )
  })
  const constraint = input.buildIntent.recommendations.find(
    (row) => row.agentId === input.agentId,
  )?.constraint
  const evaluationCache = new Map<string, ReturnType<typeof evaluateDevelopmentRecordedDiscs>>()
  const qualify = (plan: CandidateWarehousePlan): CandidateWarehousePlan => {
    const loadout = plan.loadouts[0]!
    const discs = loadout.discs.map((choice) => choice.disc)
    const key = physicalKey(discs)
    if (!evaluationCache.has(key))
      evaluationCache.set(
        key,
        evaluateDevelopmentRecordedDiscs(input.agentId, discs, {
          constraint: constraint ?? null,
          independentDirection: input.parameters?.independentDirection,
          conditionContext: input.conditionContext,
        }),
      )
    const evaluated = evaluationCache.get(key)
    if (!evaluated?.complete) {
      const { personalDiscScore: _oldScore, ...rest } = loadout
      void _oldScore
      const safe = { ...rest, totalScore: 0, personalScoreUnavailable: true as const }
      return { ...plan, totalScore: 0, loadouts: [safe] }
    }
    const { choices, recordIssues: _recordIssues, ...personalDiscScore } = evaluated
    void _recordIssues
    // Unknown set eligibility retains disc facts and an explicit unknown DTO;
    // ranking must never interpret this compatibility subtotal as set score 0.
    const totalScore =
      evaluated.totalScore ??
      Math.round(choices.reduce((sum, choice) => sum + choice.score, 0) * 1000) / 1000
    const { personalScoreUnavailable: _oldUnavailable, ...rest } = loadout
    void _oldUnavailable
    return {
      ...plan,
      totalScore,
      loadouts: [{ ...rest, discs: choices, totalScore, personalDiscScore }],
    }
  }
  const candidates = candidateInputs.map(qualify)
  const unavailableSearch = () => ({
    candidates,
    search: null,
    rankingApplied: false,
    diagnostics: summarizeDevelopmentSearchDiagnostics({
      observations: [],
      status: 'not_run',
      nodes: 0,
      nodeLimit: null,
      evaluations: 0,
      evaluationLimit: null,
    }),
  })
  const profile = constraint ? candidateConstraintToDiscProfile(constraint) : null
  if (!profile) return unavailableSearch()
  const fixed = fixedId ? byId.get(fixedId) : undefined
  if (fixedId && !fixed) return unavailableSearch()
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
  if (pools.some((pool) => !pool.length)) return unavailableSearch()
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
      options.effectiveCritObjectivesByAgent?.[input.agentId],
    )
    if (!loadout) return null
    // Team compilation calculates unconditional set points. The personal
    // search does not consume that score; hold only disc points until the
    // published candidate is qualified against its captured source.
    loadout.totalScore =
      Math.round(loadout.discs.reduce((sum, choice) => sum + choice.score, 0) * 1000) / 1000
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
  const observedComparisons = new Map<string, boolean>()
  const side = (discs: DriveDisc[]) => {
    const key = physicalKey(discs)
    if (!sides.has(key))
      sides.set(
        key,
        (input.evaluator ?? evaluateDevelopmentValueBenchmarkSide)({
          ...input,
          discs,
          stale: false,
        }),
      )
    return sides.get(key)!
  }
  const originalDiscs = candidates.map((plan) => plan.loadouts[0]!.discs.map((row) => row.disc))
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
  const diagnostics = createDevelopmentSearchDiagnosticsRecorder({
    baseline,
    initial,
    legal,
    fixed,
    candidates,
    sides,
    observedComparisons,
  })
  // Rank this declared settlement separately, retaining its limited coverage;
  // never manufacture an elapsed cycle or feed it into the full-event objective.
  if (baseline.coverage?.domain === 'prepared_anomaly_settlement') {
    const evaluationBudget = input.evaluationBudget ?? 384
    const prepared = searchPreparedAnomalyCandidates({
      candidates,
      initial,
      pools,
      compile,
      side,
      fixedDiscId: fixedId,
      equippedIds,
      evaluationBudget,
      comparisonParametersIdentity: input.parameters ? stableContentHash(input.parameters) : null,
    })
    return {
      ...prepared,
      candidates: prepared.candidates.map(qualify),
      diagnostics: diagnostics(
        prepared.preparedAnomalySearch,
        null,
        Number.isFinite(evaluationBudget)
          ? Math.max(1, Math.min(384, Math.floor(evaluationBudget)))
          : 384,
      ),
    }
  }
  const baselineObjective = resolvePersonalDevelopmentObjective32(input.agentId, baseline)
  // A personal damage slice is still available for comparison, but it is not
  // the primary functional or anomaly objective when that objective is unknown.
  if (baselineObjective.kind === 'unavailable') return unavailableSearch()
  const baselinePanel = compile(initial)?.loadouts[0]?.panelObjective
  const panelTarget = getCandidatePanelObjectiveTarget(input.agentId, panelInput)
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
    const currentObjective = resolvePersonalDevelopmentObjective32(input.agentId, current)
    const functionalObjective = baselineObjective.kind === 'functional_capacity'
    const objectiveComparable = functionalObjective
      ? comparablePersonalFunctionalObjectives32(
          baseline,
          current,
          baselineObjective,
          currentObjective,
        )
      : comparison.comparable && currentObjective.kind === 'direct_slice'
    observedComparisons.set(physicalKey(discs), objectiveComparable)
    const context = current.dimensions
    const panel = plan?.loadouts[0]?.panelObjective
    const baselineProtection = scopedPersonalFunctionalProtection32(baseline, input.agentId)
    const candidateProtection = scopedPersonalFunctionalProtection32(current, input.agentId)
    const protectedCapacity =
      baselineProtection !== null &&
      candidateProtection !== null &&
      baselineProtection.unresolvedIdentity === candidateProtection.unresolvedIdentity &&
      ((baselineObjective.kind === 'functional_capacity' &&
        baselineObjective.capacityKey === 'agent-remielle:refringe_coefficient') ||
        baseline.personalFunctionalEquipmentIdentity32 ===
          current.personalFunctionalEquipmentIdentity32) &&
      baselineUtility.size === 1 &&
      preservesTeamFunctionalConstraints32({
        baselineCapacities: baselineProtection.capacities,
        candidateCapacities: candidateProtection.capacities,
        baselineUtility,
        candidateUtility: utilityStats(current),
        protectedUtilityIndicesByAgentId: new Map([
          [input.agentId, sourceReviewedProtectedUtilityIndices32(input.agentId)],
        ]),
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
        horizon:
          context.duration === 'not_applicable' ? 'not_applicable' : Number(context.duration),
      },
      inputKey: current.calculationFingerprint ?? stableContentHash(discs),
      eventKey: context.event_set,
      status:
        current.state === 'supported' && objectiveComparable && protectedCapacity
          ? 'evaluated'
          : 'unavailable',
      modeledValue:
        functionalObjective && currentObjective.kind === 'functional_capacity'
          ? currentObjective.value
          : context.duration === 'not_applicable'
            ? current.totalDamage
            : current.planningDps,
      error: 0,
      gaps: [
        ...new Map(
          (functionalObjective ? [] : (current.coverage?.excludedEffects ?? [])).map((effect) => [
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
      functional: developmentPanelFunctionalConstraints(baselinePanel, panel, panelTarget),
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
    if (baselineObjective.kind === 'functional_capacity')
      return comparablePersonalFunctionalObjectives32(
        baseline,
        value,
        baselineObjective,
        resolvePersonalDevelopmentObjective32(input.agentId, value),
      )
    return value.state === 'supported' && value.coverage?.excludedEffects.length === 0
  })
  const searchDiagnostics = diagnostics(result, 30000, input.evaluationBudget ?? 384)
  if (!qualified.length || !originalIsComplete)
    return { candidates, search: result, rankingApplied: false, diagnostics: searchDiagnostics }
  const unique = new Map<string, CandidateWarehousePlan>()
  for (const row of qualified) {
    const discs = unwrap(row.loadouts),
      plan = compile(discs)
    if (plan) unique.set(physicalKey(discs), plan)
  }
  return {
    candidates: [...unique.values()].slice(0, 10).map(qualify),
    search: result,
    rankingApplied: true,
    diagnostics: searchDiagnostics,
  }
}
