import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import {
  bindReviewedPotentialApplications,
  type PotentialApplicationEvent,
  type PotentialInitialStatsProvenance,
} from './potentialApplicationBinding'

/** The occurrence producer must evidence the source's Core Passive PEN buff.
 * The separate 13s potential meter does not establish this condition.
 * No trigger, elapsed time, potential level or initial panel is inferred here.
 */
export function bindReviewedRinaPotentialTeamStats32(input: {
  memberIds: readonly string[]
  members: readonly PlanningEffectRuntimeMember[]
  recipientAgentId: string
  eventId: string
  observation?: PotentialApplicationEvent
  initialStatsProvenance: PotentialInitialStatsProvenance
}) {
  const buckets: SourceBackedPlanningEffectBucket[] = []
  const provider = input.members.find((member) => member.agentId === 'agent-rina')
  const observed = input.observation
  if (
    !provider ||
    !input.memberIds.includes(provider.agentId) ||
    !input.memberIds.includes(input.recipientAgentId) ||
    !input.members.some((member) => member.agentId === input.recipientAgentId) ||
    new Set(input.memberIds).size !== input.memberIds.length ||
    input.memberIds.some(
      (id) => input.members.filter((member) => member.agentId === id).length !== 1,
    ) ||
    input.members.filter((member) => member.agentId === provider.agentId).length !== 1 ||
    provider.potential == null ||
    !Number.isInteger(provider.potential) ||
    provider.potential < 0 ||
    provider.potential > 6 ||
    !Number.isFinite(provider.initialStats.pen_) ||
    provider.initialStats.pen_ < 0 ||
    !observed ||
    observed.eventId !== input.eventId
  )
    return { buckets, applications: [] }

  const applications = bindReviewedPotentialApplications({
    member: {
      agentId: provider.agentId,
      potential: provider.potential,
      initialStats: provider.initialStats,
      provenance: input.initialStatsProvenance,
    },
    event: observed,
  }).filter(
    (effect) =>
      effect.effectId === 'potential_team_attack_per_penetration' ||
      effect.effectId === 'potential_team_defense_per_penetration',
  )
  for (const effect of applications) {
    if (effect.status !== 'applied') continue
    const attack = effect.effectId === 'potential_team_attack_per_penetration'
    buckets.push({
      bucketId: `${effect.effectKey}:event:${input.eventId}:recipient:${input.recipientAgentId}`,
      effectKey: effect.effectKey,
      effectId: effect.effectId,
      applicationScope: 'generic',
      providerAgentId: provider.agentId,
      recipientAgentIds: [...input.memberIds],
      receiverPath: attack ? 'combat.atk' : 'combat.def',
      damageType: null,
      action: null,
      attribute: null,
      application: attack ? 'attack_flat' : 'defense_flat',
      value: effect.value,
      sourceRefs: [...effect.sourceRefs],
    })
  }
  return { buckets, applications }
}
