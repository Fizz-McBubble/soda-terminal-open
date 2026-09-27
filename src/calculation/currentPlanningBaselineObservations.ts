import { stableContentHash } from '../gameDataPacks/types'
import { currentAgentDecisionMechanicContracts } from './currentAgentDecisionMechanicContracts'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from './currentNormalizedPlanningBaseline'
import { getCurrentPlanningInteractionMechanicIR } from './currentPlanningInteractionMechanicIR'
import { compileSourceBackedPlanningInteractionContracts } from './currentPlanningInteractionMechanicIR'
import { type PlanningInteractionContract } from './planningInteractionOperators'

const transitionSeconds = 3
const activeBudgetSeconds =
  currentNormalizedPlanningBaseline.declaredDurationSeconds - transitionSeconds

const fieldTimeWeight: Readonly<Record<string, number>> = Object.freeze({
  dominant_field: 6,
  primary_field: 5,
  shared_rotation: 4,
  burst_swap: 3,
  background: 2,
})

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function capabilitySourceRefs(
  agentId: string,
  operator: 'timed_event_schedule' | 'field_time_opportunity_cost',
) {
  return (
    getCurrentPlanningInteractionMechanicIR(agentId)?.capabilities.find(
      (capability) => capability.operator === operator,
    )?.sourceRefs ?? []
  )
}

function compileAgentObservation(agentId: string) {
  const schedule = compileNormalizedAgentEventSchedule({ agentId })
  if (schedule.status === 'unsupported')
    throw new Error(`PlanningBaseline observation 无法生成：${schedule.blockers.join(' ')}`)
  const planningRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:agent:${agentId}`
  const eventSourceRefs = unique([
    ...capabilitySourceRefs(agentId, 'timed_event_schedule'),
    ...schedule.eventUsages.flatMap((usage) => usage.evidenceRefs),
    planningRef,
  ])
  const fieldTimeSourceRefs = unique([
    ...capabilitySourceRefs(agentId, 'field_time_opportunity_cost'),
    planningRef,
  ])
  return {
    agentId,
    fieldTimeMode: schedule.fieldTimeMode,
    fieldTimeWeight: fieldTimeWeight[schedule.fieldTimeMode] ?? 1,
    actionId: schedule.actionId,
    skill: schedule.skill,
    occurrenceCount: schedule.occurrenceCount,
    normalizedDamageMultiplier: schedule.normalizedDamageMultiplier,
    eventUsages: schedule.eventUsages,
    eventSourceRefs,
    fieldTimeSourceRefs,
    observationHash: stableContentHash({
      baselineId: currentNormalizedPlanningBaseline.baselineId,
      agentId,
      schedule,
      eventSourceRefs,
      fieldTimeSourceRefs,
    }),
  }
}

export const currentPlanningBaselineAgentObservations = Object.freeze(
  currentAgentDecisionMechanicContracts.map((contract) =>
    compileAgentObservation(contract.agentId),
  ),
)

const observationByAgentId = new Map(
  currentPlanningBaselineAgentObservations.map((observation) => [observation.agentId, observation]),
)

function allocateFieldTime(memberIds: readonly string[]) {
  const observations = memberIds.map((agentId) => observationByAgentId.get(agentId))
  if (observations.some((observation) => !observation)) return null
  const ready = observations.filter((observation): observation is NonNullable<typeof observation> =>
    Boolean(observation),
  )
  const totalWeight = ready.reduce((sum, observation) => sum + observation.fieldTimeWeight, 0)
  let allocated = 0
  return ready.map((observation, index) => {
    const activeSeconds =
      index === ready.length - 1
        ? activeBudgetSeconds - allocated
        : (activeBudgetSeconds * observation.fieldTimeWeight) / totalWeight
    allocated += activeSeconds
    return { agentId: observation.agentId, activeSeconds }
  })
}

export function compileCurrentPlanningBaselineTimelineContracts(
  memberIds: readonly [string, string, string],
) {
  if (new Set(memberIds).size !== 3)
    return { status: 'unsupported' as const, blockers: ['固定事件基线要求三名不重复代理人。'] }
  const observations = memberIds.map((agentId) => observationByAgentId.get(agentId))
  const missing = memberIds.filter((_, index) => !observations[index])
  const allocations = allocateFieldTime(memberIds)
  if (missing.length || !allocations)
    return {
      status: 'unsupported' as const,
      blockers: missing.map((agentId) => `缺少 PlanningBaseline observation：${agentId}`),
    }

  const baselineRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}`
  const timedContract: PlanningInteractionContract = {
    contractId: `${currentNormalizedPlanningBaseline.baselineId}:${memberIds.join('+')}:timeline`,
    operator: 'timed_event_schedule',
    authority: 'source_backed',
    durationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
    sourceRefs: unique([
      baselineRef,
      ...observations.flatMap((observation) => observation!.eventSourceRefs),
    ]),
    events: observations.flatMap((observation, index) => {
      const activeSeconds = allocations[index]!.activeSeconds
      return observation!.eventUsages.map((usage) => ({
        eventKey: `${usage.ownerAgentId}:${usage.eventId}`,
        ownerAgentId: usage.ownerAgentId,
        occurrenceCount: usage.occurrenceCount,
        activeSeconds: activeSeconds / observation!.eventUsages.length,
      }))
    }),
  }
  const fieldTimeContract: PlanningInteractionContract = {
    contractId: `${currentNormalizedPlanningBaseline.baselineId}:${memberIds.join('+')}:field-time`,
    operator: 'field_time_opportunity_cost',
    authority: 'source_backed',
    durationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
    transitionSeconds,
    sourceRefs: unique([
      baselineRef,
      ...observations.flatMap((observation) => observation!.fieldTimeSourceRefs),
    ]),
    allocations,
  }
  const contracts = [timedContract, fieldTimeContract]
  const compilation = compileSourceBackedPlanningInteractionContracts({
    memberIds,
    contracts,
    requiredOperators: ['timed_event_schedule', 'field_time_opportunity_cost'],
  })
  return compilation.status === 'unsupported'
    ? compilation
    : {
        status: 'supported' as const,
        contracts,
        sourceCompilation: compilation,
        operatorCompilation: compilation.compilation,
        observationHash: stableContentHash({ memberIds, contracts }),
      }
}

