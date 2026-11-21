import type { PlanningEventSchedule32 } from '../calculation/planningEventOccurrenceState32'
import { calculateCommonAnomalySettlement32 } from '../calculation/currentCommonAnomalySettlement32'
import {
  compilePlanningAnomalyLifecycle32,
  type PlanningAnomalyLifecycle32,
} from '../calculation/currentPlanningAnomalyLifecycle32'
import {
  bindTriggerAftershockWindow32,
  triggerAftershockFormulaRef32,
  triggerAftershockWindowIdentity32,
} from '../calculation/triggerAftershockWindow32'
import { stableContentHash } from '../gameDataPacks/types'

export const teamSameCoreApplicableCoordinatesContract =
  'soda-team-same-core-applicable-coordinates/v1' as const

export const teamSameCoreApplicableCoordinatesPolicy = Object.freeze({
  contract: teamSameCoreApplicableCoordinatesContract,
  systems: ['attribute_anomaly', 'aftershock'] as const,
  anomalyCoordinate: 'declared-homogeneous-anomaly-settlement',
  aftershockCoordinate: 'declared-accepted-trigger-hit-window',
  crossSystem: 'incomparable',
  boundary:
    'Coordinates preserve anomaly settlement and Trigger aftershock window ownership separately. Neither coordinate is a direct-event substitute, complete rotation, uptime estimate, account observation or DPS.',
} as const)

export type TeamSameCoreApplicableCoordinate =
  | {
      status: 'supported'
      contract: typeof teamSameCoreApplicableCoordinatesContract
      system: 'attribute_anomaly'
      outputOwnerAgentId: string
      consumingAgentId: string
      eventId: string
      targetId: string
      sourcePacketIdentity: string
      state: 'active' | 'inactive'
      settledDamage: number
      sourceRefs: readonly string[]
      boundary: string
      identity: string
    }
  | {
      status: 'supported'
      contract: typeof teamSameCoreApplicableCoordinatesContract
      system: 'aftershock'
      outputOwnerAgentId: 'agent-trigger'
      consumingAgentIds: readonly string[]
      targetId: string
      sourcePacketIdentity: string
      state: 'active' | 'inactive' | 'unknown'
      activeOccurrenceIds: readonly string[]
      inactiveOccurrenceIds: readonly string[]
      unknownOccurrenceIds: readonly string[]
      sourceRefs: readonly string[]
      boundary: string
      identity: string
    }
  | {
      status: 'unsupported'
      contract: typeof teamSameCoreApplicableCoordinatesContract
      system: 'attribute_anomaly' | 'aftershock'
      blockers: readonly string[]
      boundary: string
    }

export function projectAttributeAnomalyApplicableCoordinate(input: {
  declaration: PlanningAnomalyLifecycle32
  memberIds: readonly string[]
  eventId?: string
  ownerAgentId?: string
  targetId?: string
}): TeamSameCoreApplicableCoordinate {
  const compiled = compilePlanningAnomalyLifecycle32(input)
  if (compiled.status !== 'supported')
    return {
      status: 'unsupported',
      contract: teamSameCoreApplicableCoordinatesContract,
      system: 'attribute_anomaly',
      blockers: compiled.blockers,
      boundary: teamSameCoreApplicableCoordinatesPolicy.boundary,
    }
  try {
    const settled = calculateCommonAnomalySettlement32(compiled.original)
    const identity = stableContentHash({
      contract: teamSameCoreApplicableCoordinatesContract,
      system: 'attribute_anomaly',
      fingerprint: compiled.fingerprint,
      event: compiled.event,
      active: compiled.active,
      settledDamage: settled.expectedDamage,
    })
    return {
      status: 'supported',
      contract: teamSameCoreApplicableCoordinatesContract,
      system: 'attribute_anomaly',
      outputOwnerAgentId: compiled.original.triggerAgentId,
      consumingAgentId: compiled.event.ownerAgentId,
      eventId: compiled.event.eventId,
      targetId: compiled.event.targetId,
      sourcePacketIdentity: compiled.fingerprint,
      state: compiled.active ? 'active' : 'inactive',
      settledDamage: settled.expectedDamage,
      sourceRefs: compiled.sourceRefs,
      boundary: teamSameCoreApplicableCoordinatesPolicy.boundary,
      identity,
    }
  } catch (error) {
    return {
      status: 'unsupported',
      contract: teamSameCoreApplicableCoordinatesContract,
      system: 'attribute_anomaly',
      blockers: [error instanceof Error ? error.message : 'anomaly_coordinate_failed'],
      boundary: teamSameCoreApplicableCoordinatesPolicy.boundary,
    }
  }
}

