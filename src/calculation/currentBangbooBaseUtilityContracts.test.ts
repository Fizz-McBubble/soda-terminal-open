import { describe, expect, it } from 'vitest'
import {
  bangbooBaseUtilitySupportedStableIds,
  isBangbooBaseUtilitySupported,
  resolveBangbooBaseUtilityOutputs,
} from './currentBangbooBaseUtilityContracts'

describe('current Bangboo base active utility contracts', () => {
  it('rejects malformed levels without silently replacing investment or losing source identity', () => {
    for (const skillLevel of [0, 11, 1.5, NaN])
      expect(
        resolveBangbooBaseUtilityOutputs({
          stableId: 'bangboo-butler',
          skillLevel,
          bangbooLevel: 60,
        }),
      ).toEqual([])
    for (const bangbooLevel of [0, 61, 1.5, Infinity])
      expect(
        resolveBangbooBaseUtilityOutputs({
          stableId: 'bangboo-butler',
          skillLevel: 10,
          bangbooLevel,
        }),
      ).toEqual([])
    const output = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-butler',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!
    expect(output.sourceEvidence.parameterPointer).toBe('/skill/a/level/10/param')
    expect(output.sourceEvidence.sha256).toMatch(/^[A-F0-9]{64}$/)
    expect(output.sourceEvidence.semanticSha256).toMatch(/^[A-F0-9]{64}$/)
    expect(output.sourceEvidence.url).toContain('54004')
  })
  it('identifies and supports exactly the 8 confirmed utility Bangboo', () => {
    expect(bangbooBaseUtilitySupportedStableIds).toEqual([
      'bangboo-exploreboo',
      'bangboo-avocaboo',
      'bangboo-booressure',
      'bangboo-knightboo',
      'bangboo-butler',
      'bangboo-biggest-fan',
      'bangboo-snap',
      'bangboo-miss-esme',
    ])
    expect(new Set(bangbooBaseUtilitySupportedStableIds).size).toBe(8)
    for (const stableId of bangbooBaseUtilitySupportedStableIds) {
      expect(isBangbooBaseUtilitySupported(stableId)).toBe(true)
    }
    expect(isBangbooBaseUtilitySupported('bangboo-amillion')).toBe(false)
    expect(isBangbooBaseUtilitySupported('bangboo-penguinboo')).toBe(false)
  })

  it('produces non-empty typed outputs traceable across level boundaries for all 8 entities', () => {
    for (const stableId of bangbooBaseUtilitySupportedStableIds) {
      for (const skillLevel of [1, 10] as const) {
        for (const bangbooLevel of [1, 60] as const) {
          const outputs = resolveBangbooBaseUtilityOutputs({
            stableId,
            skillLevel,
            bangbooLevel,
          })
          expect(
            outputs.length,
            `${stableId} at sl=${skillLevel}, bl=${bangbooLevel}`,
          ).toBeGreaterThan(0)
          for (const output of outputs) {
            expect(output.provider).toBe('bangboo')
            expect(output.action).toBe('active')
            expect(output.skillRole).toBe('active')
            expect(output.operator).toBe('resource_and_sustain_apply')
            expect(output.capacityOnly).toBe(true)
            expect(output.skillLevel).toBe(skillLevel)
            expect(output.bangbooLevel).toBe(bangbooLevel)
            expect(Number.isFinite(output.value)).toBe(true)
            expect(output.value).toBeGreaterThan(0)
            expect(output.values).toEqual([output.value])
            expect(output.rawParameterToken.length).toBeGreaterThan(0)
            expect(output.sourceEvidence.stableId).toBe(stableId)
            expect(output.sourceEvidence.rawLevelParam.length).toBeGreaterThan(0)
            expect(output.sourceEvidence.descriptionSnippet.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('resolves Exploreboo (寻宝布) 3 random branches with unstated probability and independent energy regen rate', () => {
    const lv1 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-exploreboo',
      skillLevel: 1,
      bangbooLevel: 60,
    })
    const lv10 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-exploreboo',
      skillLevel: 10,
      bangbooLevel: 60,
    })
    expect(lv1).toHaveLength(3)
    expect(lv10).toHaveLength(3)

    // Branch 1: HP restore (8% -> 10% Bangboo HP)
    const heal1 = lv1.find((o) => o.branchId === 'buff_1')!
    const heal10 = lv10.find((o) => o.branchId === 'buff_1')!
    expect(heal1.utilityType).toBe('hp_restore')
    expect(heal1.unit).toBe('hp_ratio_bangboo_hp')
    expect(heal1.value).toBeCloseTo(0.08, 5)
    expect(heal10.value).toBeCloseTo(0.1, 5)
    expect(heal1.receiver).toBe('on_field_agent')
    expect(heal1.probabilityUnstated).toBe(true)
    expect(heal1.durationSeconds).toBe(12)
    expect(heal1.cooldownSeconds).toBe(16)

    // Branch 2: Shield (9% -> 11.5% Bangboo HP)
    const shield1 = lv1.find((o) => o.branchId === 'buff_2')!
    const shield10 = lv10.find((o) => o.branchId === 'buff_2')!
    expect(shield1.utilityType).toBe('shield')
    expect(shield1.unit).toBe('shield_ratio_bangboo_hp')
    expect(shield1.value).toBeCloseTo(0.09, 5)
    expect(shield10.value).toBeCloseTo(0.115, 5)

    // Branch 3: Energy regen rate (0.2/s -> 0.4/s) - MUST NOT be regular flat energy point!
    const regen1 = lv1.find((o) => o.branchId === 'buff_3')!
    const regen10 = lv10.find((o) => o.branchId === 'buff_3')!
    expect(regen1.utilityType).toBe('energy_regen')
    expect(regen1.unit).toBe('energy_point_per_second')
    expect(regen1.value).toBeCloseTo(0.2, 5)
    expect(regen10.value).toBeCloseTo(0.4, 5)
    expect(regen1.targetRestriction).toBe('standard_energy_only')
  })

  it('resolves Avocaboo (果核布) HP restore with pickup contact receiver and 15 max triggers per battle', () => {
    const lv1 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-avocaboo',
      skillLevel: 1,
      bangbooLevel: 60,
    })[0]!
    const lv10 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-avocaboo',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!

    expect(lv1.utilityType).toBe('hp_restore')
    expect(lv1.unit).toBe('hp_ratio_unresolved_basis')
    expect(lv1.hpBasis).toBe('unresolved')
    expect(lv1.value).toBeCloseTo(0.1, 5)
    expect(lv10.value).toBeCloseTo(0.15, 5)
    expect(lv1.receiver).toBe('pickup_agent')
    expect(lv1.trigger).toBe('contact_juice_pellet')
    expect(lv1.maxTriggersPerBattle).toBe(15)
    expect(lv1.cooldownSeconds).toBe(20)
  })

  it('resolves Booressure (气压布) standard energy points across Bangboo and skill level formulas', () => {
    const s1b1 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-booressure',
      skillLevel: 1,
      bangbooLevel: 1,
    })[0]!
    const s1b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-booressure',
      skillLevel: 1,
      bangbooLevel: 60,
    })[0]!
    const s10b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-booressure',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!

    expect(s1b1.utilityType).toBe('energy_flat')
    expect(s1b1.unit).toBe('energy_point')
    // Formula Lv1: 2.5 + Level * 0.05
    expect(s1b1.value).toBeCloseTo(2.5 + 1 * 0.05, 5)
    expect(s1b60.value).toBeCloseTo(2.5 + 60 * 0.05, 5) // 5.5
    // Formula Lv10: 3.4 + Level * 0.05
    expect(s10b60.value).toBeCloseTo(3.4 + 60 * 0.05, 5) // 6.4
    expect(s10b60.targetRestriction).toBe('standard_energy_only')
    expect(s10b60.receiver).toBe('pickup_agent')
    expect(s10b60.cooldownSeconds).toBe(26)
  })

  it('resolves Knightboo (骑士布) summoning 3 stars with per-star energy points', () => {
    const s1b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-knightboo',
      skillLevel: 1,
      bangbooLevel: 60,
    })[0]!
    const s10b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-knightboo',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!

    expect(s1b60.utilityType).toBe('energy_flat')
    expect(s1b60.unit).toBe('energy_point')
    // Formula: 0.5 + Level * 0.01 at Lv1 -> 0.5 + 0.6 = 1.1
    expect(s1b60.value).toBeCloseTo(1.1, 5)
    // Formula: 1.4 + Level * 0.01 at Lv10 -> 1.4 + 0.6 = 2.0
    expect(s10b60.value).toBeCloseTo(2.0, 5)
    expect(s10b60.summonCount).toBe(3)
    expect(s10b60.targetRestriction).toBe('standard_energy_only')
    expect(s10b60.receiver).toBe('pickup_agent')
    expect(s10b60.cooldownSeconds).toBe(24)
  })

  it('resolves Butler (巴特勒) target delivery flat energy points', () => {
    const s1b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-butler',
      skillLevel: 1,
      bangbooLevel: 60,
    })[0]!
    const s10b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-butler',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!

    expect(s1b60.utilityType).toBe('energy_flat')
    expect(s1b60.unit).toBe('energy_point')
    // Formula: 3 + Level * 0.08 at Lv1 -> 3 + 4.8 = 7.8
    expect(s1b60.value).toBeCloseTo(7.8, 5)
    // Formula: 4.8 + Level * 0.08 at Lv10 -> 4.8 + 4.8 = 9.6
    expect(s10b60.value).toBeCloseTo(9.6, 5)
    expect(s10b60.receiver).toBe('target_agent')
    expect(s10b60.targetRestriction).toBe('standard_energy_only')
    expect(s10b60.trigger).toBe('tea_snack_delivered')
    expect(s10b60.cooldownSeconds).toBe(24)
  })

  it('resolves Biggest Fan (阿饭, 54010) on-field channel HP heal based on Bangboo max HP', () => {
    const s1 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-biggest-fan',
      skillLevel: 1,
      bangbooLevel: 60,
    })[0]!
    const s10 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-biggest-fan',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!

    expect(s1.sourceEvidence.gameId).toBe('54010')
    expect(s1.sourceEvidence.playerName).toBe('阿饭')
    expect(s1.sourceEvidence.englishName).toBe('Biggest Fan')
    expect(s1.utilityType).toBe('hp_restore')
    expect(s1.unit).toBe('hp_ratio_bangboo_hp')
    expect(s1.value).toBeCloseTo(0.125, 5)
    expect(s10.value).toBeCloseTo(0.25, 5)
    expect(s1.receiver).toBe('on_field_agent')
    expect(s1.trigger).toBe('active_cheering_channel')
    expect(s1.cooldownSeconds).toBe(24)
  })

  it('resolves Snap (咔嚓仔) triggering-agent damage bonus with 3 film charges and 10s duration', () => {
    const s1 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-snap',
      skillLevel: 1,
      bangbooLevel: 60,
    })[0]!
    const s10 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-snap',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!

    expect(s1.utilityType).toBe('damage_bonus')
    expect(s1.unit).toBe('damage_ratio')
    expect(s1.value).toBeCloseTo(0.028, 5)
    expect(s10.value).toBeCloseTo(0.1, 5)
    expect(s1.filmCharges).toBe(3)
    expect(s1.durationSeconds).toBe(10)
    expect(s1.receiver).toBe('triggering_agent')
    expect(s1.trigger).toBe('on_dodge_counter_or_quick_assist_or_assist_follow_up')
    expect(s1.cooldownSeconds).toBe(22)
  })

  it('resolves Miss Esme (艾丝弥小姐) dual branches (bubble heal and star energy) with dynamic probabilities', () => {
    const s1b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-miss-esme',
      skillLevel: 1,
      bangbooLevel: 60,
    })
    const s10b60 = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-miss-esme',
      skillLevel: 10,
      bangbooLevel: 60,
    })
    expect(s1b60).toHaveLength(2)
    expect(s10b60).toHaveLength(2)

    // Branch 1: Spectral Bubble HP heal
    const bubble1 = s1b60.find((o) => o.branchId === 'spectral_bubble')!
    const bubble10 = s10b60.find((o) => o.branchId === 'spectral_bubble')!
    expect(bubble1.utilityType).toBe('hp_restore')
    expect(bubble1.unit).toBe('hp_ratio_unresolved_basis')
    expect(bubble1.hpBasis).toBe('unresolved')
    expect(bubble1.value).toBeCloseTo(0.044, 5)
    expect(bubble10.value).toBeCloseTo(0.08, 5)
    expect(bubble1.probabilityDynamic).toBe(true)
    expect(bubble1.summonCount).toBe(3)
    expect(bubble1.receiver).toBe('pickup_agent')

    // Branch 2: Twinkling Star energy flat: formula [0.6 + Level * 0.04] -> 3.0 at Lv1/60, [1.5 + Level * 0.04] -> 3.9 at Lv10/60
    const star1 = s1b60.find((o) => o.branchId === 'twinkling_star')!
    const star10 = s10b60.find((o) => o.branchId === 'twinkling_star')!
    expect(star1.utilityType).toBe('energy_flat')
    expect(star1.unit).toBe('energy_point')
    expect(star1.value).toBeCloseTo(3.0, 5)
    expect(star10.value).toBeCloseTo(3.9, 5)
    expect(star1.targetRestriction).toBe('standard_energy_only')
    expect(star1.probabilityDynamic).toBe(true)
    expect(star1.summonCount).toBe(3)
    expect(star1.receiver).toBe('pickup_agent')
  })
})
