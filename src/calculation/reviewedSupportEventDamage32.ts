import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import { evaluateReviewedSupportTargetCapacity32 } from './reviewedSupportTargetCapacity32'

type Exclusion = { effectKey: string; reason: string; fields: string[]; sourceRefs: string[] }

/** A source capacity becomes damage only for a declared recipient and event.
 * The provider's own veil observation never places every teammate inside it. */
export function bindReviewedSupportEventDamage32(input: {
  members: readonly PlanningEffectRuntimeMember[]
  recipientAgentId: string
  eventId: string
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  disabledSupportProviderIds?: readonly string[]
  equipmentEffectExclusions?: readonly unknown[]
}) {
  const buckets: SourceBackedPlanningEffectBucket[] = []
  const exclusions: Exclusion[] = []
  const provider = input.members.find((member) => member.agentId === 'agent-zhao')
  if (!provider || input.disabledSupportProviderIds?.includes(provider.agentId))
    return { buckets, exclusions }
  const effectKey = `${provider.agentId}:initial_hp_additional_target`
  const recipient = input.members.find((member) => member.agentId === input.recipientAgentId)
  if (!recipient) {
    exclusions.push({
      effectKey,
      reason: '追加增伤缺少具名接受者。',
      fields: ['recipient'],
      sourceRefs: [],
    })
    return { buckets, exclusions }
  }
  const veil = input.baselineReferencesByAgentId?.[recipient.agentId]?.inside_any_ether_veil
  // A declared closed recipient window contributes nothing, independently of
  // the provider's unresolved HP. Do not turn proven inactivity into unknown.
  if (veil === false) return { buckets, exclusions }
  const result = evaluateReviewedSupportTargetCapacity32({
    member: provider,
    members: input.members,
    equipmentExclusions: input.equipmentEffectExclusions,
    baselineReferencesByAgentId: {
      ...input.baselineReferencesByAgentId,
      [provider.agentId]: {
        ...input.baselineReferencesByAgentId?.[provider.agentId],
        inside_any_ether_veil: veil,
      },
    },
  })
  const capacity = result.capacities.find((row) => row.key === effectKey)
  if (!capacity || capacity.value === null) {
    exclusions.push({
      effectKey,
      reason: result.blockers.join('；') || '追加增伤的来源量级尚未就绪。',
      fields: [
        'recipient.inside_any_ether_veil',
        'provider.initial.hp',
        'provider.core',
        'team_activation',
      ],
      sourceRefs: capacity?.sourceRefs ?? [],
    })
    return { buckets, exclusions }
  }
  if (capacity.value > 0)
    buckets.push({
      bucketId: `${effectKey}:event:${recipient.agentId}:${input.eventId}`,
      effectKey,
      effectId: 'reviewed_initial_hp_additional_damage32',
      applicationScope: 'generic',
      providerAgentId: provider.agentId,
      recipientAgentIds: [recipient.agentId],
      receiverPath: 'teamBuff.common.dmg_',
      damageType: null,
      action: null,
      attribute: null,
      application: 'damage_bonus',
      value: capacity.value,
      sourceRefs: capacity.sourceRefs,
    })
  return { buckets, exclusions }
}
