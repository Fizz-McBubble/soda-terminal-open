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
  }[]
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
