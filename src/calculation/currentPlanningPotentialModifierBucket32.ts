import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PotentialApplicationBinding } from './potentialApplicationBinding'

export type DirectPotentialApplication32 =
  | 'penetration_ratio'
  | 'attack_percent'
  | 'damage_bonus'
  | 'crit_damage'
  | 'resistance_ignore'

export function potentialModifierBucket32(
  effect: PotentialApplicationBinding,
  eventId: string,
  application: DirectPotentialApplication32,
): SourceBackedPlanningEffectBucket {
  const receiver = {
    penetration_ratio: 'pen_',
    attack_percent: 'atk_',
    damage_bonus: 'dmg_',
    crit_damage: 'crit_dmg_',
    resistance_ignore: 'resIgn_',
  }[application]
  return {
    bucketId: `${effect.effectKey}:event:${eventId}`,
    effectKey: effect.effectKey,
    effectId: effect.effectId,
    providerAgentId: effect.providerAgentId,
    recipientAgentIds: [effect.providerAgentId],
    receiverPath: `ownBuff.combat.${receiver}`,
    applicationScope: 'generic',
    action: null,
    attribute: null,
    damageType: null,
    application,
    value: effect.value,
    sourceRefs: [...effect.sourceRefs],
  }
}
