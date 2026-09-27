import { z } from 'zod'

const nonEmpty = z.string().min(1)
const sourceRefs = z.array(nonEmpty).min(1)
const common = {
  contractId: nonEmpty,
  sourceRefs,
  authority: z.enum(['source_backed', 'semantic_fixture_only']),
}

const timedEventScheduleSchema = z.object({
  ...common,
  operator: z.literal('timed_event_schedule'),
  durationSeconds: z.number().positive(),
  events: z
    .array(
      z.object({
        eventKey: nonEmpty,
        ownerAgentId: nonEmpty,
        occurrenceCount: z.number().int().nonnegative(),
        activeSeconds: z.number().nonnegative(),
      }),
    )
    .min(1),
})

const resourceStateTransitionSchema = z.object({
  ...common,
  operator: z.literal('resource_state_transition'),
  resourceKey: nonEmpty,
  initialValue: z.number(),
  minimum: z.number(),
  maximum: z.number(),
  transitions: z.array(
    z.object({
      atSeconds: z.number().nonnegative(),
      ownerAgentId: nonEmpty,
      delta: z.number(),
      reason: nonEmpty,
    }),
  ),
})

const teamEffectResolutionSchema = z.object({
  ...common,
  operator: z.literal('team_effect_resolution'),
  effectKey: nonEmpty,
  ownerAgentId: nonEmpty,
  recipientAgentIds: z.array(nonEmpty).min(1),
  snapshotPolicy: z.enum(['recompute_per_event', 'snapshot_on_apply']),
  value: z.number(),
  durationSeconds: z.number().positive(),
  windows: z
    .array(z.object({ startSeconds: z.number().nonnegative(), endSeconds: z.number().positive() }))
    .min(1),
})

const fieldTimeOpportunityCostSchema = z.object({
  ...common,
  operator: z.literal('field_time_opportunity_cost'),
  durationSeconds: z.number().positive(),
  transitionSeconds: z.number().nonnegative(),
  allocations: z
    .array(z.object({ agentId: nonEmpty, activeSeconds: z.number().nonnegative() }))
    .min(1),
})

const offFieldSharedDamageSchema = z.object({
  ...common,
  operator: z.literal('off_field_shared_damage'),
  events: z
    .array(
      z.object({
        eventKey: nonEmpty,
        ownerAgentId: nonEmpty,
        attribution: z.enum(['own', 'shared']),
        damagePerOccurrence: z.number().nonnegative(),
        occurrenceCount: z.number().int().nonnegative(),
      }),
    )
    .min(1),
})

const chainUltimateConversionSchema = z.object({
  ...common,
  operator: z.literal('chain_ultimate_conversion'),
  initialChainCount: z.number().int().nonnegative(),
  initialUltimateCount: z.number().int().nonnegative(),
  chainToUltimateCount: z.number().int().nonnegative(),
  ultimateToChainCount: z.number().int().nonnegative(),
  extraChainCount: z.number().int().nonnegative(),
})

export const planningInteractionContractSchema = z.discriminatedUnion('operator', [
  timedEventScheduleSchema,
  resourceStateTransitionSchema,
  teamEffectResolutionSchema,
  fieldTimeOpportunityCostSchema,
  offFieldSharedDamageSchema,
  chainUltimateConversionSchema,
])

export type PlanningInteractionContract = z.infer<typeof planningInteractionContractSchema>
export type PlanningInteractionOperator = PlanningInteractionContract['operator']

export const planningInteractionOperators = Object.freeze([
  'timed_event_schedule',
  'resource_state_transition',
  'team_effect_resolution',
  'field_time_opportunity_cost',
  'off_field_shared_damage',
  'chain_ultimate_conversion',
] as const satisfies readonly PlanningInteractionOperator[])

type Unsupported = { status: 'unsupported'; blockers: string[] }

function unsupported(...blockers: string[]): Unsupported {
  return { status: 'unsupported', blockers: [...new Set(blockers)] }
}

