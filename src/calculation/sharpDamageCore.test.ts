import { describe, expect, it } from 'vitest'
import {
  calculateSharpDamageCore,
  sharpLacerationMultipliers,
  calculateTypedDirectDamageCore32,
} from './sharpDamageCore'
import { calculateDamageFormula, type DamageFormulaInput } from './damageFormulaDispatch'

const sharp = {
  attackerLevel: 1,
  scalingValue: 400,
  multiplier: 2,
  hitCount: 2,
  critRate: 1.5,
  lacerationDamage: 0.5,
  sharpDamageBonus: 0.2,
  damageBonus: 0,
  buffBonus: 0,
  directDamageBonus: 0,
  vulnerability: 0,
  defenseReduction: 0,
  defenseIgnore: 0,
  penetrationRatio: 0,
  penetrationFlat: 0,
  enemyDefense: 50,
  resistance: 0,
  resistanceReduction: 0,
  resistanceIgnore: 0,
  stunMultiplier: 1,
}
const dispatch: DamageFormulaInput = {
  ...sharp,
  family: 'sharp',
  formulaVersion: '3.2',
  scalingAttribute: 'defense',
  attack: 9000,
  defense: 400,
  critDamage: 99,
}

describe('3.2 typed sharp arithmetic', () => {
  it.each([
    [0, 1],
    [0.5, 1.25],
    [1, 1.5],
    [1.5, 1.875],
    [2, 2.25],
    [2.5, 2.625],
  ])('has independently calculated laceration expectation at CR=%s', (crit, expected) => {
    expect(sharpLacerationMultipliers(crit, 0.5).expected).toBe(expected)
  })
  it('calculates DEF base, sharp multiplier, and separate double critical result', () => {
    // DEF400 × MV2 × 2hits × level1DEF(50/(50+50)) × sharp1.2 = 960.
    const result = calculateSharpDamageCore(sharp)
    expect(result.nonCriticalDamage).toBe(960)
    expect(result.criticalDamage).toBe(1440)
    expect(result.doubleCriticalDamage).toBe(2160)
    expect(result.expectedDamage).toBe(1800)
    expect(calculateDamageFormula(dispatch).expectedDamage).toBe(1800)
    expect(calculateDamageFormula({ ...dispatch, attack: 1, critDamage: 0 }).expectedDamage).toBe(
      1800,
    )
  })
  it('keeps standard DEF scaling distinct from sharp laceration', () => {
    const result = calculateTypedDirectDamageCore32({
      ...sharp,
      scalingValue: 400,
      critDamage: 0.5,
      flatDamage: 0,
    })
    expect(result.expectedDamage).toBe(1200) // base800 × ordinary critical1.5; no sharp bonus.
    expect(
      calculateDamageFormula({
        ...dispatch,
        family: 'direct',
        formulaVersion: '3.2',
        critDamage: 0.5,
      }).expectedDamage,
    ).toBe(1200)
  })
  it('uses additive DEF reduction+ignore and RES reduction+ignore with full penetration', () => {
    // 400*2*2 × DEF1 × RES1.2 × sharp1.2 × laceration1.875 = 4320.
    expect(
      calculateSharpDamageCore({
        ...sharp,
        defenseReduction: 0.6,
        defenseIgnore: 0.4,
        resistance: 0.2,
        resistanceReduction: 0.3,
        resistanceIgnore: 0.1,
      }).expectedDamage,
    ).toBeCloseTo(4320)
  })
  it.each([
    { formulaVersion: 'legacy' as const },
    { defense: undefined },
    { lacerationDamage: undefined },
    { scalingAttribute: 'attack' as const },
    { attackerLevel: 61 },
    { hitCount: 0 },
    { lacerationDamage: -0.1 },
    { defense: Number.NaN },
  ])('rejects missing/invalid typed inputs %j', (patch) => {
    expect(() => calculateDamageFormula({ ...dispatch, ...patch })).toThrow()
  })
  it('preserves independently calculated legacy direct, anomaly, and sheer families', () => {
    const common: DamageFormulaInput = {
      ...dispatch,
      family: 'direct',
      formulaVersion: 'legacy',
      scalingAttribute: 'attack',
      attack: 1000,
      multiplier: 1,
      hitCount: 1,
      critRate: 0.5,
      critDamage: 1,
      sharpDamageBonus: 0,
      directDamageBonus: 0.2,
      buffBonus: 0.1,
      enemyDefense: 50,
    }
    expect(calculateDamageFormula(common).expectedDamage).toBeCloseTo(990)
    expect(
      calculateDamageFormula({
        ...common,
        family: 'anomaly',
        anomalyProficiency: 100,
        anomalyCritRate: 0.5,
        anomalyCritDamage: 1,
      }).expectedDamage,
    ).toBeCloseTo(990)
    expect(
      calculateDamageFormula({
        ...common,
        family: 'sheer',
        scalingAttribute: 'sheerForce',
        sheerForce: 1000,
        sheerDamageBonus: 0.2,
      }).expectedDamage,
    ).toBeCloseTo(2376)
  })
})
