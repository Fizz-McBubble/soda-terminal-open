import { describe, expect, it } from 'vitest'
import {
  evaluateReviewedFeatheredFate32,
  evaluateReviewedLuminizeMultiplier32,
  evaluateReviewedRefringeCoefficient32,
  reviewedLumifluxMechanicsHash32,
  reviewedLumifluxMechanicsIdentity32,
} from './reviewedLumifluxMechanics32'

describe('reviewed Lumiflux source mechanics', () => {
  it('keeps the pinned official source and independent calibration identities', () => {
    expect(reviewedLumifluxMechanicsIdentity32.source.commit).toBe(
      '3456cd0f6f5bea10e168074502460dac2fcd6df4',
    )
    expect(reviewedLumifluxMechanicsIdentity32.calibration.status).toBe(
      'in_game_popup_calibrated_m1_m6',
    )
    expect(reviewedLumifluxMechanicsHash32).toMatch(/^[a-z0-9-]+$/)
  })

  it.each([
    [{ anomalyProficiency: 448, anomalyMemberCount: 3, mindscape: 1 }, 0.1896],
    [{ anomalyProficiency: 1200, anomalyMemberCount: 3, mindscape: 2 }, 0.54],
    [{ anomalyProficiency: 400, anomalyMemberCount: 2, mindscape: 0 }, 0.08],
  ])('adds the Refringe riders instead of multiplying them', (input, coefficient) => {
    expect(evaluateReviewedRefringeCoefficient32(input)).toMatchObject({
      status: 'limited_benchmark',
      coefficient,
      multiplier: 1 + coefficient,
    })
  })

  it('keeps Feathered Fate as general Lumiflux anomaly damage on the equipper', () => {
    expect(
      evaluateReviewedFeatheredFate32({
        equippedPieces: 4,
        characterAttribute: 'lumiflux',
        entersOrActive: true,
      }),
    ).toMatchObject({
      status: 'limited_benchmark',
      anomalyProficiency: 80,
      attributeAnomalyDamageBonus: 0.15,
      durationSeconds: 15,
      receiver: 'equipped_character_attribute_anomaly_damage',
    })
    expect(
      evaluateReviewedFeatheredFate32({
        equippedPieces: 4,
        characterAttribute: 'ether',
        entersOrActive: true,
      }),
    ).toMatchObject({ anomalyProficiency: 80, attributeAnomalyDamageBonus: 0 })
  })

  it('reproduces the independently observed M1 Luminize multiplier', () => {
    expect(
      evaluateReviewedLuminizeMultiplier32({
        skill: 'rainbows_end',
        effectiveSkillLevel: 12,
        remielleAnomalyProficiency: 448,
        remielleMindscape: 1,
        remielleCoreLevel: 7,
      }),
    ).toMatchObject({
      status: 'limited_benchmark',
      basePercent: 160,
      anomalyProficiencyMultiplier: 1.896,
      mindscapeFourMultiplier: 1,
      finalPercent: 303.36,
      mindscapeOneResistanceIgnore: 0.5,
      mindscapeTwoDefenseIgnore: 0,
    })
  })

  it('applies M3/M5 skill levels, M4 multiplication and M2 defense ignore independently', () => {
    expect(
      evaluateReviewedLuminizeMultiplier32({
        skill: 'rainbows_end',
        effectiveSkillLevel: 16,
        remielleAnomalyProficiency: 448,
        remielleMindscape: 4,
        remielleCoreLevel: 7,
        prismaticDefenseIgnoreWindow: true,
      }),
    ).toMatchObject({
      basePercent: 180,
      finalPercent: 382.2336,
      mindscapeOneResistanceIgnore: 0.5,
      mindscapeTwoDefenseIgnore: 0.15,
      mindscapeFourMultiplier: 1.12,
    })
    expect(
      evaluateReviewedLuminizeMultiplier32({
        skill: 'fleeting_grace',
        effectiveSkillLevel: 12,
        remielleAnomalyProficiency: 0,
        remielleMindscape: 0,
        remielleCoreLevel: 7,
      }),
    ).toMatchObject({ basePercent: 320, finalPercent: 320 })
  })

  it('fails closed outside the reviewed domain', () => {
    expect(
      evaluateReviewedRefringeCoefficient32({
        anomalyProficiency: -1,
        anomalyMemberCount: 3,
        mindscape: 0,
      }).status,
    ).toBe('unsupported')
    expect(
      evaluateReviewedLuminizeMultiplier32({
        skill: 'rainbows_end',
        effectiveSkillLevel: 17,
        remielleAnomalyProficiency: 400,
        remielleMindscape: 0,
        remielleCoreLevel: 7,
      }).status,
    ).toBe('unsupported')
  })

  it('uses the observed core level and requires the M2 target window', () => {
    const input = {
      skill: 'rainbows_end' as const,
      effectiveSkillLevel: 12,
      remielleAnomalyProficiency: 400,
      remielleMindscape: 2,
      remielleCoreLevel: 1,
      prismaticDefenseIgnoreWindow: false,
    }
    expect(evaluateReviewedLuminizeMultiplier32(input)).toMatchObject({
      anomalyProficiencyMultiplier: 1.4,
      finalPercent: 224,
      mindscapeTwoDefenseIgnore: 0,
    })
    expect(evaluateReviewedLuminizeMultiplier32({ ...input, remielleCoreLevel: 7 })).toMatchObject({
      anomalyProficiencyMultiplier: 1.8,
      finalPercent: 288,
    })
    expect(
      evaluateReviewedLuminizeMultiplier32({ ...input, prismaticDefenseIgnoreWindow: true }),
    ).toMatchObject({ mindscapeTwoDefenseIgnore: 0.15 })
    expect(
      evaluateReviewedLuminizeMultiplier32({ ...input, prismaticDefenseIgnoreWindow: undefined })
        .status,
    ).toBe('unsupported')
    for (const core of [0, 8, 1.5, Number.NaN])
      expect(
        evaluateReviewedLuminizeMultiplier32({ ...input, remielleCoreLevel: core }).status,
      ).toBe('unsupported')
  })

  it('handles six equipped pieces and rejects a forged equipment activation', () => {
    expect(
      evaluateReviewedFeatheredFate32({
        equippedPieces: 6,
        characterAttribute: 'lumiflux',
        entersOrActive: true,
      }),
    ).toMatchObject({ anomalyProficiency: 80, attributeAnomalyDamageBonus: 0.15 })
    expect(
      evaluateReviewedFeatheredFate32({
        equippedPieces: 4,
        characterAttribute: 'lumiflux',
        entersOrActive: 'true' as unknown as boolean,
      }).status,
    ).toBe('unsupported')
  })
})