function mergeWindowSeconds(
  windows: ReadonlyArray<{ startSeconds: number; endSeconds: number }>,
  durationSeconds: number,
) {
  const normalized = windows
    .map((window) => ({
      start: Math.min(durationSeconds, window.startSeconds),
      end: Math.min(durationSeconds, window.endSeconds),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end)
  if (normalized.some((window) => window.end <= window.start)) return null
  const merged: Array<{ start: number; end: number }> = []
  for (const window of normalized) {
    const previous = merged.at(-1)
    if (!previous || window.start > previous.end) merged.push({ ...window })
    else previous.end = Math.max(previous.end, window.end)
  }
  return merged.reduce((sum, window) => sum + window.end - window.start, 0)
}

export function executePlanningInteractionContract(input: unknown) {
  const parsed = planningInteractionContractSchema.safeParse(input)
  if (!parsed.success) return unsupported('Planning interaction contract schema 无效。')
  const contract = parsed.data

  if (contract.operator === 'timed_event_schedule') {
    if (contract.events.some((event) => event.activeSeconds > contract.durationSeconds))
      return unsupported('事件 activeSeconds 不能超过 PlanningBaseline 时长。')
    return {
      status: 'supported' as const,
      operator: contract.operator,
      contractId: contract.contractId,
      totalOccurrenceCount: contract.events.reduce((sum, event) => sum + event.occurrenceCount, 0),
      events: contract.events.map((event) => ({
        ...event,
        dutyCycle: event.activeSeconds / contract.durationSeconds,
      })),
    }
  }

  if (contract.operator === 'resource_state_transition') {
    if (contract.minimum > contract.maximum) return unsupported('资源 minimum 不能大于 maximum。')
    if (contract.initialValue < contract.minimum || contract.initialValue > contract.maximum)
      return unsupported('资源初始值越界。')
    let current = contract.initialValue
    let generated = 0
    let consumed = 0
    const states = [...contract.transitions]
      .sort((left, right) => left.atSeconds - right.atSeconds)
      .map((transition) => {
        current += transition.delta
        if (transition.delta >= 0) generated += transition.delta
        else consumed += -transition.delta
        return { ...transition, valueAfter: current }
      })
    if (
      states.some(
        (state) => state.valueAfter < contract.minimum || state.valueAfter > contract.maximum,
      )
    )
      return unsupported(`资源状态越界：${contract.resourceKey}`)
    return {
      status: 'supported' as const,
      operator: contract.operator,
      contractId: contract.contractId,
      resourceKey: contract.resourceKey,
      initialValue: contract.initialValue,
      endingValue: current,
      generated,
      consumed,
      states,
      conserved: Math.abs(contract.initialValue + generated - consumed - current) <= 1e-9,
    }
  }

  if (contract.operator === 'team_effect_resolution') {
    if (new Set(contract.recipientAgentIds).size !== contract.recipientAgentIds.length)
      return unsupported('队伍效果 recipient 不能重复。')
    const activeSeconds = mergeWindowSeconds(contract.windows, contract.durationSeconds)
    if (activeSeconds === null) return unsupported('队伍效果窗口无效。')
    return {
      status: 'supported' as const,
      operator: contract.operator,
      contractId: contract.contractId,
      effectKey: contract.effectKey,
      ownerAgentId: contract.ownerAgentId,
      recipientAgentIds: contract.recipientAgentIds,
      snapshotPolicy: contract.snapshotPolicy,
      value: contract.value,
      activeSeconds,
      uptime: activeSeconds / contract.durationSeconds,
    }
  }

  if (contract.operator === 'field_time_opportunity_cost') {
    if (
      new Set(contract.allocations.map((item) => item.agentId)).size !== contract.allocations.length
    )
      return unsupported('场上时间 allocation 不能重复代理人。')
    const activeSeconds = contract.allocations.reduce((sum, item) => sum + item.activeSeconds, 0)
    const occupiedSeconds = activeSeconds + contract.transitionSeconds
    if (occupiedSeconds > contract.durationSeconds)
      return unsupported('场上时间与切换成本超过 PlanningBaseline 时长。')
    return {
      status: 'supported' as const,
      operator: contract.operator,
      contractId: contract.contractId,
      activeSeconds,
      transitionSeconds: contract.transitionSeconds,
      idleSeconds: contract.durationSeconds - occupiedSeconds,
      shares: Object.fromEntries(
        contract.allocations.map((item) => [
          item.agentId,
          item.activeSeconds / contract.durationSeconds,
        ]),
      ),
    }
  }

  if (contract.operator === 'off_field_shared_damage') {
    const ownByAgent: Record<string, number> = {}
    let sharedDamage = 0
    for (const event of contract.events) {
      const damage = event.damagePerOccurrence * event.occurrenceCount
      if (event.attribution === 'shared') sharedDamage += damage
      else ownByAgent[event.ownerAgentId] = (ownByAgent[event.ownerAgentId] ?? 0) + damage
    }
    const ownDamage = Object.values(ownByAgent).reduce((sum, value) => sum + value, 0)
    return {
      status: 'supported' as const,
      operator: contract.operator,
      contractId: contract.contractId,
      ownByAgent,
      sharedDamage,
      totalDamage: ownDamage + sharedDamage,
      conserved:
        Math.abs(
          ownDamage +
            sharedDamage -
            contract.events.reduce(
              (sum, event) => sum + event.damagePerOccurrence * event.occurrenceCount,
              0,
            ),
        ) <= 1e-9,
    }
  }

  if (contract.chainToUltimateCount > contract.initialChainCount)
    return unsupported('chain→ultimate 转换超过可用连携次数。')
  if (contract.ultimateToChainCount > contract.initialUltimateCount)
    return unsupported('ultimate→chain 转换超过可用终结技次数。')
  const finalChainCount =
    contract.initialChainCount -
    contract.chainToUltimateCount +
    contract.ultimateToChainCount +
    contract.extraChainCount
  const finalUltimateCount =
    contract.initialUltimateCount - contract.ultimateToChainCount + contract.chainToUltimateCount
  return {
    status: 'supported' as const,
    operator: contract.operator,
    contractId: contract.contractId,
    finalChainCount,
    finalUltimateCount,
    extraChainCount: contract.extraChainCount,
    baseEventCountConserved:
      finalChainCount + finalUltimateCount - contract.extraChainCount ===
      contract.initialChainCount + contract.initialUltimateCount,
  }
}

export function compilePlanningInteractionContracts(input: {
  contracts: readonly PlanningInteractionContract[]
  requiredOperators?: readonly PlanningInteractionOperator[]
}) {
  const duplicateIds = input.contracts
    .map((contract) => contract.contractId)
    .filter((id, index, all) => all.indexOf(id) !== index)
  const results = input.contracts.map(executePlanningInteractionContract)
  const blockers = [
    ...duplicateIds.map((id) => `重复 Planning interaction contractId：${id}`),
    ...results.flatMap((result) => (result.status === 'unsupported' ? result.blockers : [])),
  ]
  const coveredOperators = new Set(
    results.flatMap((result) => (result.status === 'supported' ? [result.operator] : [])),
  )
  for (const operator of input.requiredOperators ?? [])
    if (!coveredOperators.has(operator))
      blockers.push(`缺少 Planning interaction operator：${operator}`)
  return blockers.length
    ? { status: 'unsupported' as const, blockers: [...new Set(blockers)] }
    : {
        status: 'supported' as const,
        results: results.filter((result) => result.status === 'supported'),
        coveredOperators: [...coveredOperators].sort(),
      }
}
