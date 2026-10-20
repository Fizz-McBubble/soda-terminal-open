import contexts from '../gameDataPacks/reviewedDecision32Contexts.json'
import { contentHash } from '../application/contentHash'
import { compileDeclaredRemielleRadiance32 } from './compileDeclaredRemielleRadiance32'
import { applyCurrentAgentResourceTransition32 } from './currentAgentResourceFlow32'
import { compileReviewedNamedResourcePotentialEffects32 } from './reviewedNamedResourcePotentialEffects32'
import { reviewedJaneResourceProductionContract32 } from './sourceJaneResourceProduction32'
import { reviewedStarlightBillyResourceProductionContract32 } from './sourceStarlightBillyResourceProduction32'

import { resourceTimelineDeclarationSchema32 } from './resourceTimelineDeclarationContract32'
export {
  resourceTimelineDeclarationSchema32,
  type ResourceTimelineDeclaration32,
} from './resourceTimelineDeclarationContract32'

export type ReviewedNamedResourceProductionContract32 = {
  agentId: string
  source: { commit: string; path: string; sha256: string }
  formulaSource?: { commit: string; path: string; sha256: string }
  rules: Array<{
    eventKey: string
    resource: string
    operation:
      | 'add'
      | 'consume'
      | 'add_per_unit'
      | 'consume_per_unit'
      | 'set_to_cap'
      | 'clear'
      | 'grant_state'
    amount: number | null
    unit: string
    quantityUnit?: string
    maximumQuantity?: number
    quantityStep?: number
    conversionStep?: number
    carryAcrossEvents?: boolean
    cooldownSeconds?: number
    conditionKeys: string[]
    locator: string
    sourceRef?: string
  }>
  resourceStates?: Array<{
    resource: string
    unit: string
    minimum: number
    maximum: number
    locator: string
  }>
  potentialEffects?: Array<{
    effectKey: string
    eventKey: string
    amount: number
    unit: string
    minimumPotential: number
    conditionKey: string
    scaleByConsumedStacks: boolean
    requiresConsumption: boolean
    oncePerEvent: boolean
    durationSeconds?: number
    locator: string
  }>
  nonResourceStates: string[]
  unresolved: string[]
}

const sharedNamedResourceProductionContracts32 = (
  contexts as unknown as {
    namedResourceProductionContracts: ReviewedNamedResourceProductionContract32[]
  }
).namedResourceProductionContracts

/** Resource-specific current-release pages can replace their shared placeholder
 * contract without changing the Main-owned reviewed decision pack. */
export const reviewedNamedResourceProductionContracts32: readonly ReviewedNamedResourceProductionContract32[] =
  sharedNamedResourceProductionContracts32.map((contract) =>
    contract.agentId === 'agent-jane'
      ? reviewedJaneResourceProductionContract32
      : contract.agentId === 'agent-starlight-billy'
        ? reviewedStarlightBillyResourceProductionContract32
        : contract,
  )
export const resourceTimelineSourceIdentityHash32 = contentHash(
  reviewedNamedResourceProductionContracts32,
)

/** Production and expenditure are before receipt/capacity. Known action facts
 * remain usable when a full resource cycle/initial state is unavailable. */
