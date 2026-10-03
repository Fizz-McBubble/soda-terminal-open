import {
  calculateStandardDirectDamageCore,
  resolveAttackerLevelDefenseCoefficient,
} from './directDamageCore'
import { calculateAnomalyDamageCore } from './anomalyDamageCore'
import { calculateSheerDamageCore } from './sheerDamageCore'
import { calculateSharpDamageCore, calculateTypedDirectDamageCore32 } from './sharpDamageCore'
import {
  calculateCommonAnomalySettlement32,
  type CommonAnomalySettlement32,
} from './currentCommonAnomalySettlement32'
export { commonAnomalySettlementHash32 } from './currentCommonAnomalySettlementIdentity32'

export type DamageFormulaFamily = 'direct' | 'sharp' | 'sheer' | 'anomaly'
export type DamageScalingAttribute = 'attack' | 'defense' | 'sheerForce'
export type DamageFormulaAtomicInput = {
  family: DamageFormulaFamily
  scalingAttribute: DamageScalingAttribute
  formulaVersion?: 'legacy' | '3.2'
  attackerLevel: number
  attack: number
  defense?: number
  sheerForce?: number
  multiplier: number
  hitCount: number
  critRate: number
  critDamage: number
  lacerationDamage?: number
  sharpDamageBonus?: number
  sheerDamageBonus?: number
  anomalyProficiency?: number
  anomalyBaseBonus?: number
  flatAnomalyDamage?: number
  anomalyCritRate?: number
  anomalyCritDamage?: number
  flatDamage?: number
  damageBonus: number
  directDamageBonus: number
  buffBonus: number
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

export type DamageFormulaInput =
  | DamageFormulaAtomicInput
  | {
      family: 'anomaly'
      scalingAttribute: 'attack'
      formulaVersion: '3.2'
      anomalySettlement32: CommonAnomalySettlement32
    }

/** Shared full-precision dispatcher. Missing typed attributes are errors, never ATK fallbacks. */
export function calculateDamageFormula(input: DamageFormulaInput) {
  if ('anomalySettlement32' in input) {
    if (
      input.family !== 'anomaly' ||
      input.scalingAttribute !== 'attack' ||
      input.formulaVersion !== '3.2'
    )
      throw new Error('anomaly settlement requires the pinned 3.2 anomaly profile')
    if (
      Object.keys(input).some(
        (key) =>
          !['family', 'scalingAttribute', 'formulaVersion', 'anomalySettlement32'].includes(key),
      )
    )
      throw new Error('anomaly settlement cannot mix trigger stats with contribution snapshots')
    return calculateCommonAnomalySettlement32(input.anomalySettlement32)
  }
  if (!['direct', 'sharp', 'sheer', 'anomaly'].includes(input.family))
    throw new Error('unknown damage family')
  if (!['attack', 'defense', 'sheerForce'].includes(input.scalingAttribute))
    throw new Error('unknown scaling attribute')
  if (input.formulaVersion !== undefined && !['legacy', '3.2'].includes(input.formulaVersion))
    throw new Error('unknown formula version')
  resolveAttackerLevelDefenseCoefficient(input.attackerLevel)
  if (!Number.isInteger(input.hitCount) || input.hitCount < 1)
    throw new Error('hitCount must be a positive integer')
  const required = (value: number | undefined, field: string) => {
    if (value === undefined || !Number.isFinite(value))
      throw new Error(`missing_or_invalid:${field}`)
    return value
  }
  for (const field of [
    'attackerLevel',
    'attack',
    'multiplier',
    'hitCount',
    'critRate',
    'critDamage',
    'damageBonus',
    'directDamageBonus',
    'buffBonus',
    'vulnerability',
    'defenseReduction',
    'defenseIgnore',
    'penetrationRatio',
    'penetrationFlat',
    'enemyDefense',
    'resistance',
    'resistanceReduction',
    'resistanceIgnore',
    'stunMultiplier',
  ] as const)
    required(input[field], field)
  // Cores validate their numeric object. Dispatch tags and absent optional stats
  // must not become accidental numeric inputs through object spreading.
  const numeric = { ...input }
  const clean = Object.fromEntries(
    Object.entries(numeric).filter(([, value]) => typeof value === 'number'),
  ) as Omit<DamageFormulaAtomicInput, 'family' | 'scalingAttribute' | 'formulaVersion'>
  if (input.family === 'sharp' && input.formulaVersion !== '3.2')
    throw new Error('sharp requires the pinned 3.2 formula profile')
  if (input.family === 'sharp' && input.scalingAttribute !== 'defense')
    throw new Error('sharp requires sourced defense scaling')
  if (input.family === 'sheer' && input.scalingAttribute !== 'sheerForce')
    throw new Error('sheer requires sourced sheerForce scaling')
  if (input.family === 'anomaly' && input.scalingAttribute !== 'attack')
    throw new Error('anomaly requires attack scaling')
  if (input.family === 'direct' && input.scalingAttribute === 'sheerForce')
    throw new Error('direct cannot substitute sheerForce')
  const common = {
    ...clean,
    resistanceReduction: input.resistanceReduction + input.resistanceIgnore,
  }
  if (input.family === 'anomaly') {
    const result = calculateAnomalyDamageCore({
      ...clean,
      baseMultiplier: input.multiplier,
      anomalyProficiency: required(input.anomalyProficiency, 'anomalyProficiency'),
      anomalyBaseBonus: input.anomalyBaseBonus ?? 0,
      flatAnomalyDamage: input.flatAnomalyDamage ?? 0,
      anomalyCritRate: input.anomalyCritRate ?? 0,
      anomalyCritDamage: input.anomalyCritDamage ?? 0,
    })
    return {
      ...result,
      expectedDamage: result.expectedDamage * input.hitCount,
      nonCriticalDamage: result.nonCriticalDamage * input.hitCount,
      criticalDamage: result.criticalDamage * input.hitCount,
    }
  }
  if (input.family === 'sheer') {
    const result = calculateSheerDamageCore({
      ...common,
      sheerForce: required(input.sheerForce, 'sheerForce'),
      sheerDamageBonus: input.sheerDamageBonus ?? 0,
    })
    return {
      ...result,
      expectedDamage: result.expectedDamage * (1 + input.buffBonus),
      nonCriticalDamage: result.nonCriticalDamage * (1 + input.buffBonus),
      criticalDamage: result.criticalDamage * (1 + input.buffBonus),
    }
  }
  const scalingValue =
    input.scalingAttribute === 'defense' ? required(input.defense, 'defense') : input.attack
  if (input.family === 'sharp')
    return calculateSharpDamageCore({
      ...clean,
      scalingValue,
      lacerationDamage: required(input.lacerationDamage, 'lacerationDamage'),
      sharpDamageBonus: input.sharpDamageBonus ?? 0,
    })
  if (input.formulaVersion === '3.2' || input.scalingAttribute === 'defense')
    return calculateTypedDirectDamageCore32({
      ...clean,
      scalingValue,
      flatDamage: input.flatDamage ?? 0,
    })
  const result = calculateStandardDirectDamageCore({
    ...common,
    attack: scalingValue,
    attackPercent: 0,
    attackFlat: 0,
    defenseReduction: input.defenseReduction + input.defenseIgnore,
  })
  const extra = (1 + input.directDamageBonus) * (1 + input.buffBonus)
  return {
    ...result,
    expectedDamage: result.expectedDamage * extra,
    nonCriticalDamage: result.nonCriticalDamage * extra,
    criticalDamage: result.criticalDamage * extra,
  }
}
