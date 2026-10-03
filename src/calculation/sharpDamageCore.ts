import { resolveAttackerLevelDefenseCoefficient } from './directDamageCore'

export const isDamageFormula32Version = (version: string) =>
  version === '3.2' || version === '3.2-phase-ii'

/** Adapted from frzyc/genshin-optimizer, MIT; see upstream/genshinOptimizer/NOTICE.md. */
export const damageFormula32Identity = Object.freeze({
  version: 'soda-damage-formula-3.2-v1',
  upstreamRepository: 'frzyc/genshin-optimizer',
  upstreamCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  license: 'MIT',
  evidenceRefs: [
    'GO:common/dmg.ts:sha256:43C1755F8DECECB32F5710F815A8A67C76B4C05F2AD0467A9D3F9714C0B1A3E5',
    'GO:common/prep.ts:sha256:45D051C23C6055A75EE0B6A894659244754BCE298683F409667419B43E58ADF9',
    'GO:char/util.ts:sha256:0CD0429E53E7523AFE601A98BA09F3507F132FF820C09942B7B4993BADFBBF21',
    'GO:util.ts:sha256:A6BA0FE646A28389F63E7EACD48FDBD408B543C13CFE4C62964952196B523426',
  ],
})

export type TypedDirectDamageCoreInput =
  import('./damageModifierInputs').CommonDamageModifierInput & {
    attackerLevel: number
    scalingValue: number
    multiplier: number
    hitCount: number
    critRate: number
    critDamage: number
    flatDamage: number
  }
export type SharpDamageCoreInput = Omit<TypedDirectDamageCoreInput, 'critDamage' | 'flatDamage'> & {
  lacerationDamage: number
  sharpDamageBonus: number
}

/** The upstream second roll uses max(CR-1,0), without a second cap. */
export function sharpLacerationMultipliers(critRate: number, lacerationDamage: number) {
  if (!Number.isFinite(critRate) || critRate < 0)
    throw new Error('sharp critRate must be finite and nonnegative')
  if (!Number.isFinite(lacerationDamage) || lacerationDamage < 0)
    throw new Error('lacerationDamage must be finite and nonnegative')
  const critical = 1 + lacerationDamage
  return {
    nonCritical: 1,
    critical,
    doubleCritical: critical * critical,
    expected:
      (1 + Math.min(1, critRate) * lacerationDamage) *
      (1 + Math.max(critRate - 1, 0) * lacerationDamage),
  }
}

function commonFactors(input: Omit<TypedDirectDamageCoreInput, 'critDamage' | 'flatDamage'>) {
  for (const [field, value] of Object.entries(input))
    if (!Number.isFinite(value)) throw new Error(`damage input ${field} must be finite`)
  if (input.scalingValue <= 0) throw new Error('scalingValue must be positive')
  if (input.multiplier <= 0) throw new Error('multiplier must be positive')
  if (!Number.isInteger(input.hitCount) || input.hitCount < 1)
    throw new Error('hitCount must be a positive integer')
  if (input.enemyDefense < 0 || input.penetrationFlat < 0)
    throw new Error('enemy defense and flat penetration must be nonnegative')
  if (input.stunMultiplier <= 0) throw new Error('stunMultiplier must be positive')
  const level = resolveAttackerLevelDefenseCoefficient(input.attackerLevel)
  const effectiveDefense = Math.max(
    0,
    input.enemyDefense *
      (1 - input.defenseReduction - input.defenseIgnore) *
      (1 - input.penetrationRatio) -
      input.penetrationFlat,
  )
  return {
    effectiveScalingValue: input.scalingValue,
    skillMultiplier: input.multiplier,
    hitCount: input.hitCount,
    damageBonusMultiplier: 1 + input.damageBonus,
    buffMultiplier: 1 + input.buffBonus,
    directDamageMultiplier: 1 + input.directDamageBonus,
    vulnerabilityMultiplier: 1 + input.vulnerability,
    defenseMultiplier: level / (level + effectiveDefense),
    resistanceMultiplier: 1 - input.resistance + input.resistanceReduction + input.resistanceIgnore,
    stunMultiplier: input.stunMultiplier,
  }
}

function nonCritBase(
  input: Omit<TypedDirectDamageCoreInput, 'critDamage' | 'flatDamage'>,
  factors: ReturnType<typeof commonFactors>,
  flatDamage = 0,
) {
  const value =
    (input.scalingValue * input.multiplier + flatDamage) *
    input.hitCount *
    factors.damageBonusMultiplier *
    factors.buffMultiplier *
    factors.directDamageMultiplier *
    factors.vulnerabilityMultiplier *
    factors.defenseMultiplier *
    factors.resistanceMultiplier *
    factors.stunMultiplier
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid damage product')
  return value
}

/** 3.2 standard damage: attack/defense selection belongs to the sourced event. */
export function calculateTypedDirectDamageCore32(input: TypedDirectDamageCoreInput) {
  const factors = commonFactors(input)
  if (input.critDamage < 0) throw new Error('critDamage must be nonnegative')
  const nonCriticalDamage = nonCritBase(input, factors, input.flatDamage)
  const expectedCritMultiplier = 1 + Math.min(1, Math.max(0, input.critRate)) * input.critDamage
  return {
    nonCriticalDamage,
    criticalDamage: nonCriticalDamage * (1 + input.critDamage),
    expectedDamage: nonCriticalDamage * expectedCritMultiplier,
    factors: { ...factors, expectedCritMultiplier },
  }
}

/** Sharp uses laceration and sharp bonuses, never ordinary crit damage or flat damage. */
export function calculateSharpDamageCore(input: SharpDamageCoreInput) {
  const factors = commonFactors(input)
  const laceration = sharpLacerationMultipliers(input.critRate, input.lacerationDamage)
  if (input.sharpDamageBonus < -1) throw new Error('sharpDamageBonus must be at least -1')
  const nonCriticalDamage = nonCritBase(input, factors) * (1 + input.sharpDamageBonus)
  return {
    nonCriticalDamage,
    criticalDamage: nonCriticalDamage * laceration.critical,
    doubleCriticalDamage: nonCriticalDamage * laceration.doubleCritical,
    expectedDamage: nonCriticalDamage * laceration.expected,
    factors: {
      ...factors,
      sharpDamageMultiplier: 1 + input.sharpDamageBonus,
      expectedLacerationMultiplier: laceration.expected,
    },
  }
}
