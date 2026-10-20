export type CurrentAgentResourceFlowEntry32 = {
  resource: string
  producerParameterKeys?: readonly string[]
  consumerParameterKeys?: readonly string[]
  stateParameterKeys: readonly string[]
}

export type CurrentAgentResourceFlow32 = {
  status: string
  parameters: Readonly<Record<string, unknown>>
  resources: readonly CurrentAgentResourceFlowEntry32[]
  transitionTemplates?: readonly {
    eventKey: string
    resource: string
    operation: string
    parameterKey?: string
    parameterIndex?: number
    condition?: string
  }[]
}

export function applyCurrentAgentResourceTransition32(input: {
  operation: string
  amount: number | null
  current: number
  maximum: number
}) {
  const { operation, amount, current, maximum } = input
  const fail = (reason: string) => ({ status: 'unsupported' as const, reason })
  if (
    ![current, maximum].every(Number.isFinite) ||
    current < 0 ||
    maximum <= 0 ||
    current > maximum
  )
    return fail('resource_state_or_capacity_invalid')
  if (operation !== 'clear' && (amount === null || !Number.isFinite(amount) || amount < 0))
    return fail('resource_action_parameter_invalid')
  let delta: number
  let overflow = 0
  if (operation === 'add' || operation === 'set_to_cap') {
    if (operation === 'set_to_cap' && amount !== maximum)
      return fail('resource_action_cap_unresolved')
    delta = Math.min(amount!, maximum - current)
    overflow = amount! - delta
  } else if (operation === 'set') {
    if (amount! > maximum) return fail('resource_action_set_out_of_bounds')
    delta = amount! - current
  } else if (operation === 'consume') {
    if (amount! > current) return fail('resource_action_consume_out_of_bounds')
    delta = -amount!
  } else if (operation === 'clear') {
    delta = -current
  } else return fail('resource_action_operation_unsupported')
  return {
    status: 'supported' as const,
    delta,
    overflow,
    requestedAmount: operation === 'clear' ? current : amount!,
    valueBefore: current,
    valueAfter: current + delta,
  }
}

/** Execute one adopted action template. Bounds are source inputs, never inferred
 * from cooldowns/thresholds. Return effective deltas for the generic evaluator. */
export function applyCurrentAgentResourceAction32(input: {
  flow: CurrentAgentResourceFlow32
  resource: string
  eventKey: string
  current: number
  maximum: number
}) {
  const { flow, resource, eventKey, current, maximum } = input
  const fail = (reason: string) => ({ status: 'unsupported' as const, reason })
  if (
    ![current, maximum].every(Number.isFinite) ||
    current < 0 ||
    maximum <= 0 ||
    current > maximum
  )
    return fail('resource_state_or_capacity_invalid')
  const matches = flow.transitionTemplates?.filter(
    (entry) => entry.eventKey === eventKey && entry.resource === resource,
  )
  if (matches?.length !== 1) return fail('resource_action_template_missing_or_duplicate')
  const template = matches[0]!
  const raw = template.parameterKey ? flow.parameters[template.parameterKey] : undefined
  const amount =
    template.parameterIndex === undefined
      ? raw
      : Number.isInteger(template.parameterIndex) &&
          template.parameterIndex >= 0 &&
          Array.isArray(raw)
        ? raw[template.parameterIndex]
        : undefined
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
    return fail('resource_action_parameter_invalid')
  let conditionApplied = true
  if (template.condition) {
    const match = /^remaining>([a-z_]+)$/.exec(template.condition)
    const threshold = match ? flow.parameters[match[1]!] : undefined
    if (
      template.operation !== 'consume' ||
      typeof threshold !== 'number' ||
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > maximum
    )
      return fail('resource_action_condition_unsupported')
    conditionApplied = current > threshold
  }
  const transition = conditionApplied
    ? applyCurrentAgentResourceTransition32({
        operation: template.operation,
        amount,
        current,
        maximum,
      })
    : {
        status: 'supported' as const,
        delta: 0,
        overflow: 0,
        requestedAmount: amount,
        valueBefore: current,
        valueAfter: current,
      }
  if (transition.status === 'unsupported') return transition
  return {
    status: 'supported' as const,
    delta: transition.delta,
    overflow: transition.overflow,
    requestedAmount: transition.requestedAmount,
    conditionApplied,
    valueBefore: transition.valueBefore,
    valueAfter: transition.valueAfter,
  }
}

