import { z } from 'zod'

export type MechanicValueExpression =
  | { kind: 'constant'; value: number }
  | { kind: 'param'; index: number }
  | { kind: 'input'; key: string }
  | {
      kind: 'accumulator'
      key: string
      minimum?: number
      maximum?: number
      requireWindowActive?: boolean
      requireCooldownReady?: boolean
    }
  | { kind: 'sum'; values: MechanicValueExpression[] }
  | { kind: 'product'; values: MechanicValueExpression[] }
  | { kind: 'clamp'; value: MechanicValueExpression; minimum: number; maximum: number }

export type MechanicPredicate =
  | { kind: 'always' }
  | { kind: 'flag'; key: string; equals: boolean }
  | {
      kind: 'compare'
      operator: 'eq' | 'gte' | 'lte' | 'gt' | 'lt'
      left: MechanicValueExpression
      right: MechanicValueExpression
    }
  | { kind: 'all' | 'any'; predicates: MechanicPredicate[] }
  | { kind: 'not'; predicate: MechanicPredicate }
  | {
      kind: 'composition'
      dimension: 'attribute' | 'specialty' | 'faction' | 'agent_present'
      key: string
      minimum: number
    }

export type MechanicRuntime = {
  flags: Readonly<Record<string, boolean>>
  numbers: Readonly<Record<string, number>>
  accumulators: Readonly<
    Record<
      string,
      {
        value: number
        windowActive?: boolean
        cooldownReady?: boolean
      }
    >
  >
  composition: {
    attributes: Readonly<Record<string, number>>
    specialties: Readonly<Record<string, number>>
    factions: Readonly<Record<string, number>>
    agentIds: readonly string[]
  }
}

const nonEmptyKey = z.string().min(1)
const mechanicValueExpressionSchema: z.ZodType<MechanicValueExpression> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('constant'), value: z.number() }),
    z.object({ kind: z.literal('param'), index: z.number().int().nonnegative() }),
    z.object({ kind: z.literal('input'), key: nonEmptyKey }),
    z.object({
      kind: z.literal('accumulator'),
      key: nonEmptyKey,
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      requireWindowActive: z.boolean().optional(),
      requireCooldownReady: z.boolean().optional(),
    }),
    z.object({ kind: z.literal('sum'), values: z.array(mechanicValueExpressionSchema).min(1) }),
    z.object({ kind: z.literal('product'), values: z.array(mechanicValueExpressionSchema).min(1) }),
    z.object({
      kind: z.literal('clamp'),
      value: mechanicValueExpressionSchema,
      minimum: z.number(),
      maximum: z.number(),
    }),
  ]),
)

const mechanicPredicateSchema: z.ZodType<MechanicPredicate> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('flag'), key: nonEmptyKey, equals: z.boolean() }),
    z.object({
      kind: z.literal('compare'),
      operator: z.enum(['eq', 'gte', 'lte', 'gt', 'lt']),
      left: mechanicValueExpressionSchema,
      right: mechanicValueExpressionSchema,
    }),
    z.object({ kind: z.literal('all'), predicates: z.array(mechanicPredicateSchema).min(1) }),
    z.object({ kind: z.literal('any'), predicates: z.array(mechanicPredicateSchema).min(1) }),
    z.object({ kind: z.literal('not'), predicate: mechanicPredicateSchema }),
    z.object({
      kind: z.literal('composition'),
      dimension: z.enum(['attribute', 'specialty', 'faction', 'agent_present']),
      key: nonEmptyKey,
      minimum: z.number().int().positive(),
    }),
  ]),
)

const mechanicRuntimeSchema = z.object({
  flags: z.record(z.string(), z.boolean()),
  numbers: z.record(z.string(), z.number()),
  accumulators: z.record(
    z.string(),
    z.object({
      value: z.number(),
      windowActive: z.boolean().optional(),
      cooldownReady: z.boolean().optional(),
    }),
  ),
  composition: z.object({
    attributes: z.record(z.string(), z.number().int().nonnegative()),
    specialties: z.record(z.string(), z.number().int().nonnegative()),
    factions: z.record(z.string(), z.number().int().nonnegative()),
    agentIds: z.array(nonEmptyKey),
  }),
})

