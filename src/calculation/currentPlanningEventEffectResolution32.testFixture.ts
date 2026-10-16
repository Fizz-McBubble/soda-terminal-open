import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import {
  evaluateSourceBackedPersonalPlanningDps,
  type SourceBackedEquipmentModifierBucket,
} from './currentPlanningTeamDpsRuntime'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'

export const baseline = {
  ...currentNormalizedPlanningBaseline,
  gameVersion: '3.2',
  declaredDurationSeconds: 10,
  enemy: {
    ...currentNormalizedPlanningBaseline.enemy,
    defense: 50,
    resistance: 0,
    stunMultiplier: 1,
    vulnerability: 0,
  },
}

export const usage = (ownerAgentId: string, eventId: string) => ({
  ownerAgentId,
  eventId,
  skillLevel: 1,
  occurrenceCount: 1,
  evidenceRefs: ['independent-explicit-event:test'],
})

export function member(agentId: string): PlanningEffectRuntimeMember {
  const neutral = createLevel60NeutralEffectRuntimeMember(agentId)
  const stats = {
    ...neutral.finalStats,
    atk: 1000,
    def: 400,
    crit_: 0,
    crit_dmg_: 0,
    lacerationDamage: 1.5,
    pen_: 0,
    damageBonus: 0,
    enerRegen: 1.2,
  }
  return { ...neutral, level: 1, coreLevel: 7, initialStats: stats, finalStats: stats }
}

export const claretEvent = 'basic.BasicAttackBloodforgingFourForms.hit-0'

export function potentialFixture(agentId: string, actionId?: string) {
  const actor = member(agentId)
  actor.potential = 6
  actor.initialStats = { ...actor.initialStats, atk: 1000, crit_: 1, crit_dmg_: 1 }
  actor.finalStats = { ...actor.initialStats }
  const event = getCurrentAgentEventContract(agentId)!.eventContract.events.find(
    (row) => !actionId || row.actionId === actionId,
  )!
  return {
    actor,
    event,
    input: { member: actor, eventUsages: [usage(agentId, event.eventId)], baseline },
  }
}

export function potentialDamage(
  input: ReturnType<typeof potentialFixture>['input'],
  observation?: PotentialApplicationEvent,
) {
  const result = evaluateSourceBackedPersonalPlanningDps({
    ...input,
    ...(observation
      ? { potentialEvents: { [`${input.member.agentId}:${observation.eventId}`]: observation } }
      : {}),
  })
  if (result.status !== 'supported') throw new Error(JSON.stringify(result))
  return result
}

export function potentialObservation(
  eventId: string,
  states: string[],
  actions: string[],
): PotentialApplicationEvent {
  return {
    eventId,
    providerStateKeys: states,
    actionFamilies: actions,
    targetStateKeys: [],
    sourceRefs: ['source-reviewed-explicit-event:test'],
  }
}

export function critBucket(value: number): SourceBackedEquipmentModifierBucket {
  return {
    bucketId: 'observed-cr',
    effectKey: 'observed-cr',
    providerAgentId: 'agent-claret',
    recipientAgentIds: ['agent-claret'],
    receiverPath: null,
    damageType: null,
    action: null,
    attribute: null,
    value,
    application: 'crit_rate',
    sourceRefs: ['explicit-event-cr:test'],
  }
}
