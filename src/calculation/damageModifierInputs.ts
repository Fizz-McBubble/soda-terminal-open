/** Shared final-stat multipliers; formula families keep their own scaling and critical rules. */
export type CommonDamageModifierInput = {
  damageBonus: number
  buffBonus: number
  directDamageBonus: number
  vulnerability: number
  defenseReduction: number
  defenseIgnore: number
  penetrationRatio: number
  penetrationFlat: number
  enemyDefense: number
  resistance: number
  resistanceReduction: number
  resistanceIgnore: number
  stunMultiplier: number
}
