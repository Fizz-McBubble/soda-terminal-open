import { stableContentHash } from '../gameDataPacks/types'
import { currentAgentDecisionMechanicContracts } from './currentAgentDecisionMechanicContracts'
import { resolveCurrentAgentResourceBounds32 } from './currentAgentResourceFlow32'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from './currentNormalizedPlanningBaseline'
import { getCurrentPlanningInteractionMechanicIR } from './currentPlanningInteractionMechanicIR'
import { compileSourceBackedPlanningInteractionContracts } from './currentPlanningInteractionMechanicIR'
import { type PlanningInteractionContract } from './planningInteractionOperators'
import { compileDeclaredRemielleRadiance32 } from './compileDeclaredRemielleRadiance32'
import { compileDeclaredResourceTimeline32 } from './declaredResourceTimeline32'
import {
  summarizeSourceNamedResourceActionProduction32,
  summarizeNamedResourceProductionFromUsages32,
} from './sourceNamedResourceActionProduction32'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'

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
// The fixed baseline selects the same source packet for an agent in every
// formation. Reuse its immutable production result instead of hashing it anew
// for each candidate team; actual query packets are still compiled separately.
const baselineResourceProductionByAgentId32 = new Map(
  currentPlanningBaselineAgentObservations.map((observation) => [
    observation.agentId,
    summarizeSourceNamedResourceActionProduction32({
      agentId: observation.agentId,
      actionId: observation.actionId,
      occurrenceCount: observation.occurrenceCount,
      sourceRefs: observation.eventSourceRefs,
    }),
  ]),
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

export function compileCurrentPlanningBaselineResourceContracts(
  memberIds: readonly [string, string, string],
  remielleRadiance32?: unknown,
  resourceTimelineDeclaration32?: unknown,
  sourceActionUsages32?: readonly PlanningEventUsage[],
) {
  if (memberIds.some((agentId) => !observationByAgentId.has(agentId)))
    return { status: 'unsupported' as const, blockers: ['resource_baseline_member_unknown'] }
  const resourceTimeline =
    resourceTimelineDeclaration32 === undefined
      ? undefined
      : compileDeclaredResourceTimeline32(resourceTimelineDeclaration32)
  if (
    resourceTimeline &&
    (resourceTimeline.status !== 'declared_resource_production' ||
      resourceTimeline.declaration.durationSeconds !==
        currentNormalizedPlanningBaseline.declaredDurationSeconds ||
      stableContentHash(resourceTimeline.declaration.memberAgentIds) !==
        stableContentHash(memberIds))
  )
    return {
      status: 'unsupported' as const,
      blockers: ['resource_timeline_invalid_for_formation_or_baseline'],
    }
  if (
    resourceTimeline?.status === 'declared_resource_production' &&
    resourceTimeline.declaration.remielle &&
    remielleRadiance32 !== undefined &&
    stableContentHash(resourceTimeline.declaration.remielle) !==
      stableContentHash(remielleRadiance32)
  )
    return {
      status: 'unsupported' as const,
      blockers: ['resource_timeline_duplicate_remielle_declarations_disagree'],
    }
  const declaredRadiance =
    resourceTimeline?.status === 'declared_resource_production' && resourceTimeline.remielle
      ? resourceTimeline.remielle
      : remielleRadiance32 === undefined
        ? undefined
        : compileDeclaredRemielleRadiance32(remielleRadiance32)
  if (
    declaredRadiance &&
    (declaredRadiance.status === 'unsupported' ||
      !memberIds.includes('agent-remielle') ||
      declaredRadiance.durationSeconds !==
        currentNormalizedPlanningBaseline.declaredDurationSeconds)
  )
    return {
      status: 'unsupported' as const,
      blockers: ['declared_remielle_resource_timeline_invalid_for_formation'],
    }
  const baselineRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:neutral-resource-state`
  const selectedActionResourceProduction32 =
    sourceActionUsages32 === undefined
      ? memberIds
          .filter(
            (agentId) =>
              resourceTimeline?.status !== 'declared_resource_production' ||
              (!resourceTimeline.declaration.events.some(
                (event) => event.ownerAgentId === agentId,
              ) &&
                !(resourceTimeline.declaration.remielle && agentId === 'agent-remielle')),
          )
          .map((agentId) => baselineResourceProductionByAgentId32.get(agentId)!)
      : summarizeNamedResourceProductionFromUsages32(sourceActionUsages32).filter(
          (row) =>
            memberIds.includes(row.agentId) &&
            (resourceTimeline?.status !== 'declared_resource_production' ||
              (!resourceTimeline.declaration.events.some(
                (event) => event.ownerAgentId === row.agentId,
              ) &&
                !(resourceTimeline.declaration.remielle && row.agentId === 'agent-remielle'))),
        )
  const contracts: PlanningInteractionContract[] = []
  const resourceStateAudit: Array<{
    agentId: string
    resource: string
    status:
      | 'source_backed'
      | 'not_applicable'
      | 'no_runtime_edges'
      | 'unknown_initial_value'
      | 'unknown_capacity'
      | 'invalid_source_bounds'
    reason?: string
    sourceRefs: readonly string[]
  }> = []
  for (const agentId of memberIds) {
    const contract = currentAgentDecisionMechanicContracts.find((item) => item.agentId === agentId)
    const resourceFlow = contract?.resourceContract?.resourceFlow
    if (!contract || !resourceFlow || resourceFlow.status !== 'compiled') continue
    const capability = getCurrentPlanningInteractionMechanicIR(agentId)?.capabilities.find(
      (item) => item.operator === 'resource_state_transition',
    )
    for (const resource of resourceFlow.resources as readonly {
      resource: string
      producerParameterKeys?: readonly string[]
      consumerParameterKeys?: readonly string[]
      stateParameterKeys: readonly string[]
    }[]) {
      if (!resource.producerParameterKeys?.length && !resource.consumerParameterKeys?.length) {
        resourceStateAudit.push({
          agentId,
          resource: resource.resource,
          status: 'not_applicable',
          reason: `${resource.resource}: no source-backed producer or consumer is compiled.`,
          sourceRefs: unique([
            baselineRef,
            ...(capability?.sourceRefs ?? []),
            resourceFlow.evidenceLocator,
          ]),
        })
        continue
      }
      const bounds = resolveCurrentAgentResourceBounds32(resourceFlow, resource)
      if (bounds.status !== 'supported') {
        resourceStateAudit.push({
          agentId,
          resource: resource.resource,
          status: bounds.status,
          reason: bounds.reason,
          sourceRefs: unique([
            baselineRef,
            ...(capability?.sourceRefs ?? []),
            resourceFlow.evidenceLocator,
          ]),
        })
        continue
      }
      if (contract.readiness.resourceFlow !== 'compiled') {
        resourceStateAudit.push({
          agentId,
          resource: resource.resource,
          status: 'no_runtime_edges',
          reason: `${resource.resource}: resource flow is not runtime-compiled.`,
          sourceRefs: unique([
            baselineRef,
            ...(capability?.sourceRefs ?? []),
            resourceFlow.evidenceLocator,
          ]),
        })
        continue
      }
      resourceStateAudit.push({
        agentId,
        resource: resource.resource,
        status: 'source_backed',
        sourceRefs: unique([
          baselineRef,
          ...(capability?.sourceRefs ?? []),
          resourceFlow.evidenceLocator,
        ]),
      })
      if (
        agentId === 'agent-remielle' &&
        resource.resource === 'floating_radiance' &&
        declaredRadiance?.status === 'declared_resource_arithmetic'
      ) {
        contracts.push({
          ...declaredRadiance.resourceContract,
          sourceRefs: unique([
            ...declaredRadiance.resourceContract.sourceRefs,
            ...(capability?.sourceRefs ?? []),
            `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:declared-radiance:${declaredRadiance.inputFingerprint}`,
          ]),
          transitions: declaredRadiance.resourceContract.transitions.length
            ? declaredRadiance.resourceContract.transitions
            : [
                {
                  atSeconds: 0,
                  ownerAgentId: agentId,
                  delta: 0,
                  reason: 'Explicit initial resource state; no action selected.',
                },
              ],
        })
        continue
      }
      contracts.push({
        contractId: `${currentNormalizedPlanningBaseline.baselineId}:${agentId}:resource:${resource.resource}`,
        operator: 'resource_state_transition',
        authority: 'source_backed',
        sourceRefs: unique([baselineRef, ...(capability?.sourceRefs ?? [])]),
        resourceKey: resource.resource,
        initialValue: bounds.initialValue,
        minimum: bounds.minimum,
        maximum: bounds.maximum,
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
        resourceStateAudit,
        selectedActionResourceProduction32,
        ...(resourceTimeline?.status === 'declared_resource_production'
          ? { resourceTimeline32: resourceTimeline }
          : {}),
        ...(declaredRadiance?.status === 'declared_resource_arithmetic'
          ? { declaredRemielleRadiance32: declaredRadiance }
          : {}),
        sourceCompilation: compilation,
        resourceObservationHash: stableContentHash({
          memberIds,
          contracts,
          resourceStateAudit,
          selectedActionResourceProduction32: selectedActionResourceProduction32.map(
            (row) => row.fingerprint,
          ),
          ...(resourceTimeline?.status === 'declared_resource_production'
            ? { resourceTimeline: resourceTimeline.inputFingerprint }
            : {}),
        }),
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
    (contract) =>
      (contract.resourceContract?.resourceFlow.resources.length ?? 0) > 0 &&
      contract.readiness.resourceFlow === 'compiled',
  ).length,
  pendingResourceStateEntityCount: currentAgentDecisionMechanicContracts.filter(
    (contract) =>
      (contract.resourceContract?.resourceFlow.resources.length ?? 0) > 0 &&
      contract.readiness.resourceFlow !== 'compiled',
  ).length,
  transitionSeconds,
  activeBudgetSeconds,
  authority: 'declared_fixed_event_planning_baseline',
  dedicatedAdapterCount: 0,
  boundary:
    'These are declared fixed-event comparison observations, not empirical combat seconds or an automatic rotation. Event identities and multipliers remain source-backed; field-time weights are normalized inside the named 30-second PlanningBaseline and are never described as measured play.',
})
