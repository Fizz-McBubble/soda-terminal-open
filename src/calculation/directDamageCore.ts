export const directDamageCoreVersion = 'soda-direct-damage-core-r25-v1' as const

/**
 * R25 versioned attacker-level defense coefficients. Index 0 represents level 1.
 * Values above level 60 are intentionally rejected instead of extrapolated.
 */
export const attackerLevelDefenseCoefficients = Object.freeze([
  50, 54, 58, 62, 66, 71, 76, 82, 88, 94, 100, 107, 114, 121, 129, 137, 145, 153, 162, 172, 181,
  191, 201, 211, 222, 233, 245, 256, 268, 281, 293, 306, 319, 333, 347, 361, 375, 390, 405, 421,
  436, 452, 469, 485, 502, 519, 537, 555, 573, 592, 610, 629, 649, 669, 689, 709, 730, 751, 772,
  794,
] as const)

export function resolveAttackerLevelDefenseCoefficient(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > attackerLevelDefenseCoefficients.length)
    throw new Error(
      'attacker level must resolve through the versioned level 1-60 coefficient table',
    )
  return attackerLevelDefenseCoefficients[level - 1]!
}

export type StandardDirectDamageCoreInput = {
  attackerLevel: number
  attack: number
  attackPercent: number
  attackFlat: number
  multiplier: number
  hitCount: number
  critRate: number
  critDamage: number
  damageBonus: number
  vulnerability: number
  defenseReduction: number
  penetrationRatio: number
  penetrationFlat: number
  resistance: number
  resistanceReduction: number
  stunMultiplier: number
  enemyDefense: number
}

export type StandardDirectDamageCoreResult = {
  nonCriticalDamage: number
  criticalDamage: number
  expectedDamage: number
  factors: {
    effectiveAttack: number
    skillMultiplier: number
    hitCount: number
    damageBonusMultiplier: number
    vulnerabilityMultiplier: number
    expectedCritMultiplier: number
    defenseMultiplier: number
    resistanceMultiplier: number
    stunMultiplier: number
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function assertFiniteInputs(input: StandardDirectDamageCoreInput) {
  for (const [field, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) throw new Error(`direct damage input ${field} must be finite`)
  }
  if (input.attack <= 0) throw new Error('direct damage attack must be positive')
  if (input.multiplier <= 0) throw new Error('direct damage multiplier must be positive')
  if (!Number.isInteger(input.hitCount) || input.hitCount < 1)
    throw new Error('direct damage hit count must be a positive integer')
  if (input.enemyDefense < 0) throw new Error('enemy defense must be nonnegative')
  if (input.penetrationFlat < 0) throw new Error('flat penetration must be nonnegative')
  if (input.stunMultiplier <= 0) throw new Error('stun multiplier must be positive')
}

/** The single full-precision standard direct-damage core shared by every adapter. */
export function calculateStandardDirectDamageCore(
  input: StandardDirectDamageCoreInput,
): StandardDirectDamageCoreResult {
  assertFiniteInputs(input)
  const defenseCoefficient = resolveAttackerLevelDefenseCoefficient(input.attackerLevel)
  const effectiveAttack = input.attack * (1 + input.attackPercent) + input.attackFlat
  const critRate = clamp(input.critRate, 0, 1)
  const critDamage = Math.max(0, input.critDamage)
  const expectedCritMultiplier = 1 + critRate * critDamage
  const effectiveDefense = Math.max(
    0,
    input.enemyDefense *
      (1 - clamp(input.defenseReduction, 0, 0.99)) *
      (1 - clamp(input.penetrationRatio, 0, 0.99)) -
      input.penetrationFlat,
  )
  const defenseMultiplier = defenseCoefficient / (defenseCoefficient + effectiveDefense)
  const resistanceMultiplier = Math.max(0, 1 - (input.resistance - input.resistanceReduction))
  const damageBonusMultiplier = 1 + input.damageBonus
  const vulnerabilityMultiplier = 1 + input.vulnerability
  const nonCriticalDamage =
    effectiveAttack *
    input.multiplier *
    input.hitCount *
    damageBonusMultiplier *
    vulnerabilityMultiplier *
    defenseMultiplier *
    resistanceMultiplier *
    input.stunMultiplier
  return {
    nonCriticalDamage,
    criticalDamage: nonCriticalDamage * (1 + critDamage),
    expectedDamage: nonCriticalDamage * expectedCritMultiplier,
    factors: {
      effectiveAttack,
      skillMultiplier: input.multiplier,
      hitCount: input.hitCount,
      damageBonusMultiplier,
      vulnerabilityMultiplier,
      expectedCritMultiplier,
      defenseMultiplier,
      resistanceMultiplier,
      stunMultiplier: input.stunMultiplier,
    },
  }
}
