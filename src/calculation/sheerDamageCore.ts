import { stableContentHash } from '../gameDataPacks/types'

export const sheerDamageCoreVersion = 'soda-sheer-damage-core-v1' as const

export const sheerDamageCoreIdentity = Object.freeze({
  family: 'rupture_sheer',
  version: sheerDamageCoreVersion,
  upstreamRepository: 'frzyc/genshin-optimizer',
  upstreamCommit: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  license: 'MIT',
  evidenceRefs: [
    'GO:dmg.ts:sha256:34AE40061649E0F06FC6BFCCD07F35132103481559B96EDD446F5C8EE939FC5E',
    'GO:prep.ts:sha256:4DD2D7F4DA7ED1FB4B824E4332B9BC0D60E2B243CD52C4EBBD38253ABE245A77',
    'GO:char-util.ts:sha256:6278397AFA6C5B5F65A15BDADD16037B67B997DFFB2BF66289D63634BEC49A3D',
    'GO:common-index.ts:sha256:EFAF3597FDFC3C1FD1294D7770109CC673BBD2E71C732676C95DADC96BBE1997',
  ],
  formula:
    'sheerForce * multiplier * hitCount * damageBonus * directDamageBonus * vulnerability * expectedCrit * resistance * stun * sheerDamageBonus',
  defenseTreatment: 'not_applied_by_upstream_sheer_formula',
})

export const sheerDamageCoreHash = stableContentHash(sheerDamageCoreIdentity)

export type SheerDamageCoreInput = {
  sheerForce: number
  multiplier: number
  hitCount: number
  critRate: number
  critDamage: number
  damageBonus: number
  directDamageBonus: number
  vulnerability: number
  resistance: number
  resistanceReduction: number
  stunMultiplier: number
  sheerDamageBonus: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Full-precision no-timeline rupture/sheer event arithmetic. */
export function calculateSheerDamageCore(input: SheerDamageCoreInput) {
  Object.entries(input).forEach(([field, value]) => {
    if (!Number.isFinite(value)) throw new Error(`sheer damage input ${field} must be finite`)
  })
  if (input.sheerForce <= 0) throw new Error('sheerForce must be positive')
  if (input.multiplier <= 0) throw new Error('multiplier must be positive')
  if (!Number.isInteger(input.hitCount) || input.hitCount < 1)
    throw new Error('hitCount must be a positive integer')
  if (input.stunMultiplier <= 0) throw new Error('stunMultiplier must be positive')

  const expectedCritMultiplier = 1 + clamp(input.critRate, 0, 1) * Math.max(0, input.critDamage)
  const resistanceMultiplier = Math.max(0, 1 - (input.resistance - input.resistanceReduction))
  const factors = {
    sheerBase: input.sheerForce * input.multiplier * input.hitCount,
    damageBonusMultiplier: 1 + input.damageBonus,
    directDamageMultiplier: 1 + input.directDamageBonus,
    vulnerabilityMultiplier: 1 + input.vulnerability,
    expectedCritMultiplier,
    resistanceMultiplier,
    stunMultiplier: input.stunMultiplier,
    sheerDamageMultiplier: 1 + input.sheerDamageBonus,
  }
  const nonCriticalDamage =
    factors.sheerBase *
    factors.damageBonusMultiplier *
    factors.directDamageMultiplier *
    factors.vulnerabilityMultiplier *
    factors.resistanceMultiplier *
    factors.stunMultiplier *
    factors.sheerDamageMultiplier
  return {
    nonCriticalDamage,
    criticalDamage: nonCriticalDamage * (1 + Math.max(0, input.critDamage)),
    expectedDamage: nonCriticalDamage * factors.expectedCritMultiplier,
    factors,
  }
}
