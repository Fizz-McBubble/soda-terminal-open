import { describe, expect, it } from 'vitest'
import {
  absoluteDiscRetentionCatalog as productionCatalog,
  absoluteDiscRetentionPolicy as productionPolicy,
} from './absoluteDiscRetentionCatalog'
import type { Catalog, Disc, Profile, QualityPolicy } from './absoluteDiscRetentionContract'
import { noFunctionalSubstatGoalMethod } from './absoluteDiscRetentionContract'
import { assessDisc } from './absoluteDiscRetentionKernel'
import { profileValid, scoreProfile, twoPieceApplicability } from './absoluteDiscRetentionScoring'

const rules: Catalog['rules'] = {
  sourceIds: ['synthetic-rules'],
  standardRarity: 'S',
  enhancementInterval: 3,
  maxSubStats: 4,
  mainStatsBySlot: { '2': ['atk_flat'], '4': ['hp_percent', 'energy_regen'] },
  rarities: {
    S: {
      maxLevel: 15,
      initialLineCounts: [3, 4],
      steps: {
        hp_flat: 1,
        hp_percent: 1,
        atk_flat: 1,
        atk_percent: 1,
        crit_rate: 1,
        crit_dmg: 1,
        def_flat: 1,
        def_percent: 1,
        pen: 1,
      },
    },
  },
}
const functional: Profile = {
  id: 'single-goal',
  agentId: 'synthetic-agent',
  verified: true,
  sourceIds: ['synthetic-reviewed-build'],
  goal: 'functional',
  weights: { atk_flat: 1, atk_percent: 1 },
  coreStats: ['atk_percent'],
  mainStatsBySlot: { '4': { hp_percent: 'valid', energy_regen: 'valid' } },
  effectUtility: { atk_: 'valid' },
  weightEvidence: {
    id: 'synthetic-quality-calibration',
    method: 'goal_bound_standard_roll_quality_proxy',
    sourceIds: ['synthetic-reviewed-build'],
  },
}
function catalog(profiles: readonly Profile[] = [functional]): Catalog {
  return {
    rules,
    profiles,
    sets: [
      {
        id: 'synthetic-set',
        verified: true,
        sourceIds: ['synthetic-set-source'],
        twoPieceEffects: [{ stat: 'atk_', value: 10 }],
      },
    ],
    releasedAgentIds: ['synthetic-agent'],
    factsGameVersion: 'synthetic',
    assessmentGameVersion: 'synthetic',
    branchCoverageComplete: true,
    reviewedUseScope: 'synthetic-closed-scope',
  }
}
function policy(profiles: readonly Profile[] = [functional]): QualityPolicy {
  return {
    id: 'synthetic-policy',
    calibration: 'approved',
    calibratedRarities: ['S'],
    byProfile: Object.fromEntries(
      profiles.map((profile) => [
        profile.id,
        {
          '2': { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 },
          '4': { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 },
        },
      ]),
    ),
    investment: {
      id: 'synthetic-investment',
      calibration: 'approved',
      meaningfulWeightFrom: 0.5,
      leftSlotMinimumLines: 2,
      rightSlotMinimumLines: 1,
      minimumCoreLines: 1,
      growthTarget: 'keepFrom',
      progressFloorBySpentNode: { '0': 0, '1': 0.35, '2': 0.55, '3': 0.75, '4': 0.9, '5': 1 },
    },
  }
}
function disc(level = 0): Disc {
  return {
    id: 'synthetic-disc',
    setId: 'synthetic-set',
    slot: 2,
    mainStat: 'atk_flat',
    rarity: 'S',
    level,
    subStats: ['atk_percent', 'crit_rate', 'def_flat', 'pen'].map((stat, index) => ({
      stat,
      value: 1 + (index === 0 ? Math.floor(level / 3) : 0),
      upgrades: index === 0 ? Math.floor(level / 3) : 0,
    })),
  }
}
const assess = (item: Disc, profiles: readonly Profile[] = [functional]) =>
  assessDisc(item, catalog(profiles), policy(profiles))

