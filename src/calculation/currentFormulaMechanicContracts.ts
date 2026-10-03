import { z } from 'zod'
import rawCatalog from '../gameDataPacks/generated/current-formula-mechanic-contract-catalog.v1.json'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'

export const currentFormulaMechanicContractHash = rawCatalog.contentHash

type FormulaPredicate =
  | { kind: 'constant_boolean'; value: boolean }
  | { kind: 'flag'; key: string }
  | {
      kind: 'compare'
      operator: 'eq' | 'gte'
      left: FormulaValue
      right: FormulaValue
    }

type FormulaValue =
  | { kind: 'constant'; value: number }
  | { kind: 'param'; index: number; key: string }
  | { kind: 'input'; key: string }
  | { kind: 'accumulator'; key: string; minimum?: number; maximum?: number }
  | { kind: 'sum' | 'product'; values: FormulaValue[] }
  | {
      kind: 'conditional'
      predicate: FormulaPredicate
      whenTrue: FormulaValue
      whenFalse: FormulaValue
    }

type FormulaEffect =
  | { kind: 'modifier_effect'; path: string; action?: string; value: FormulaValue }
  | {
      kind: 'damage_effect'
      key: string
      damageType: Record<string, string>
      value: FormulaValue
      when?: FormulaPredicate
    }

type FormulaRuntime = {
  flags?: Readonly<Record<string, boolean>>
  numbers?: Readonly<Record<string, number>>
  accumulators?: Readonly<Record<string, number>>
}

const catalog = rawCatalog as unknown as {
  schema: string
  coverage: {
    wengineEntities: number
    driveDiscFourPieceEntities: number
    compilerRejects: number
  }
  wengineItems: Array<{
    stableId: string
    upstreamKey: string
    source: NonNullable<ReturnType<typeof getCurrentWEngineStaticData>>['source']
    executionKind: 'mechanic_contract' | 'static_only'
    effects: FormulaEffect[]
  }>
  driveDiscItems: Array<{
    stableId: string
    upstreamKey: string
    source: { path: string; sha256: string }
    effects: FormulaEffect[]
  }>
}

if (
  catalog.schema !== 'soda-current-formula-mechanic-contract-catalog/v1' ||
  catalog.coverage.wengineEntities !== catalog.wengineItems.length ||
  catalog.coverage.driveDiscFourPieceEntities !== catalog.driveDiscItems.length ||
  new Set(catalog.wengineItems.map((item) => item.stableId)).size !== catalog.wengineItems.length ||
  new Set(catalog.driveDiscItems.map((item) => item.stableId)).size !==
    catalog.driveDiscItems.length ||
  catalog.coverage.compilerRejects !== 0
)
  throw new Error('当前公式 Mechanic Contract 目录覆盖门未通过。')

const wengineByStableId = new Map(catalog.wengineItems.map((item) => [item.stableId, item]))
const driveDiscByStableId = new Map(catalog.driveDiscItems.map((item) => [item.stableId, item]))

export const currentFormulaWEngineContractIds = Object.freeze(
  catalog.wengineItems.map((item) => item.stableId),
)
export const currentFormulaDriveDiscFourPieceContractIds = Object.freeze(
  catalog.driveDiscItems.map((item) => item.stableId),
)

const unsupported = (...blockers: string[]) => ({
  status: 'unsupported' as const,
  blockers: [...new Set(blockers)],
})

function evaluatePredicate(
  predicate: FormulaPredicate,
  runtime: Required<FormulaRuntime>,
  params: readonly number[],
): boolean | ReturnType<typeof unsupported> {
  if (predicate.kind === 'constant_boolean') return predicate.value
  if (predicate.kind === 'flag') {
    const value = runtime.flags[predicate.key]
    return value === undefined ? unsupported(`缺少公式 flag：${predicate.key}`) : value
  }
  const left = evaluateValue(predicate.left, runtime, params)
  const right = evaluateValue(predicate.right, runtime, params)
  if (typeof left !== 'number' || typeof right !== 'number')
    return unsupported(
      ...(typeof left === 'number' ? [] : left.blockers),
      ...(typeof right === 'number' ? [] : right.blockers),
    )
  return predicate.operator === 'eq' ? left === right : left >= right
}