/** Describe actual missing compiler inputs per resource without promoting a
 * named parameter set or one unrelated template to a compiled runtime flow. */
export function inspectCurrentAgentResourceFlow32(flow: CurrentAgentResourceFlow32) {
  return flow.resources.map((resource) => ({
    resource: resource.resource,
    hasProducerOrConsumer: hasRuntimeResourceEdges32(resource),
    initial: resolveCurrentAgentResourceInitialState32(flow, resource),
    eventKeys: (flow.transitionTemplates ?? [])
      .filter((row) => row.resource === resource.resource)
      .map((row) => row.eventKey),
    referencedParametersMissing: [
      ...(resource.producerParameterKeys ?? []),
      ...(resource.consumerParameterKeys ?? []),
      ...resource.stateParameterKeys,
    ].filter((key) => !Object.hasOwn(flow.parameters, key)),
  }))
}

function normalizedKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function finiteParameter(parameters: Readonly<Record<string, unknown>>, keys: readonly string[]) {
  for (const key of keys) {
    const value = parameters[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function hasRuntimeResourceEdges32(resource: CurrentAgentResourceFlowEntry32) {
  return Boolean(resource.producerParameterKeys?.length || resource.consumerParameterKeys?.length)
}

export function resolveCurrentAgentResourceInitialState32(
  flow: CurrentAgentResourceFlow32,
  resource: CurrentAgentResourceFlowEntry32,
) {
  const resourceKey = normalizedKey(resource.resource)
  const initialKeys = Object.keys(flow.parameters).filter((key) => {
    const normalized = normalizedKey(key)
    return (
      normalized.includes(resourceKey) &&
      (normalized.includes('initial') || normalized.includes('starting'))
    )
  })
  const battleEntryKey = flow.transitionTemplates?.find(
    (transition) =>
      transition.resource === resource.resource &&
      transition.eventKey === 'battle_entry' &&
      transition.operation === 'set',
  )?.parameterKey
  const value =
    finiteParameter(flow.parameters, initialKeys) ??
    (battleEntryKey ? finiteParameter(flow.parameters, [battleEntryKey]) : null)
  return value === null
    ? {
        status: 'unknown' as const,
        reason: `${resource.resource}: initial resource state is not declared by the source contract.`,
      }
    : { status: 'declared' as const, value }
}

export function resolveCurrentAgentResourceBounds32(
  flow: CurrentAgentResourceFlow32,
  resource: CurrentAgentResourceFlowEntry32,
) {
  const initial = resolveCurrentAgentResourceInitialState32(flow, resource)
  if (initial.status === 'unknown')
    return { status: 'unknown_initial_value' as const, reason: initial.reason }
  const key = normalizedKey(resource.resource)
  const capKeys = Object.keys(flow.parameters).filter((name) => {
    const normalized = normalizedKey(name)
    return ['cap', 'max', 'maximum'].some((suffix) =>
      [suffix, `${suffix}stacks`, `${suffix}count`, `${suffix}points`, `${suffix}ratio`].some(
        (ending) => normalized === `${key}${ending}` || normalized === `${ending}${key}`,
      ),
    )
  })
  const maximum = finiteParameter(flow.parameters, capKeys)
  if (maximum === null)
    return {
      status: 'unknown_capacity' as const,
      reason: `${resource.resource}: source capacity is not declared; initial values, cooldowns, thresholds and effect caps cannot substitute.`,
    }
  if (initial.value < 0 || !Number.isFinite(maximum) || maximum <= 0 || initial.value > maximum)
    return {
      status: 'invalid_source_bounds' as const,
      reason: `${resource.resource}: initial value and source capacity are inconsistent.`,
    }
  return { status: 'supported' as const, initialValue: initial.value, minimum: 0, maximum }
}

export function isRuntimeResourceFlowCompiled32(
  flow: CurrentAgentResourceFlow32 | null | undefined,
) {
  if (
    flow?.status !== 'compiled' ||
    !flow.transitionTemplates?.length ||
    !flow.resources.length ||
    !flow.resources.some(hasRuntimeResourceEdges32)
  )
    return false
  return flow.resources
    .filter(hasRuntimeResourceEdges32)
    .every(
      (resource) => resolveCurrentAgentResourceInitialState32(flow, resource).status === 'declared',
    )
}
