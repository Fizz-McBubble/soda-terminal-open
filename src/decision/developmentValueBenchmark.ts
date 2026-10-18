import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { compareValueBenchmarkSides } from '../calculation/valueBenchmarkComparison'
import { resolveWEngine } from './wEngineResolver'
import {
  resolveCurrentPlanningScenario32,
  type CurrentPlanningScenarioSelection32,
} from '../calculation/currentPlanningScenario32'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'
import {
  evaluateDevelopmentValueBenchmarkSide,
  unsupportedSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmarkRuntime'

export {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmarkRuntime'

export type DevelopmentValueBenchmarkEvaluator = typeof evaluateDevelopmentValueBenchmarkSide

/** Read plain data without invoking getters while preparing a reuse key. */
function benchmarkDataProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') throw new Error('Non-data benchmark input')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype)
    throw new Error('Non-plain benchmark input')
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor && key in value) throw new Error('Inherited benchmark input')
  if (descriptor && !('value' in descriptor)) throw new Error('Accessor benchmark input')
  return descriptor?.value
}

/** Full, typed serialization: no truncated hash, toJSON hooks, accessors or lossy null coercion. */
function benchmarkDataKey(value: unknown): string {
  const active = new Set<object>()
  let nodes = 0
  const encode = (item: unknown, depth: number): unknown => {
    if (++nodes > 20_000 || depth > 48) throw new Error('Benchmark key too large')
    if (item === null) return ['null']
    if (item === undefined) return ['undefined']
    if (typeof item === 'string' || typeof item === 'boolean') return [typeof item, item]
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new Error('Non-finite benchmark input')
      return ['number', Object.is(item, -0) ? '-0' : item]
    }
    if (typeof item !== 'object' || active.has(item)) throw new Error('Non-data benchmark input')
    const prototype = Object.getPrototypeOf(item)
    const array = Array.isArray(item)
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
      throw new Error('Non-plain benchmark input')
    if (Object.getOwnPropertySymbols(item).length) throw new Error('Symbol benchmark input')
    const descriptors = Object.getOwnPropertyDescriptors(item)
    if (Object.values(descriptors).some((entry) => !('value' in entry)))
      throw new Error('Accessor benchmark input')
    active.add(item)
    try {
      if (array) {
        if (Object.keys(descriptors).length !== item.length + 1)
          throw new Error('Sparse or decorated benchmark array')
        return [
          'array',
          ...Array.from({ length: item.length }, (_, index) => {
            const entry = descriptors[String(index)]
            if (!entry) throw new Error('Sparse benchmark array')
            return encode(entry.value, depth + 1)
          }),
        ]
      }
      return [
        'object',
        Object.keys(descriptors)
          .sort()
          .map((key) => [key, encode(descriptors[key]!.value, depth + 1)]),
      ]
    } finally {
      active.delete(item)
    }
  }
  return JSON.stringify(encode(value, 0))
}

