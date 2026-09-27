import { stableContentHash } from '../gameDataPacks/types'
import { resolveAttackerLevelDefenseCoefficient } from './directDamageCore'

export const anomalyDamageCoreVersion = 'soda-anomaly-damage-core-v1' as const

export const anomalyDamageCoreIdentity = Object.freeze({
  family: 'anomaly_disorder',
  version: anomalyDamageCoreVersion,
  upstreamRepository: 'frzyc/genshin-optimizer',
  upstreamCommit: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  license: 'MIT',
  evidenceRefs: [
    'GO:dmg.ts:sha256:34AE40061649E0F06FC6BFCCD07F35132103481559B96EDD446F5C8EE939FC5E',
    'GO:prep.ts:sha256:4DD2D7F4DA7ED1FB4B824E4332B9BC0D60E2B243CD52C4EBBD38253ABE245A77',
    'GO:char-util.ts:sha256:6278397AFA6C5B5F65A15BDADD16037B67B997DFFB2BF66289D63634BEC49A3D',
  ],
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

export type AnomalyDamageCoreInput = {
  attackerLevel: number
  attack: number
  baseMultiplier: number
  anomalyBaseBonus: number
  flatAnomalyDamage: number
  anomalyProficiency: number
  anomalyCritRate: number
  anomalyCritDamage: number
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