describe('investment policy respects legal substat capacity', () => {
  it.each([0, 3])(
    'withholds cleanup and upgrade for an impossible two-line policy at +%i',
    (level) => {
      const result = assess(disc(level))
      expect(result.evidence[0]!.investment.qualified).toBeNull()
      expect(result.evidence[0]!.useState).toBe('valid')
      expect(result.qualityDisposition).toBe('review')
      expect(result.reasons).toContain('investment_policy_capacity_not_calibrated')
      expect(result.nextAction).toMatchObject({ kind: 'complete_data', targetLevel: null })
      expect(result.blockedBy).toEqual([
        expect.objectContaining({
          kind: 'policy',
          profileId: functional.id,
          field: 'investment.capacity.2.atk_flat',
          predicateId: 'synthetic-investment:single-goal:2:atk_flat:capacity',
        }),
      ])
    },
  )

  it('does not silently count a positive low-weight flat stat or lower the core requirement', () => {
    const profile: Profile = {
      ...functional,
      weights: { hp_percent: 1, hp_flat: 0.4 },
      coreStats: ['hp_percent'],
    }
    const item: Disc = {
      ...disc(),
      slot: 4,
      mainStat: 'hp_percent',
      subStats: ['hp_flat', 'crit_rate', 'def_flat', 'pen'].map((stat) => ({
        stat,
        value: 1,
        upgrades: 0,
      })),
    }
    const result = assess(item, [profile])
    expect(result.evidence[0]!.investment.meaningfulStats).toEqual([])
    expect(result.evidence[0]!.investment.coreStats).toEqual([])
    expect(result.evidence[0]!.investment.qualified).toBeNull()
    expect(result.evidence[0]!.currentScore).toBeGreaterThan(0)
    expect(result.qualityDisposition).toBe('review')
    expect(result.nextAction.kind).not.toBe('try_upgrade')
  })

  it('keeps earned quality and complete-level decisions independent of investment calibration', () => {
    const result = assess(disc(15))
    expect(result.reasonKind).toBe('quality_keep')
    expect(result.nextAction.kind).toBe('keep')
    expect(result.evidence[0]!.investment.policyBlockers).toEqual([])
  })

  it.each([0, 15])('preserves sourced main-only functionality at +%i', (level) => {
    const profile: Profile = {
      ...functional,
      functionalMains: [
        {
          slot: 4,
          stat: 'energy_regen',
          completion: 'main_only',
          sourceId: 'synthetic-reviewed-build',
        },
      ],
    }
    const result = assess({ ...disc(level), slot: 4, mainStat: 'energy_regen' }, [profile])
    expect(result.evidence[0]!.investment.policyBlockers).toEqual([])
    expect(result.nextAction.kind).toBe(level === 15 ? 'keep' : 'try_upgrade')
  })

  it('keeps an unknown goal uncalibrated without claiming a legal-capacity exception', () => {
    const result = assess(disc(), [{ ...functional, goal: 'unknown' }])
    expect(result.evidence[0]!.investment.qualified).toBeNull()
    expect(result.evidence[0]!.investment.policyBlockers).toEqual([])
    expect(result.qualityDisposition).toBe('review')
  })

  it('does not reject an independently qualified valid trial because another goal needs calibration', () => {
    const profile: Profile = {
      ...functional,
      id: 'independent-crit',
      goal: 'crit_damage',
      weights: { atk_percent: 0.75, crit_rate: 1, crit_dmg: 1 },
      coreStats: ['crit_rate', 'crit_dmg'],
    }
    const result = assess(disc(), [functional, profile])
    expect(
      result.evidence.find((row) => row.profileId === functional.id)!.investment.qualified,
    ).toBeNull()
    expect(result.nextAction).toMatchObject({ kind: 'try_upgrade', targetLevel: 3 })
    expect(result.witnessProfileIds).toEqual([profile.id])
    expect(result.blockedBy).toEqual([])
  })

  it('identifies every current production combination with an impossible nonzero substat policy', () => {
    const investment = productionPolicy.investment!
    let affected = 0
    let calibrated = 0
    let pending = 0
    for (const profile of productionCatalog.profiles) {
      if (
        !profileValid(profile, productionCatalog.rules) ||
        profile.weightEvidence?.method === noFunctionalSubstatGoalMethod
      )
        continue
      for (const [slot, mains] of Object.entries(productionCatalog.rules.mainStatsBySlot)) {
        for (const main of mains) {
          if (+slot > 3 && profile.mainStatsBySlot[slot]?.[main] === 'incompatible') continue
          const native = productionCatalog.rules.rarities.S!
          const legal = Object.keys(native.steps).filter((stat) => stat !== main)
          const meaningful = legal.filter(
            (stat) => (profile.weights[stat] ?? 0) >= investment.meaningfulWeightFrom,
          )
          const core = meaningful.filter((stat) => profile.coreStats?.includes(stat))
          const minimum =
            +slot <= 3 ? investment.leftSlotMinimumLines : investment.rightSlotMinimumLines
          if (meaningful.length >= minimum && core.length >= investment.minimumCoreLines) continue
          const set = productionCatalog.sets.find(
            (row) =>
              twoPieceApplicability(row, profile) !== 'incompatible' ||
              (profile.fourPieceUses?.[row.id] ?? 'incompatible') !== 'incompatible',
          )!
          const item: Disc = {
            id: 'synthetic-production-capacity',
            setId: set.id,
            slot: +slot,
            mainStat: main,
            rarity: 'S',
            level: 0,
            subStats: legal
              .sort((a, b) => (profile.weights[b] ?? 0) - (profile.weights[a] ?? 0))
              .slice(0, 4)
              .map((stat) => ({ stat, value: native.steps[stat]!, upgrades: 0 })),
          }
          const evidence = scoreProfile(
            item,
            profile,
            set,
            productionCatalog.rules,
            productionPolicy,
          )
          if (evidence.investment.calibrationId) {
            expect(evidence.investment.qualified, `${profile.id}/${slot}/${main}`).toBe(true)
            expect(evidence.investment.minimumLines).toBe(core.length ? 1 : 0)
            expect(evidence.investment.requiredCoreStats).toEqual(core)
            if (!core.length) {
              expect(evidence.investment.requiredSecondaryStats).toEqual(['hp_flat'])
              expect(evidence.investment.meaningfulStats).toEqual([])
              expect(evidence.investment.coreStats).toEqual([])
            }
            expect(evidence.investment.policyBlockers).toEqual([])
            calibrated += 1
          } else {
            expect(evidence.investment.qualified, `${profile.id}/${slot}/${main}`).toBeNull()
            expect(evidence.investment.policyBlockers).toEqual([
              expect.objectContaining({
                kind: 'policy',
                profileId: profile.id,
                field: `investment.capacity.${slot}.${main}`,
              }),
            ])
            expect(profile.weights.hp_flat).toBeGreaterThan(0)
            pending += 1
          }
          affected += 1
        }
      }
    }
    expect(affected).toBe(33)
    expect(calibrated).toBe(33)
    expect(pending).toBe(0)
  })
})