function evaluateValue(
  value: FormulaValue,
  runtime: Required<FormulaRuntime>,
  params: readonly number[],
): number | ReturnType<typeof unsupported> {
  if (value.kind === 'constant') return value.value
  if (value.kind === 'param') {
    const resolved = params[value.index]
    return resolved === undefined ? unsupported(`缺少公式参数：${value.key}`) : resolved
  }
  if (value.kind === 'input') {
    const resolved = runtime.numbers[value.key]
    return resolved === undefined ? unsupported(`缺少公式数值输入：${value.key}`) : resolved
  }
  if (value.kind === 'accumulator') {
    const resolved = runtime.accumulators[value.key]
    if (resolved === undefined) return unsupported(`缺少公式累计量：${value.key}`)
    if (value.minimum !== undefined && resolved < value.minimum)
      return unsupported(`公式累计量低于下限：${value.key}`)
    if (value.maximum !== undefined && resolved > value.maximum)
      return unsupported(`公式累计量超过上限：${value.key}`)
    return resolved
  }
  if (value.kind === 'conditional') {
    const active = evaluatePredicate(value.predicate, runtime, params)
    if (typeof active !== 'boolean') return active
    return evaluateValue(active ? value.whenTrue : value.whenFalse, runtime, params)
  }
  const values = value.values.map((entry) => evaluateValue(entry, runtime, params))
  const blockers = values.flatMap((entry) => (typeof entry === 'number' ? [] : entry.blockers))
  if (blockers.length) return unsupported(...blockers)
  const numbers = values as number[]
  return value.kind === 'sum'
    ? numbers.reduce((total, entry) => total + entry, 0)
    : numbers.reduce((total, entry) => total * entry, 1)
}

function runtimeWithDefaults(runtime: FormulaRuntime | undefined): Required<FormulaRuntime> {
  return {
    flags: runtime?.flags ?? {},
    numbers: runtime?.numbers ?? {},
    accumulators: runtime?.accumulators ?? {},
  }
}

function evaluateEffects(
  effects: readonly FormulaEffect[],
  runtime: Required<FormulaRuntime>,
  params: readonly number[],
  runtimePolicy: 'strict' | 'exclude_unobserved' = 'strict',
) {
  const outputs: Array<Record<string, unknown>> = []
  const blockers: string[] = []
  const exclusions: Array<{
    effectIndex: number
    effectKind: FormulaEffect['kind']
    reasons: string[]
  }> = []
  const handleUnobservedRuntime = (
    effect: FormulaEffect,
    effectIndex: number,
    reasons: string[],
  ) => {
    const onlyUnobservedRuntime = reasons.every((reason) =>
      /^(缺少公式 flag|缺少公式数值输入|缺少公式累计量)：/.test(reason),
    )
    if (runtimePolicy === 'exclude_unobserved' && onlyUnobservedRuntime) {
      exclusions.push({ effectIndex, effectKind: effect.kind, reasons: uniqueStrings(reasons) })
      return true
    }
    blockers.push(...reasons)
    return false
  }
  for (const [effectIndex, effect] of effects.entries()) {
    if (effect.kind === 'damage_effect' && effect.when) {
      const active = evaluatePredicate(effect.when, runtime, params)
      if (typeof active !== 'boolean') {
        handleUnobservedRuntime(effect, effectIndex, active.blockers)
        continue
      }
      if (!active) continue
    }
    const value = evaluateValue(effect.value, runtime, params)
    if (typeof value !== 'number') {
      handleUnobservedRuntime(effect, effectIndex, value.blockers)
      continue
    }
    if (value === 0) continue
    if (effect.kind === 'modifier_effect') {
      const [target, ...statParts] = effect.path.split('.')
      outputs.push({
        kind: 'modifier',
        target,
        stat: statParts.join('.'),
        value,
        ...(effect.action ? { action: effect.action } : {}),
      })
    } else {
      outputs.push({
        kind: 'damage_event',
        owner: 'own',
        action: effect.key,
        formulaValue: value,
        damageType: effect.damageType,
      })
    }
  }
  return blockers.length
    ? unsupported(...blockers)
    : { status: 'supported' as const, outputs, exclusions }
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)]
}