const effectBase = {
  when: mechanicPredicateSchema.optional(),
  value: mechanicValueExpressionSchema,
}

const mechanicEffectSchema = z.discriminatedUnion('operator', [
  z.object({
    operator: z.literal('scoped_modifier_apply'),
    ...effectBase,
    target: z.enum(['own', 'team', 'enemy']),
    stat: nonEmptyKey,
    action: nonEmptyKey.optional(),
    attribute: nonEmptyKey.optional(),
  }),
  z.object({
    operator: z.literal('resource_and_sustain_apply'),
    ...effectBase,
    target: z.enum(['own', 'team']),
    resource: z.enum(['energy', 'hp', 'shield', 'damage_reduction']),
    mode: z.enum(['flat', 'percent', 'rate']),
  }),
  z.object({
    operator: z.literal('damage_event_emit'),
    ...effectBase,
    owner: z.enum(['own', 'team', 'bangboo', 'summon']),
    scalingStat: z.enum(['attack', 'defense', 'hp', 'fixed']),
    action: nonEmptyKey,
    attribute: nonEmptyKey.optional(),
    forcedCrit: z.boolean().optional(),
  }),
  z.object({
    operator: z.literal('event_schedule_mutate'),
    ...effectBase,
    eventKey: nonEmptyKey,
    mutation: z.enum([
      'cooldown_delta',
      'duration_delta',
      'charge_delta',
      'extra_hits',
      'summon_count',
    ]),
    chance: mechanicValueExpressionSchema.optional(),
  }),
])

export const mechanicContractSchema = z.object({
  schema: z.literal('soda-mechanic-contract/v1'),
  entityId: nonEmptyKey,
  sourceRefs: z.array(nonEmptyKey).min(1),
  applicableWhen: mechanicPredicateSchema.optional(),
  effects: z.array(mechanicEffectSchema).min(1),
})

export type MechanicContract = z.infer<typeof mechanicContractSchema>
export type MechanicEffect = z.infer<typeof mechanicEffectSchema>

type Supported<T> = { status: 'supported'; value: T }
type Unsupported = { status: 'unsupported'; blockers: string[] }
type OperatorResult<T> = Supported<T> | Unsupported

const unsupported = (...blockers: string[]): Unsupported => ({
  status: 'unsupported',
  blockers: [...new Set(blockers)],
})

export function resolveMechanicAccumulatorWindow(
  expression: Extract<MechanicValueExpression, { kind: 'accumulator' }>,
  runtime: MechanicRuntime,
): OperatorResult<number> {
  const state = runtime.accumulators[expression.key]
  if (!state) return unsupported(`缺少 accumulator 状态：${expression.key}`)
  if (!Number.isFinite(state.value)) return unsupported(`accumulator 非有限数：${expression.key}`)
  if (expression.minimum !== undefined && state.value < expression.minimum)
    return unsupported(`accumulator 低于合同下限：${expression.key}`)
  if (expression.maximum !== undefined && state.value > expression.maximum)
    return unsupported(`accumulator 超过合同上限：${expression.key}`)
  if (expression.requireWindowActive) {
    if (state.windowActive === undefined) return unsupported(`缺少 window 状态：${expression.key}`)
    if (!state.windowActive) return { status: 'supported', value: 0 }
  }
  if (expression.requireCooldownReady) {
    if (state.cooldownReady === undefined)
      return unsupported(`缺少 cooldown 状态：${expression.key}`)
    if (!state.cooldownReady) return { status: 'supported', value: 0 }
  }
  return { status: 'supported', value: state.value }
}