/** A synchronous query owns this bounded reuse layer. Never retain it across queries or runs. */
export function createDevelopmentValueBenchmarkEvaluator(
  evaluate: DevelopmentValueBenchmarkEvaluator = evaluateDevelopmentValueBenchmarkSide,
): DevelopmentValueBenchmarkEvaluator {
  const warehouseIds = new WeakMap<CoreWarehouse, number>()
  const cache = new Map<string, ReturnType<DevelopmentValueBenchmarkEvaluator>>()
  let nextWarehouseId = 0
  let keyCharacters = 0
  return (input) => {
    let key: string | undefined
    try {
      const warehouse = benchmarkDataProperty(input, 'warehouse') as CoreWarehouse
      const roster = benchmarkDataProperty(warehouse, 'roster')
      const agents = benchmarkDataProperty(roster, 'agents')
      if (!Array.isArray(agents)) throw new Error('Missing agent data')
      const agentId = benchmarkDataProperty(input, 'agentId')
      let actor: unknown
      for (let index = 0; index < agents.length; index++) {
        const agent = benchmarkDataProperty(agents, String(index))
        if (
          benchmarkDataProperty(agent, 'agentId') === agentId &&
          benchmarkDataProperty(agent, 'owned')
        ) {
          actor = agent
          break
        }
      }
      const encoded = benchmarkDataKey([
        // Only actual evaluator inputs: stage candidates/buildIntent/evaluator are deliberately absent.
        ...[
          'agentId',
          'discs',
          'stale',
          'parameters',
          'scenarioSelection',
          'eventConditionDeclaration',
          'statProbe',
          'resourceGrantDeclaration32',
        ].map((field) => benchmarkDataProperty(input, field)),
        benchmarkDataProperty(warehouse, 'accountId'),
        actor,
        benchmarkDataProperty(roster, 'wEngines'),
      ])
      if (encoded.length <= 65_536) {
        if (!warehouseIds.has(warehouse)) warehouseIds.set(warehouse, ++nextWarehouseId)
        key = `${warehouseIds.get(warehouse)}:${encoded}`
      }
    } catch {
      // Unsafe key construction is not a calculation failure; preserve the original evaluator path.
    }
    if (key && cache.has(key)) return structuredClone(cache.get(key)!)
    const result = evaluate(input) // Numerical/program errors propagate and are never cached.
    if (key && result.state === 'supported') {
      let snapshot: typeof result
      try {
        snapshot = structuredClone(result)
      } catch {
        return result
      }
      while (cache.size >= 256 || keyCharacters + key.length > 1_000_000) {
        const oldest = cache.keys().next().value
        if (oldest === undefined) break
        keyCharacters -= oldest.length
        cache.delete(oldest)
      }
      cache.set(key, snapshot)
      keyCharacters += key.length
    }
    return result
  }
}

