import { z } from 'zod'

const finite = z.number().finite()
const positive = finite.positive()
const nonnegative = finite.nonnegative()

/** Forward operands emitted by a source-bound rotation state engine. Neither
 * observed damage nor an output-derived scale is an operand. */
export const resolvedCombatSettlementSchema = z.discriminatedUnion('family', [
  z.object({
    family: z.literal('direct'),
    scalingValue: positive,
    motionValue: positive,
    extraDamageRatio: finite.optional(),
    baseDamageIncreasePercentage: finite.optional(),
    baseDamageIncrease: finite.optional(),
    hitCount: z.number().int().positive(),
    damageBonus: finite,
    directDamageBonus: finite,
    sheerDamageBonus: finite,
    sharpDamageBonus: finite,
    critMultiplier: nonnegative,
    attenuationMultiplier: nonnegative,
    stunMultiplier: positive,
  }).strict(),
  z.object({
    family: z.literal('anomaly'),
    snapshotAttack: positive,
    baseMultiplier: positive,
    damageBonus: finite,
    buffBonus: finite,
    resistance: finite,
    defenseMultiplier: nonnegative,
    stunMultiplier: positive,
    vulnerability: finite,
    anomalyProficiency: nonnegative,
    levelMultiplier: positive,
    reactionMultiplier: positive,
    critMultiplier: nonnegative,
    occurrences: positive,
  }).strict(),
  z.object({
    family: z.literal('anomaly-weighted-snapshot'),
    // The independent engine's weighted base already contains the elemental
    // anomaly coefficient. It is neither one actor's ATK nor observed damage.
    snapshotBase: nonnegative,
    disorderRatio: nonnegative,
    polarityRatio: nonnegative,
    yanagiAP: nonnegative,
    additionalApRatio: nonnegative,
    abloomRatio: nonnegative,
    damageBonusFactor: nonnegative,
    anomalyProficiencyFactor: nonnegative,
    levelFactor: positive,
    anomalyBonusFactor: nonnegative,
    critFactor: nonnegative,
    defenseFactor: nonnegative,
    resistanceFactor: nonnegative,
    vulnerabilityFactor: nonnegative,
    stunFactor: positive,
    specialFactor: nonnegative,
    scalingFactor: nonnegative,
  }).strict(),
])

export type ResolvedCombatSettlement = z.infer<typeof resolvedCombatSettlementSchema>
export const resolvedCombatSettlementVersion = 'soda-resolved-combat-settlement/v3'

/** Same direct/anomaly multiplication channels as the shared cores, with the
 * already-resolved state factors retained explicitly instead of inventing a
 * CRIT rate, defense value or buff to fit a supplied damage number. */
export function calculateResolvedCombatSettlement(input: ResolvedCombatSettlement) {
  const x = resolvedCombatSettlementSchema.parse(input)
  const damage = x.family === 'direct'
    ? (x.scalingValue * (x.motionValue + (x.extraDamageRatio ?? 0))
      * (1 + (x.baseDamageIncreasePercentage ?? 0)) + (x.baseDamageIncrease ?? 0))
      * x.hitCount * (1 + x.damageBonus)
      * (1 + x.directDamageBonus) * (1 + x.sheerDamageBonus) * (1 + x.sharpDamageBonus)
      * x.critMultiplier * x.attenuationMultiplier * x.stunMultiplier
    : x.family === 'anomaly' ? x.snapshotAttack * x.baseMultiplier * (1 + x.damageBonus) * (1 + x.buffBonus)
      * Math.max(0, 1 - x.resistance) * x.defenseMultiplier * x.stunMultiplier
      * (1 + x.vulnerability) * x.anomalyProficiency / 100 * x.levelMultiplier
      * x.reactionMultiplier * x.critMultiplier * x.occurrences
    : (x.snapshotBase * x.disorderRatio * x.polarityRatio + x.yanagiAP * x.additionalApRatio)
      * x.abloomRatio * x.damageBonusFactor * x.anomalyProficiencyFactor * x.levelFactor
      * x.anomalyBonusFactor * x.critFactor * x.defenseFactor * x.resistanceFactor
      * x.vulnerabilityFactor * x.stunFactor * x.specialFactor * x.scalingFactor
  if (!Number.isFinite(damage) || damage < 0) throw new Error('invalid_resolved_settlement')
  return damage
}