function evaluateMechanicValue(
  expression: MechanicValueExpression,
  runtime: MechanicRuntime,
  params: readonly number[],
): OperatorResult<number> {
  switch (expression.kind) {
    case 'constant':
      return { status: 'supported', value: expression.value }
    case 'param': {
      const value = params[expression.index]
      return value === undefined
        ? unsupported(`缺少参数：P[${expression.index}]`)
        : { status: 'supported', value }
    }
    case 'input': {
      const value = runtime.numbers[expression.key]
      return value === undefined
        ? unsupported(`缺少数值输入：${expression.key}`)
        : { status: 'supported', value }
    }
    case 'accumulator':
      return resolveMechanicAccumulatorWindow(expression, runtime)
    case 'sum':
    case 'product': {
      const values = expression.values.map((item) => evaluateMechanicValue(item, runtime, params))
      const blockers = values.flatMap((item) =>
        item.status === 'unsupported' ? item.blockers : [],
      )
      if (blockers.length) return unsupported(...blockers)
      const numbers = values.map((item) => (item as Supported<number>).value)
      return {
        status: 'supported',
        value:
          expression.kind === 'sum'
            ? numbers.reduce((total, value) => total + value, 0)
            : numbers.reduce((total, value) => total * value, 1),
      }
    }
    case 'clamp': {
      if (expression.minimum > expression.maximum)
        return unsupported('clamp minimum 不能大于 maximum。')
      const value = evaluateMechanicValue(expression.value, runtime, params)
      return value.status === 'unsupported'
        ? value
        : {
            status: 'supported',
            value: Math.min(expression.maximum, Math.max(expression.minimum, value.value)),
          }
    }
  }
}

export function evaluateMechanicPredicate(
  predicate: MechanicPredicate,
  runtime: MechanicRuntime,
  params: readonly number[],
): OperatorResult<boolean> {
  switch (predicate.kind) {
    case 'always':
      return { status: 'supported', value: true }
    case 'flag': {
      const value = runtime.flags[predicate.key]
      return value === undefined
        ? unsupported(`缺少 flag：${predicate.key}`)
        : { status: 'supported', value: value === predicate.equals }
    }
    case 'compare': {
      const left = evaluateMechanicValue(predicate.left, runtime, params)
      const right = evaluateMechanicValue(predicate.right, runtime, params)
      if (left.status === 'unsupported' || right.status === 'unsupported')
        return unsupported(
          ...(left.status === 'unsupported' ? left.blockers : []),
          ...(right.status === 'unsupported' ? right.blockers : []),
        )
      const comparisons = {
        eq: left.value === right.value,
        gte: left.value >= right.value,
        lte: left.value <= right.value,
        gt: left.value > right.value,
        lt: left.value < right.value,
      }
      return { status: 'supported', value: comparisons[predicate.operator] }
    }
    case 'all':
    case 'any': {
      const values = predicate.predicates.map((item) =>
        evaluateMechanicPredicate(item, runtime, params),
      )
      const supportedValues = values.flatMap((item) =>
        item.status === 'supported' ? [item.value] : [],
      )
      if (predicate.kind === 'all' && supportedValues.includes(false))
        return { status: 'supported', value: false }
      if (predicate.kind === 'any' && supportedValues.includes(true))
        return { status: 'supported', value: true }
      const blockers = values.flatMap((item) =>
        item.status === 'unsupported' ? item.blockers : [],
      )
      if (blockers.length) return unsupported(...blockers)
      return {
        status: 'supported',
        value:
          predicate.kind === 'all' ? supportedValues.every(Boolean) : supportedValues.some(Boolean),
      }
    }
    case 'not': {
      const value = evaluateMechanicPredicate(predicate.predicate, runtime, params)
      return value.status === 'unsupported' ? value : { status: 'supported', value: !value.value }
    }
    case 'composition': {
      const count =
        predicate.dimension === 'agent_present'
          ? runtime.composition.agentIds.includes(predicate.key)
            ? 1
            : 0
          : predicate.dimension === 'attribute'
            ? (runtime.composition.attributes[predicate.key] ?? 0)
            : predicate.dimension === 'specialty'
              ? (runtime.composition.specialties[predicate.key] ?? 0)
              : (runtime.composition.factions[predicate.key] ?? 0)
      return { status: 'supported', value: count >= predicate.minimum }
    }
  }
}

export function applyScopedModifier(
  effect: Extract<MechanicEffect, { operator: 'scoped_modifier_apply' }>,
  value: number,
) {
  return {
    kind: 'modifier' as const,
    target: effect.target,
    stat: effect.stat,
    value,
    ...(effect.action ? { action: effect.action } : {}),
    ...(effect.attribute ? { attribute: effect.attribute } : {}),
  }
}