export function compileDeclaredResourceTimeline32(raw: unknown) {
  const limits = {
    completeResourceCycle: false as const,
    formalCycleReady: false as const,
    boundary:
      '显式事件的来源化资源产出/消耗；动作次数、条件与有效时钟由声明提供，容量/实际收取/循环不推定。',
  }
  const fail = (blocker: string) => ({
    status: 'unsupported' as const,
    blockers: [blocker],
    ...limits,
  })
  const parsed = resourceTimelineDeclarationSchema32.safeParse(raw)
  if (!parsed.success) return fail('resource_timeline_declaration_invalid')
  const input = parsed.data
  if (
    input.sourceIdentityHash !== resourceTimelineSourceIdentityHash32 ||
    new Set(input.memberAgentIds).size !== 3
  )
    return fail('resource_timeline_source_or_formation_mismatch')
  if (
    new Set(input.events.map((event) => event.id)).size !== input.events.length ||
    input.events.some(
      (event, index) =>
        !input.memberAgentIds.includes(event.ownerAgentId) ||
        event.atSeconds > input.durationSeconds ||
        (index > 0 && event.atSeconds < input.events[index - 1]!.atSeconds),
    )
  )
    return fail('resource_timeline_event_identity_or_order_invalid')
  const remielle = input.remielle ? compileDeclaredRemielleRadiance32(input.remielle) : undefined
  if (
    remielle &&
    (remielle.status !== 'declared_resource_arithmetic' ||
      input.remielle!.durationSeconds !== input.durationSeconds ||
      contentHash(input.remielle!.memberAgentIds) !== contentHash(input.memberAgentIds))
  )
    return fail('resource_timeline_remielle_member_or_clock_mismatch')
  const outputs: Array<{
    eventId: string
    agentId: string
    resource: string
    atSeconds: number
    effectiveInterval?: {
      startSeconds: number
      endSeconds: number
    }
    operation: string
    amount: number | null
    unit: string
    status: 'known' | 'condition_unknown' | 'not_applied'
    sourceRef: string
    stateBefore?: number | null
    stateAfter?: number | null
    consumedFromState?: number | null
  }> = []
  const potentialEffectOutputs: Array<
    ReturnType<typeof compileReviewedNamedResourcePotentialEffects32>[number] & {
      eventId: string
      agentId: string
    }
  > = []
  const lastTriggered = new Map<string, number>()
  const conversionCarry = new Map<string, number>()
  const effectiveSecondsByClock = new Map<
    string,
    Array<{ eventId: string; startSeconds: number; endSeconds: number }>
  >()
  const stateValues = new Map(Object.entries(input.initialResourceValues ?? {}))
  for (const event of input.events) {
    const contract = reviewedNamedResourceProductionContracts32.find(
      (entry) => entry.agentId === event.ownerAgentId,
    )
    const rules = contract?.rules.filter((rule) => rule.eventKey === event.eventKey)
    if (!contract || !rules?.length)
      return fail(`resource_timeline_event_not_source_backed:${event.id}`)
    /**
     * `atSeconds` follows the existing schedule convention: it is the start of
     * the declared interval. This rule applies only when the source explicitly
     * labels quantity as effective seconds; other quantity units retain their
     * own meaning and are never converted into time.
     */
    const effectiveSecondResources = [
      ...new Set(
        rules
          .filter((rule) => rule.quantityUnit === 'effective_seconds')
          .map((rule) => rule.resource),
      ),
    ]
    if (effectiveSecondResources.length && event.quantity === undefined)
      return fail(`resource_timeline_quantity_unit_invalid:${event.id}`)
    for (const resource of effectiveSecondResources) {
      const quantity = event.quantity!
      const startSeconds = event.atSeconds
      const endSeconds = startSeconds + quantity
      if (startSeconds < 0 || endSeconds > input.durationSeconds + 1e-9)
        return fail(`resource_timeline_effective_seconds_bounds_invalid:${event.id}`)
      const clockKey = `${event.ownerAgentId}:${resource}`
      const prior = effectiveSecondsByClock.get(clockKey) ?? []
      const declaredTotal = prior.reduce(
        (total, interval) => total + interval.endSeconds - interval.startSeconds,
        0,
      )
      if (declaredTotal + quantity > input.durationSeconds + 1e-9)
        return fail(`resource_timeline_effective_seconds_total_exceeded:${event.id}`)
      if (
        prior.some(
          (interval) =>
            startSeconds + 1e-9 < interval.endSeconds && endSeconds - 1e-9 > interval.startSeconds,
        )
      )
        return fail(`resource_timeline_effective_seconds_overlap:${event.id}`)
      prior.push({ eventId: event.id, startSeconds, endSeconds })
      effectiveSecondsByClock.set(clockKey, prior)
    }
    let consumedStacks: number | null = null
    for (const rule of rules) {
      if (
        (rule.operation.endsWith('_per_unit') && event.quantity === undefined) ||
        (!rule.operation.endsWith('_per_unit') && event.quantity !== undefined)
      )
        return fail(`resource_timeline_quantity_unit_invalid:${event.id}`)
      if (rule.maximumQuantity !== undefined && (event.quantity ?? 1) > rule.maximumQuantity)
        return fail(`resource_timeline_quantity_out_of_source_bounds:${event.id}`)
      if (
        rule.quantityStep !== undefined &&
        event.quantity !== undefined &&
        Math.abs(
          event.quantity / rule.quantityStep - Math.round(event.quantity / rule.quantityStep),
        ) > 1e-9
      )
        return fail(`resource_timeline_discrete_conversion_quantity_invalid:${event.id}`)
      const knownFalse = rule.conditionKeys.some((key) => event.conditions[key] === false)
      const missing =
        !knownFalse && rule.conditionKeys.some((key) => event.conditions[key] === undefined)
      const key = `${event.ownerAgentId}:${rule.eventKey}:${rule.resource}`
      const previous = lastTriggered.get(key)
      if (
        !knownFalse &&
        !missing &&
        rule.cooldownSeconds !== undefined &&
        previous !== undefined &&
        event.atSeconds - previous < rule.cooldownSeconds
      )
        return fail(`resource_timeline_source_cooldown_violated:${event.id}`)
      if (!knownFalse && !missing) lastTriggered.set(key, event.atSeconds)
      let quantity = event.quantity ?? 1
      if (rule.conversionStep !== undefined && !knownFalse && !missing) {
        const accumulated =
          quantity + (rule.carryAcrossEvents ? (conversionCarry.get(key) ?? 0) : 0)
        quantity = Math.floor(accumulated / rule.conversionStep)
        if (rule.carryAcrossEvents)
          conversionCarry.set(key, accumulated - quantity * rule.conversionStep)
      }
      const amount = knownFalse
        ? 0
        : missing || rule.amount === null
          ? null
          : rule.amount * quantity
      const effectiveInterval =
        rule.quantityUnit === 'effective_seconds'
          ? {
              startSeconds: event.atSeconds,
              endSeconds: event.atSeconds + (event.quantity ?? 0),
            }
          : undefined
      if (amount !== null && !Number.isFinite(amount))
        return fail('resource_timeline_nonfinite_production')
      const stateContract = contract.resourceStates?.find(
        (state) => state.resource === rule.resource,
      )
      let stateBefore: number | null | undefined
      let stateAfter: number | null | undefined
      let consumedFromState: number | null | undefined
      if (stateContract) {
        const stateKey = `${event.ownerAgentId}:${rule.resource}`
        const current = stateValues.get(stateKey)
        if (
          current === undefined ||
          !Number.isFinite(current) ||
          current < stateContract.minimum ||
          current > stateContract.maximum
        )
          return fail(`resource_timeline_initial_resource_missing_or_invalid:${rule.resource}`)
        stateBefore = current
        if (missing) {
          stateAfter = null
          consumedFromState = null
        } else {
          const transition = knownFalse
            ? {
                status: 'supported' as const,
                delta: 0,
                overflow: 0,
                requestedAmount: 0,
                valueBefore: current,
                valueAfter: current,
              }
            : applyCurrentAgentResourceTransition32({
                operation:
                  rule.operation === 'add_per_unit'
                    ? 'add'
                    : rule.operation === 'consume_per_unit'
                      ? 'consume'
                      : rule.operation,
                amount:
                  rule.operation === 'set_to_cap' && amount === null
                    ? stateContract.maximum
                    : amount,
                current,
                maximum: stateContract.maximum,
              })
          if (transition.status === 'unsupported')
            return fail(
              `resource_timeline_state_transition_invalid:${event.id}:${transition.reason}`,
            )
          stateAfter = transition.valueAfter
          stateValues.set(stateKey, stateAfter)
          consumedFromState = transition.delta < 0 ? -transition.delta : 0
          if (consumedFromState !== null) consumedStacks = (consumedStacks ?? 0) + consumedFromState
        }
      }
      outputs.push({
        eventId: event.id,
        agentId: event.ownerAgentId,
        resource: rule.resource,
        atSeconds: event.atSeconds,
        ...(effectiveInterval === undefined ? {} : { effectiveInterval }),
        operation: rule.operation,
        amount,
        unit: rule.unit,
        status: knownFalse ? 'not_applied' : missing ? 'condition_unknown' : 'known',
        sourceRef:
          (rule.sourceRef ? `${rule.sourceRef}#${rule.locator}` : undefined) ??
          `upstream:${contract.source.commit}:${contract.source.path}:${contract.source.sha256}#${rule.locator}`,
        ...(stateBefore === undefined ? {} : { stateBefore }),
        ...(stateAfter === undefined ? {} : { stateAfter }),
        ...(consumedFromState === undefined ? {} : { consumedFromState }),
      })
    }
    potentialEffectOutputs.push(
      ...compileReviewedNamedResourcePotentialEffects32({
        contract,
        eventKey: event.eventKey,
        conditions: event.conditions,
        consumedStacks,
      }).map((effect) => ({ ...effect, eventId: event.id, agentId: event.ownerAgentId })),
    )
  }
  const resourceKeys = [...new Set(outputs.map((row) => `${row.agentId}:${row.resource}`))]
  const totals = resourceKeys.map((key) => {
    const rows = outputs.filter((row) => `${row.agentId}:${row.resource}` === key)
    const contract = reviewedNamedResourceProductionContracts32.find(
      (entry) => entry.agentId === rows[0]!.agentId,
    )
    const stateContract = contract?.resourceStates?.find(
      (state) => state.resource === rows[0]!.resource,
    )
    const generated = rows.filter(
      (row) => row.operation === 'add' || row.operation === 'add_per_unit',
    )
    const spent = rows.filter(
      (row) => row.operation === 'consume' || row.operation === 'consume_per_unit',
    )
    const sum = (entries: typeof rows) =>
      entries.some((row) => row.amount === null)
        ? null
        : entries.reduce((total, row) => total + row.amount!, 0)
    return {
      agentId: rows[0]!.agentId,
      resource: rows[0]!.resource,
      unit: rows[0]!.unit,
      generatedBeforeCap: sum(generated),
      requestedExpenditure: sum(spent),
      receiptAndCapacity: stateContract
        ? ('source_bounded_declared' as const)
        : ('not_inferred' as const),
      conditionStatus: rows.some((row) => row.status === 'condition_unknown')
        ? ('unknown' as const)
        : ('declared' as const),
      ...(stateContract
        ? {
            minimum: stateContract.minimum,
            maximum: stateContract.maximum,
            terminalState: stateValues.has(key) ? stateValues.get(key)! : null,
            generatedWithinState: rows.some(
              (row) => row.stateBefore === null || row.stateAfter === null,
            )
              ? null
              : rows.reduce(
                  (sum, row) =>
                    sum +
                    (row.stateBefore !== undefined &&
                    row.stateBefore !== null &&
                    row.stateAfter !== undefined &&
                    row.stateAfter !== null
                      ? Math.max(0, row.stateAfter - row.stateBefore)
                      : 0),
                  0,
                ),
            consumedFromState: rows.some((row) => row.consumedFromState === null)
              ? null
              : rows.reduce((sum, row) => sum + (row.consumedFromState ?? 0), 0),
          }
        : {}),
      symbolicTransitions: rows.filter(
        (row) =>
          row.operation === 'clear' ||
          row.operation === 'set_to_cap' ||
          row.operation === 'grant_state',
      ),
    }
  })
  return {
    status: 'declared_resource_production' as const,
    inputFingerprint: contentHash(input),
    declaration: input,
    totals,
    sourceIdentityHash: resourceTimelineSourceIdentityHash32,
    outputs,
    potentialEffectOutputs,
    remielle,
    blockers: [],
    ...limits,
  }
}