export function projectAftershockApplicableCoordinate(input: {
  schedule: PlanningEventSchedule32
  memberIds: readonly string[]
  targetId: string
}): TeamSameCoreApplicableCoordinate {
  const bound = bindTriggerAftershockWindow32(input)
  if (bound.status !== 'supported' || bound.states === null)
    return {
      status: 'unsupported',
      contract: teamSameCoreApplicableCoordinatesContract,
      system: 'aftershock',
      blockers:
        bound.status === 'unsupported' ? bound.blockers : ['aftershock_window_not_declared'],
      boundary: teamSameCoreApplicableCoordinatesPolicy.boundary,
    }
  const triggerHitOccurrenceIds = new Set(
    input.schedule.occurrences
      .filter(
        (row) =>
          row.ownerAgentId === 'agent-trigger' &&
          row.sourceRefs.includes(triggerAftershockFormulaRef32),
      )
      .map((row) => row.occurrenceId),
  )
  const consumingStates = Object.entries(bound.states).filter(
    ([occurrenceId]) => !triggerHitOccurrenceIds.has(occurrenceId),
  )
  const activeOccurrenceIds = consumingStates
    .filter(([, state]) => state.active === true)
    .map(([occurrenceId]) => occurrenceId)
    .sort()
  const inactiveOccurrenceIds = consumingStates
    .filter(([, state]) => state.active === false)
    .map(([occurrenceId]) => occurrenceId)
    .sort()
  const unknownOccurrenceIds = consumingStates
    .filter(([, state]) => state.active === undefined)
    .map(([occurrenceId]) => occurrenceId)
    .sort()
  const state =
    activeOccurrenceIds.length > 0
      ? ('active' as const)
      : inactiveOccurrenceIds.length > 0 && unknownOccurrenceIds.length === 0
        ? ('inactive' as const)
        : ('unknown' as const)
  const sourceRefs = [
    ...new Set(Object.values(bound.states).flatMap((row) => row.sourceRefs)),
  ].sort()
  const consumingAgentIds = [
    ...new Set(
      input.schedule.occurrences
        .filter((row) => Object.hasOwn(bound.states!, row.occurrenceId))
        .map((row) => row.ownerAgentId),
    ),
  ].sort()
  const identity = stableContentHash({
    contract: teamSameCoreApplicableCoordinatesContract,
    system: 'aftershock',
    sourcePacketIdentity: triggerAftershockWindowIdentity32,
    targetId: input.targetId,
    activeOccurrenceIds,
    inactiveOccurrenceIds,
    unknownOccurrenceIds,
    consumingAgentIds,
  })
  return {
    status: 'supported',
    contract: teamSameCoreApplicableCoordinatesContract,
    system: 'aftershock',
    outputOwnerAgentId: 'agent-trigger',
    consumingAgentIds,
    targetId: input.targetId,
    sourcePacketIdentity: triggerAftershockWindowIdentity32,
    state,
    activeOccurrenceIds,
    inactiveOccurrenceIds,
    unknownOccurrenceIds,
    sourceRefs,
    boundary: teamSameCoreApplicableCoordinatesPolicy.boundary,
    identity,
  }
}

export function compareSameCoreApplicableCoordinates(
  left: TeamSameCoreApplicableCoordinate,
  right: TeamSameCoreApplicableCoordinate,
): 'active' | 'inactive' | 'tie' | 'incomparable' {
  if (left.status !== 'supported' || right.status !== 'supported' || left.system !== right.system)
    return 'incomparable'
  if (left.state === right.state) return 'tie'
  if (left.state === 'active' && right.state === 'inactive') return 'active'
  if (left.state === 'inactive' && right.state === 'active') return 'inactive'
  return 'incomparable'
}
