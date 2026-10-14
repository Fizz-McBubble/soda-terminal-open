import { describe, expect, it } from 'vitest'
import { evaluateBangbooSourcePropertyFormula } from './currentBangbooSourceFormula'
import { currentBangbooNumericCatalog } from '../gameDataPacks/currentBangbooNumericCatalog'
import { resolveCurrentBangbooMechanicContract } from './currentBangbooMechanicContracts'

describe('locked Bangboo source property arithmetic', () => {
  const source = (value: number) => () => value
  it('consumes source multiplicities and fractions rather than once per distinct reference', () => {
    expect(evaluateBangbooSourcePropertyFormula('{Skill:5402201, Prop:1001}*3', source(10))).toBe(
      30,
    )
    expect(
      evaluateBangbooSourcePropertyFormula('{{Skill:5300201, Prop:1001}/100}*140', source(10)),
    ).toBe(14)
    expect(
      evaluateBangbooSourcePropertyFormula(
        '{{Skill:5400101, Prop:1001}/3}+{{Skill:5400101, Prop:1001}*2/3}',
        source(9),
      ),
    ).toBe(9)
    expect(
      evaluateBangbooSourcePropertyFormula(
        '{Skill:5402001, Prop:1001}*2+{Skill:5402002, Prop:1001}',
        (id) => (id === '5402001' ? 10 : 5),
      ),
    ).toBe(25)
  })
  it('rejects missing, malformed, executable and nonfinite source instead of a zero fallback', () => {
    for (const value of [
      '{Skill:1, Prop:1001}/0',
      '{Skill:1, Prop:1001}*',
      'process.exit()',
      '(1+2',
      '1.2.3',
    ])
      expect(evaluateBangbooSourcePropertyFormula(value, source(10))).toBeNull()
    expect(evaluateBangbooSourcePropertyFormula('{Skill:1, Prop:1001}', () => null)).toBeNull()
  })
  it('consumes every released entity source expression at both supported skill endpoints', () => {
    for (const item of currentBangbooNumericCatalog.items)
      for (const skillLevel of [1, 10]) {
        const result = resolveCurrentBangbooMechanicContract({
          stableId: item.stableId,
          skillLevel,
          additionalAbilityLevel: 1,
          bangbooLevel: 60,
          ascensionLevelCap: 60,
          composition: {},
          additionalAbilityEnabled: false,
        })
        expect(result.status, `${item.stableId}/${skillLevel}`).toBe('supported')
      }
  })
  it('settles independent frozen Jake and Cui active multipliers with their published multiplicities', () => {
    for (const [stableId, skillId, count] of [
      ['bangboo-ultra-jake', '5402201', 3],
      ['bangboo-officer-cui', '5401201', 2],
    ] as const) {
      const item = currentBangbooNumericCatalog.items.find((row) => row.stableId === stableId)!
      const prop = item.skillProps
        .find((row) => row.skillId === skillId)!
        .properties.find((row) => row.key === '1001')!
      const result = resolveCurrentBangbooMechanicContract({
        stableId,
        skillLevel: 10,
        additionalAbilityLevel: 1,
        bangbooLevel: 60,
        composition: {},
        additionalAbilityEnabled: false,
      })
      if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
      expect(result.outputs).toContainEqual(
        expect.objectContaining({
          action: 'active',
          multiplier: ((prop.main + prop.growth * 9) / 10000) * count,
        }),
      )
    }
  })
})