function normalizedKey(value: string) {
  return value.replaceAll('_', '').toLowerCase()
}

function numericParameter(parameters: Readonly<Record<string, unknown>>, keys: readonly string[]) {
  for (const key of keys) {
    const value = parameters[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function resourceBounds(input: {
  resource: string
  parameters: Readonly<Record<string, unknown>>
  stateParameterKeys: readonly string[]
}) {
  const resourceKey = normalizedKey(input.resource)
  const parameterKeys = Object.keys(input.parameters)
  const initialKeys = parameterKeys.filter((key) => {
    const normalized = normalizedKey(key)
    return normalized.includes(resourceKey) && normalized.includes('initial')
  })
  const capKeys = input.stateParameterKeys.filter((key) => {
    const normalized = normalizedKey(key)
    return normalized.includes('cap') || normalized.includes('max')
  })
  const initialValue = numericParameter(input.parameters, initialKeys) ?? 0
  const declaredMaximum = numericParameter(input.parameters, capKeys)
  const stateValues = input.stateParameterKeys.flatMap((key) => {
    const value = input.parameters[key]
    return typeof value === 'number' && Number.isFinite(value) ? [value] : []
  })
  const maximum = Math.max(initialValue, declaredMaximum ?? 0, ...stateValues, 1)
  return { initialValue, minimum: 0, maximum }
}

export function compileCurrentPlanningBaselineResourceContracts(
  memberIds: readonly [string, string, string],
) {
  const baselineRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:neutral-resource-state`
  const contracts: PlanningInteractionContract[] = []
  for (const agentId of memberIds) {
    const contract = currentAgentDecisionMechanicContracts.find((item) => item.agentId === agentId)
    const resourceFlow = contract?.resourceContract?.resourceFlow
    if (!contract || !resourceFlow || resourceFlow.status !== 'compiled') continue
    const parameters = resourceFlow.parameters as Readonly<Record<string, unknown>>
    const capability = getCurrentPlanningInteractionMechanicIR(agentId)?.capabilities.find(
      (item) => item.operator === 'resource_state_transition',
    )
    for (const resource of resourceFlow.resources as readonly {
      resource: string
      stateParameterKeys: readonly string[]
    }[]) {
      const bounds = resourceBounds({
        resource: resource.resource,
        parameters,
        stateParameterKeys: resource.stateParameterKeys,
      })
      contracts.push({
        contractId: `${currentNormalizedPlanningBaseline.baselineId}:${agentId}:resource:${resource.resource}`,
        operator: 'resource_state_transition',
        authority: 'source_backed',
        sourceRefs: unique([baselineRef, ...(capability?.sourceRefs ?? [])]),
        resourceKey: resource.resource,
        ...bounds,
        transitions: [
          {
            atSeconds: 0,
            ownerAgentId: agentId,
            delta: 0,
            reason:
              'The neutral fixed-event baseline does not select a resource-changing transition; the sourced initial state is held constant.',
          },
        ],
      })
    }
  }
  const requiredOperators = contracts.length > 0 ? (['resource_state_transition'] as const) : []
  const compilation = compileSourceBackedPlanningInteractionContracts({
    memberIds,
    contracts,
    requiredOperators,
  })
  return compilation.status === 'unsupported'
    ? compilation
    : {
        status: 'supported' as const,
        contracts,
        sourceCompilation: compilation,
        resourceObservationHash: stableContentHash({ memberIds, contracts }),
      }
}

export const currentPlanningBaselineObservationAudit = Object.freeze({
  contract: 'soda-current-planning-baseline-observation/v1',
  baselineId: currentNormalizedPlanningBaseline.baselineId,
  entityCount: currentPlanningBaselineAgentObservations.length,
  eventScheduleObservationReadyCount: currentPlanningBaselineAgentObservations.filter(
    (observation) => observation.eventUsages.length > 0,
  ).length,
  fieldTimeObservationReadyCount: currentPlanningBaselineAgentObservations.filter(
    (observation) => observation.fieldTimeWeight > 0,
  ).length,
  neutralResourceStateEntityCount: currentAgentDecisionMechanicContracts.filter(
    (contract) => (contract.resourceContract?.resourceFlow.resources.length ?? 0) > 0,
  ).length,
  transitionSeconds,
  activeBudgetSeconds,
  authority: 'declared_fixed_event_planning_baseline',
  dedicatedAdapterCount: 0,
  boundary:
    'These are declared fixed-event comparison observations, not empirical combat seconds or an automatic rotation. Event identities and multipliers remain source-backed; field-time weights are normalized inside the named 30-second PlanningBaseline and are never described as measured play.',
})
