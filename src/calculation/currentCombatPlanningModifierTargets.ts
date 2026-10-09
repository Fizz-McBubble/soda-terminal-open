import type { SourceBackedEquipmentModifierBucket } from './currentPlanningDamageModifiers'

/** One source-stat mapping shared by personal and target-team equipment consumers. */
export const currentCombatPlanningModifierTargets: Readonly<
  Record<string, SourceBackedEquipmentModifierBucket['application']>
> = {
  'combat.atk_': 'attack_percent',
  'combat.crit_': 'crit_rate',
  'combat.crit_dmg_': 'crit_damage',
  'combat.dmg_': 'damage_bonus',
  'combat.common_dmg_': 'damage_bonus',
  'combat.defIgn_': 'defense_ignore',
  'combat.resIgn_': 'resistance_ignore',
  'combat.def_': 'defense_percent',
  'combat.def': 'defense_flat',
  'combat.impact_': 'impact_percent',
  'combat.impact': 'impact_flat',
  'combat.enerRegen_': 'energy_regen_percent',
  'combat.enerRegen': 'energy_regen_flat',
  'combat.shield_': 'shield_percent',
  'combat.dazeInc_': 'daze_increase',
  'combat.dazeRed_': 'daze_reduction',
  'combat.laceration_dmg_': 'laceration_damage',
  'combat.sharp_dmg_': 'sharp_damage_bonus',
  'combat.sheer_dmg_': 'sheer_damage_bonus',
  'combat.sheerForce': 'sheer_force',
  'combat.direct_dmg_': 'direct_damage_bonus',
  'combat.buff_': 'buff_bonus',
}