export function projectDevelopmentValueBenchmarks(
  input: {
    warehouse: CoreWarehouse
    agentId: string
    baseline: DriveDisc[]
    candidates: CandidateWarehousePlan[]
    savedPlans?: readonly AccountPlanningDraft[]
    stale: boolean
    candidateParametersByRank?: Readonly<Record<number, DevelopmentComparisonParameters>>
    scenarioSelection?: CurrentPlanningScenarioSelection32
    eventConditionDeclaration?: ReviewedTemplateEventConditionDeclaration32
    resourceGrantDeclaration32?: import('../calculation/sourceMechanismResourceGrants32').SourceResourceGrantDeclaration32
  },
  evaluate: DevelopmentValueBenchmarkEvaluator = evaluateDevelopmentValueBenchmarkSide,
) {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const validLoadout = (discs: readonly DriveDisc[]) =>
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(discs.map((disc) => disc.slot)).size === 6 &&
    discs.every((disc) => input.warehouse.discs.some((owned) => owned.id === disc.id))
  const saved = (input.savedPlans ?? [])
    .filter(
      (plan) =>
        plan.accountId === input.warehouse.accountId &&
        plan.kind === 'agent' &&
        plan.state === 'saved' &&
        plan.savedRole === 'current_reference' &&
        plan.selection.agentIds.length === 1 &&
        plan.selection.agentIds[0] === input.agentId &&
        plan.solutionContext?.scope === 'agent_independent',
    )
    .toSorted(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.revision - left.revision,
    )[0]
  const savedIds =
    saved?.warehouseRefs.length === 6
      ? saved.warehouseRefs
      : (saved?.candidateWarehouse?.loadouts.find((item) => item.agentId === input.agentId)
          ?.discIds ?? [])
  const savedDiscs = savedIds.flatMap((id) => {
    const disc = input.warehouse.discs.find((item) => item.id === id)
    return disc ? [disc] : []
  })
  const firstCandidateDiscs =
    input.candidates[0]?.loadouts
      .find((item) => item.agentId === input.agentId)
      ?.discs.map((item) => item.disc) ?? []
  const actualAvailable = validLoadout(input.baseline)
  const savedAvailable = validLoadout(savedDiscs)
  const candidateAvailable = validLoadout(firstCandidateDiscs)
  const accountAgent = input.warehouse.roster.agents.find(
    (agent) => agent.agentId === input.agentId,
  )
  const currentEngineRecorded = Boolean(
    resolveWEngine({
      agent: accountAgent,
      legacyWEngines: input.warehouse.roster.wEngines,
    }).current,
  )
  const engineLabel = currentEngineRecorded ? '已记录当前音擎' : '音擎未记录'
  const baselineDiscs = actualAvailable
    ? input.baseline
    : savedAvailable
      ? savedDiscs
      : candidateAvailable && input.candidates.length > 1
        ? firstCandidateDiscs
        : []
  const baselineLabel = actualAvailable
    ? `游戏当前实装（已记录六盘，${engineLabel}）`
    : savedAvailable
      ? `已保存方案「${saved!.name}」（按当前资产与${saved?.solutionContext?.comparisonParameters ? '保存的显式方案参数' : engineLabel}重算，非游戏实装）`
      : baselineDiscs.length
        ? '仓库方案 1（试算基线，非游戏实装）'
        : '没有第二份可比方案（非游戏实装）'
  const baseline = baselineDiscs.length
    ? evaluate({
        scenarioSelection: input.scenarioSelection,
        eventConditionDeclaration: input.eventConditionDeclaration,
        resourceGrantDeclaration32: input.resourceGrantDeclaration32,
        warehouse: input.warehouse,
        agentId: input.agentId,
        discs: baselineDiscs,
        stale: input.stale,
        parameters:
          !actualAvailable && savedAvailable
            ? saved?.solutionContext?.comparisonParameters
            : undefined,
      })
    : unsupportedSide({
        scenarioSelection: input.scenarioSelection,
        agentId: input.agentId,
        discs: [],
        engineKey: 'missing',
        state: input.stale ? 'stale' : 'unsupported',
        reasons: [
          input.candidates.length === 1
            ? '仅有一份有效方案，直接查看即可；没有相对游戏实装的提升结论。'
            : '未记录完整的游戏当前实装，也没有可用的保存方案或第二份候选。',
        ],
      })
  return input.candidates.map((plan, index) => {
    const discs = plan.loadouts[0]?.discs.map((item) => item.disc) ?? []
    const candidate = evaluate({
      scenarioSelection: input.scenarioSelection,
      eventConditionDeclaration: input.eventConditionDeclaration,
      resourceGrantDeclaration32: input.resourceGrantDeclaration32,
      warehouse: input.warehouse,
      agentId: input.agentId,
      discs,
      stale: input.stale,
      parameters: input.candidateParametersByRank?.[index + 1],
    })
    const changedDimensions = [
      ...(baseline.dimensions.potential === candidate.dimensions.potential
        ? []
        : (['potential'] as const)),
      ...(baseline.dimensions.disc_loadout === candidate.dimensions.disc_loadout
        ? []
        : (['disc_loadout'] as const)),
      ...(baseline.dimensions.w_engine === candidate.dimensions.w_engine
        ? []
        : (['w_engine'] as const)),
    ]
    return {
      ...compareValueBenchmarkSides({
        baselineSource: actualAvailable
          ? { kind: 'actual', referenceId: null }
          : savedAvailable
            ? { kind: 'saved', referenceId: saved!.id }
            : baselineDiscs.length
              ? { kind: 'candidate', referenceId: 'rank:1' }
              : { kind: 'none', referenceId: null },
        baseline:
          !actualAvailable && !savedAvailable && index === 0
            ? unsupportedSide({
                scenarioSelection: input.scenarioSelection,
                agentId: input.agentId,
                discs: baselineDiscs,
                engineKey: candidate.dimensions.w_engine,
                state: input.stale ? 'stale' : 'unsupported',
                reasons: ['该方案是试算基线；自身不计算相对提升。'],
              })
            : baseline,
        candidate,
        changedDimensions,
        independentCounterfactual: changedDimensions.length === 1,
        labels: {
          baseline: baselineLabel,
          candidate: `仓库方案 ${index + 1}（六张实体盘，${input.candidateParametersByRank?.[index + 1]?.wEngine ? `显式音擎 ${candidate.dimensions.w_engine}，含音擎养成变化` : engineLabel}${input.candidateParametersByRank?.[index + 1]?.potential !== undefined ? '，显式潜能' : ''}）`,
        },
      }),
      scenarioSelection: scenario.selection,
      scenarioIdentity: scenario.identity,
    }
  })
}
