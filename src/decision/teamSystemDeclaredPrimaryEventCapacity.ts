import { calculateCurrentPlanningEventDamage32 } from '../calculation/currentPlanningEventDamage32'
import type { CurrentPlanningEventDamageInput32 } from '../calculation/currentPlanningEventDamage32.types'
import type { TeamSameCoreOutputEvidence } from './teamSameCoreOutputComparison'

/** Bind the owner's base coordinate to the declared packet. Joint support
 * settlement remains separate and is compared only by the same-core consumer. */
export function declaredPrimaryEventCapacity(evidence: TeamSameCoreOutputEvidence) {
  if (
    evidence.prepared.status !== 'ready' ||
    evidence.result.status !== 'supported' ||
    !evidence.eventPacketIdentity
  )
    return null
  if (evidence.input.phoenixCanonicalEvent33)
    return {
      eventPacketIdentity: evidence.eventPacketIdentity,
      value: evidence.result.fixedEventValue,
    }
  const input = evidence.prepared.input
  const member = input.members.find((row) => row.agentId === input.subjectAgentId)
  if (!member) return null
  const exclusions: NonNullable<
    CurrentPlanningEventDamageInput32['eventEffectContext']
  >['exclusions'] = []
  const value = calculateCurrentPlanningEventDamage32({
    member,
    buckets: [],
    eventUsages: input.eventUsages,
    baseline: input.baseline,
    settlementAtSeconds: input.eventObservation?.atSeconds,
    eventEffectContext: {
      memberIds: input.memberIds,
      members: input.members,
      entries: [],
      baselineReferencesByAgentId: input.baselineReferencesByAgentId,
      disabledSupportProviderIds: input.memberIds.filter((id) => id !== input.subjectAgentId),
      consumedBuckets: [],
      exclusions,
    },
  })
  return value !== null && Number.isFinite(value) && value >= 0 && !exclusions.length
    ? { eventPacketIdentity: evidence.eventPacketIdentity, value }
    : null
}