export function applyResourceAndSustain(
  effect: Extract<MechanicEffect, { operator: 'resource_and_sustain_apply' }>,
  value: number,
) {
  return {
    kind: 'resource_or_sustain' as const,
    target: effect.target,
    resource: effect.resource,
    mode: effect.mode,
    value,
  }
}

export function emitMechanicDamageEvent(
  effect: Extract<MechanicEffect, { operator: 'damage_event_emit' }>,
  value: number,
) {
  return {
    kind: 'damage_event' as const,
    owner: effect.owner,
    scalingStat: effect.scalingStat,
    multiplier: value,
    action: effect.action,
    ...(effect.attribute ? { attribute: effect.attribute } : {}),
    forcedCrit: effect.forcedCrit ?? false,
  }
}

export function mutateMechanicEventSchedule(
  effect: Extract<MechanicEffect, { operator: 'event_schedule_mutate' }>,
  value: number,
  chance: number,
) {
  return {
    kind: 'event_schedule_mutation' as const,
    eventKey: effect.eventKey,
    mutation: effect.mutation,
    value,
    chance,
  }
}

export function evaluateMechanicContract(input: {
  contract: unknown
  runtime: unknown
  params: readonly number[]
}) {
  const contract = mechanicContractSchema.safeParse(input.contract)
  const runtime = mechanicRuntimeSchema.safeParse(input.runtime)
  if (!contract.success || !runtime.success)
    return unsupported(
      ...(contract.success ? [] : ['Mechanic Contract schema 无效。']),
      ...(runtime.success ? [] : ['Mechanic Runtime schema 无效。']),
    )

  const applicable = contract.data.applicableWhen
    ? evaluateMechanicPredicate(contract.data.applicableWhen, runtime.data, input.params)
    : ({ status: 'supported', value: true } as const)
  if (applicable.status === 'unsupported') return applicable
  if (!applicable.value)
    return {
      status: 'supported' as const,
      active: false,
      outputs: [],
      sourceRefs: contract.data.sourceRefs,
    }

  const outputs: Array<
    | ReturnType<typeof applyScopedModifier>
    | ReturnType<typeof applyResourceAndSustain>
    | ReturnType<typeof emitMechanicDamageEvent>
    | ReturnType<typeof mutateMechanicEventSchedule>
  > = []
  const blockers: string[] = []
  for (const effect of contract.data.effects) {
    const active = effect.when
      ? evaluateMechanicPredicate(effect.when, runtime.data, input.params)
      : ({ status: 'supported', value: true } as const)
    if (active.status === 'unsupported') {
      blockers.push(...active.blockers)
      continue
    }
    if (!active.value) continue
    const value = evaluateMechanicValue(effect.value, runtime.data, input.params)
    if (value.status === 'unsupported') {
      blockers.push(...value.blockers)
      continue
    }
    if (value.value === 0) continue
    if (effect.operator === 'scoped_modifier_apply')
      outputs.push(applyScopedModifier(effect, value.value))
    if (effect.operator === 'resource_and_sustain_apply')
      outputs.push(applyResourceAndSustain(effect, value.value))
    if (effect.operator === 'damage_event_emit')
      outputs.push(emitMechanicDamageEvent(effect, value.value))
    if (effect.operator === 'event_schedule_mutate') {
      const chance = effect.chance
        ? evaluateMechanicValue(effect.chance, runtime.data, input.params)
        : ({ status: 'supported', value: 1 } as const)
      if (chance.status === 'unsupported') blockers.push(...chance.blockers)
      else if (chance.value < 0 || chance.value > 1) blockers.push('事件概率必须在 0–1。')
      else outputs.push(mutateMechanicEventSchedule(effect, value.value, chance.value))
    }
  }
  if (blockers.length) return unsupported(...blockers)
  return {
    status: 'supported' as const,
    active: outputs.some((output) =>
      output.kind === 'event_schedule_mutation'
        ? output.value !== 0
        : 'value' in output
          ? output.value !== 0
          : output.multiplier !== 0,
    ),
    outputs,
    sourceRefs: contract.data.sourceRefs,
  }
}

export const emptyMechanicRuntime = Object.freeze({
  flags: {},
  numbers: {},
  accumulators: {},
  composition: { attributes: {}, specialties: {}, factions: {}, agentIds: [] },
}) satisfies MechanicRuntime
