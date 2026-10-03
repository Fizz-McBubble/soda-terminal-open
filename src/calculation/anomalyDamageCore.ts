import { stableContentHash } from '../gameDataPacks/types'
import { resolveAttackerLevelDefenseCoefficient } from './directDamageCore'

export const anomalyDamageCoreVersion = 'soda-anomaly-damage-core-v2' as const

export const anomalyDamageCoreIdentity = Object.freeze({
  family: 'anomaly_disorder',
  version: anomalyDamageCoreVersion,
  upstreamRepository: 'frzyc/genshin-optimizer',
  upstreamCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  license: 'MIT',
  evidenceRefs: [
    'GO:common/dmg.ts:sha256:43C1755F8DECECB32F5710F815A8A67C76B4C05F2AD0467A9D3F9714C0B1A3E5',
    'GO:common/prep.ts:sha256:45D051C23C6055A75EE0B6A894659244754BCE298683F409667419B43E58ADF9',
    'GO:char/util.ts:sha256:0CD0429E53E7523AFE601A98BA09F3507F132FF820C09942B7B4993BADFBBF21',
  ],
  windDisorderScope: 'polarity_disorder_only',
  standardAnomalyBaseMultipliers: {
    fire: 0.5,
    electric: 1.25,
    ether: 0.625,
    ice: 5,
    physical: 7.13,
    wind: 12.5,
  },
  disorderTimeMultipliers: {
    fire: 1,
    electric: 1.25,
    ether: 1.25,
    ice: 0.075,
    physical: 0.075,
    frost: 0.75,
    wind: 0,
  },
  standardDisorderBase: 4.5,
  formula:
    '((attack * baseMultiplier * (1 + anomalyBaseBonus)) + flatAnomalyDamage) * commonDamage * anomalyCrit * defense * anomalyProficiency * anomalyLevel',
})

export const anomalyDamageCoreHash = stableContentHash(anomalyDamageCoreIdentity)

export type AnomalyAttribute = keyof typeof anomalyDamageCoreIdentity.standardAnomalyBaseMultipliers
export type DisorderAttribute = keyof typeof anomalyDamageCoreIdentity.disorderTimeMultipliers

export type AnomalyDamageCoreInput = import('./damageModifierInputs').CommonDamageModifierInput & {
  attackerLevel: number
  attack: number
  baseMultiplier: number
  anomalyBaseBonus: number
  flatAnomalyDamage: number
  anomalyProficiency: number
  anomalyCritRate: number
  anomalyCritDamage: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function standardAnomalyBaseMultiplier(attribute: AnomalyAttribute) {
  return anomalyDamageCoreIdentity.standardAnomalyBaseMultipliers[attribute]
}

export function disorderBaseMultiplier(input: {
  attribute: DisorderAttribute
  elapsedSeconds: number
  additionalDisorderMultiplier: number
  frost?: boolean
}) {
  if (!Number.isFinite(input.elapsedSeconds) || input.elapsedSeconds < 0)
    throw new Error('disorder elapsedSeconds must be nonnegative')
  if (!Number.isFinite(input.additionalDisorderMultiplier))
    throw new Error('additional disorder multiplier must be finite')
  const isFrost = input.frost === true
  const base = isFrost ? 6 : input.attribute === 'wind' ? 1 : 4.5
  const remainingSeconds =
    input.attribute === 'wind' ? 1 : Math.max(0, (isFrost ? 20 : 10) - input.elapsedSeconds)
  return (
    base +
    input.additionalDisorderMultiplier +
    remainingSeconds * anomalyDamageCoreIdentity.disorderTimeMultipliers[input.attribute]
  )
}

/** Full-precision single-owner anomaly settlement arithmetic. */
export function calculateAnomalyDamageCore(input: AnomalyDamageCoreInput) {
  Object.entries(input).forEach(([field, value]) => {
    if (!Number.isFinite(value)) throw new Error(`anomaly damage input ${field} must be finite`)
  })
  if (input.attack <= 0) throw new Error('anomaly attack must be positive')
  if (input.baseMultiplier <= 0) throw new Error('anomaly baseMultiplier must be positive')
  if (input.anomalyProficiency < 0) throw new Error('anomaly proficiency must be nonnegative')
  if (input.enemyDefense < 0) throw new Error('enemy defense must be nonnegative')
  if (input.penetrationFlat < 0) throw new Error('flat penetration must be nonnegative')
  if (input.stunMultiplier <= 0) throw new Error('stun multiplier must be positive')

  const defenseCoefficient = resolveAttackerLevelDefenseCoefficient(input.attackerLevel)
  const effectiveDefense = Math.max(
    0,
    input.enemyDefense *
      Math.max(0, 1 - input.defenseReduction - input.defenseIgnore) *
      Math.max(0, 1 - input.penetrationRatio) -
      input.penetrationFlat,
  )
  const factors = {
    anomalyBase:
      input.attack * input.baseMultiplier * (1 + input.anomalyBaseBonus) + input.flatAnomalyDamage,
    damageBonusMultiplier: 1 + input.damageBonus,
    buffMultiplier: 1 + input.buffBonus,
    directDamageMultiplier: 1 + input.directDamageBonus,
    vulnerabilityMultiplier: 1 + input.vulnerability,
    expectedAnomalyCritMultiplier:
      1 + clamp(input.anomalyCritRate, 0, 1) * Math.max(0, input.anomalyCritDamage),
    defenseMultiplier: defenseCoefficient / (defenseCoefficient + effectiveDefense),
    resistanceMultiplier: Math.max(
      0,
      1 - input.resistance + input.resistanceReduction + input.resistanceIgnore,
    ),
    stunMultiplier: input.stunMultiplier,
    anomalyProficiencyMultiplier: input.anomalyProficiency * 0.01,
    anomalyLevelMultiplier: 1 + (input.attackerLevel - 1) / 59,
  }
  const nonCriticalDamage =
    factors.anomalyBase *
    factors.damageBonusMultiplier *
    factors.buffMultiplier *
    factors.directDamageMultiplier *
    factors.vulnerabilityMultiplier *
    factors.defenseMultiplier *
    factors.resistanceMultiplier *
    factors.stunMultiplier *
    factors.anomalyProficiencyMultiplier *
    factors.anomalyLevelMultiplier
  return {
    nonCriticalDamage,
    criticalDamage: nonCriticalDamage * (1 + Math.max(0, input.anomalyCritDamage)),
    expectedDamage: nonCriticalDamage * factors.expectedAnomalyCritMultiplier,
    factors,
  }
}