const wengineInputSchema = z.object({
  stableId: z.string(),
  refinement: z.number().int().min(1).max(5),
  specialtyMatches: z.boolean(),
  runtimePolicy: z.enum(['strict', 'exclude_unobserved']).optional(),
  effectIndices: z.array(z.number().int().nonnegative()).optional(),
  runtime: z
    .object({
      flags: z.record(z.string(), z.boolean()).optional(),
      numbers: z.record(z.string(), z.number()).optional(),
      accumulators: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
})

export function resolveCurrentFormulaWEngineContract(input: unknown) {
  const parsed = wengineInputSchema.safeParse(input)
  if (!parsed.success) return unsupported('必须提供音擎、改装等级与特性匹配状态。')
  const item = wengineByStableId.get(parsed.data.stableId)
  const staticData = getCurrentWEngineStaticData(parsed.data.stableId)
  const params = staticData?.passiveParameterTable[parsed.data.refinement - 1]?.params
  if (!item || !staticData || !params) return unsupported(`未登记音擎：${parsed.data.stableId}`)
  if (parsed.data.effectIndices?.some((index) => index >= item.effects.length))
    return unsupported('音擎效果来源索引不存在。')
  if (
    item.source.formulaPath !== staticData.source.formulaPath ||
    item.source.formulaSha256 !== staticData.source.formulaSha256 ||
    item.source.dataPath !== staticData.source.dataPath ||
    item.source.dataSha256 !== staticData.source.dataSha256
  )
    return unsupported(`音擎公式与静态目录来源不一致：${parsed.data.stableId}`)

  if (item.executionKind === 'static_only' || !parsed.data.specialtyMatches)
    return {
      status: 'supported' as const,
      active: false,
      effects: [],
      exclusions: [],
      source: item.source,
    }
  const runtime = runtimeWithDefaults(parsed.data.runtime)
  runtime.flags = {
    ...runtime.flags,
    [`wengine:${item.upstreamKey}:specialty_and_equipped`]: parsed.data.specialtyMatches,
  }
  const result = evaluateEffects(
    parsed.data.effectIndices
      ? item.effects.filter((_, index) => parsed.data.effectIndices!.includes(index))
      : item.effects,
    runtime,
    params,
    parsed.data.runtimePolicy ?? 'strict',
  )
  return result.status === 'unsupported'
    ? result
    : {
        status: 'supported' as const,
        active: result.outputs.length > 0,
        effects: result.outputs,
        exclusions: result.exclusions,
        source: item.source,
      }
}

const discInputSchema = z.object({
  stableId: z.string(),
  equippedPieces: z.number().int().min(0).max(6),
  runtimePolicy: z.enum(['strict', 'exclude_unobserved']).optional(),
  runtime: z
    .object({
      flags: z.record(z.string(), z.boolean()).optional(),
      numbers: z.record(z.string(), z.number()).optional(),
      accumulators: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
})

export function resolveCurrentDriveDiscFourPieceContract(input: unknown) {
  const parsed = discInputSchema.safeParse(input)
  if (!parsed.success) return unsupported('必须提供驱动盘套装与装备件数。')
  const item = driveDiscByStableId.get(parsed.data.stableId)
  if (!item) return unsupported(`未登记驱动盘套装：${parsed.data.stableId}`)
  if (parsed.data.equippedPieces < 4)
    return {
      status: 'supported' as const,
      active: false,
      effects: [],
      exclusions: [],
      source: item.source,
    }
  const runtime = runtimeWithDefaults(parsed.data.runtime)
  runtime.numbers = {
    ...runtime.numbers,
    [`disc_count:${item.upstreamKey}`]: parsed.data.equippedPieces,
  }
  const result = evaluateEffects(item.effects, runtime, [], parsed.data.runtimePolicy ?? 'strict')
  return result.status === 'unsupported'
    ? result
    : {
        status: 'supported' as const,
        active: result.outputs.length > 0,
        effects: result.outputs,
        exclusions: result.exclusions,
        source: item.source,
      }
}

function collectRequirements(
  value: unknown,
  requirements: {
    flags: Set<string>
    numbers: Set<string>
    accumulators: Set<string>
  },
) {
  if (Array.isArray(value))
    return value.forEach((entry) => collectRequirements(entry, requirements))
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if (record.kind === 'flag' && typeof record.key === 'string') requirements.flags.add(record.key)
  if (record.kind === 'input' && typeof record.key === 'string')
    requirements.numbers.add(record.key)
  if (record.kind === 'accumulator' && typeof record.key === 'string')
    requirements.accumulators.add(record.key)
  Object.values(record).forEach((entry) => collectRequirements(entry, requirements))
}

/** Per-source-effect dependencies, before evaluation can hide a zero-valued branch. */
export function getCurrentFormulaWEngineEffectEntries(stableId: string) {
  return (
    wengineByStableId.get(stableId)?.effects.flatMap((effect, effectIndex) => {
      if (effect.kind !== 'modifier_effect') return []
      const requirements = {
        flags: new Set<string>(),
        numbers: new Set<string>(),
        accumulators: new Set<string>(),
      }
      collectRequirements(effect.value, requirements)
      return [
        {
          effectIndex,
          path: effect.path,
          action: effect.action ?? null,
          finalStatReferences: [...requirements.numbers].filter((ref) =>
            /^(own|target)\.final\./.test(ref),
          ),
        },
      ]
    }) ?? []
  )
}

export function getCurrentFormulaContractRequirements(
  kind: 'wengine' | 'drive_disc',
  stableId: string,
) {
  const item =
    kind === 'wengine' ? wengineByStableId.get(stableId) : driveDiscByStableId.get(stableId)
  if (!item) return null
  const requirements = {
    flags: new Set<string>(),
    numbers: new Set<string>(),
    accumulators: new Set<string>(),
  }
  collectRequirements(item.effects, requirements)
  return {
    flags: [...requirements.flags].sort(),
    numbers: [...requirements.numbers].sort(),
    accumulators: [...requirements.accumulators].sort(),
  }
}
