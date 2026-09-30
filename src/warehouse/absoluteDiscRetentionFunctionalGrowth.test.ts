import { describe, expect, it } from 'vitest'
import { absoluteDiscRetentionCatalog } from './absoluteDiscRetentionCatalog'
import { assessDisc } from './absoluteDiscRetentionKernel'
import type { Catalog, Disc, Profile, QualityPolicy } from './absoluteDiscRetentionContract'

const rules = absoluteDiscRetentionCatalog.rules
const mainStats = ['energy_regen', 'impact', 'anomaly_mastery']
const levels = [0, 3, 6, 9, 12, 14, 15]
const profileFor = (stat: string): Profile => ({
  id: 'synthetic-function',
  agentId: 'synthetic-agent',
  verified: true,
  sourceIds: ['synthetic-reviewed-function'],
  goal: 'functional',
  coreStats: ['atk_percent'],
  weights: { atk_percent: 1 },
  mainStatsBySlot: { '6': { [stat]: 'valid' } },
  effectUtility: { atk_: 'valid' },
  functionalMains: [
    {
      slot: 6,
      stat,
      sourceId: 'synthetic-reviewed-function',
      completion: 'main_only',
      detail: '已证实的单盘主词功能在主词升满时完成。',
    },
  ],
})
function catalog(profiles: readonly Profile[]): Catalog {
  return {
    rules,
    profiles,
    sets: [
      {
        id: 'synthetic-set',
        verified: true,
        sourceIds: ['synthetic-set-effect'],
        twoPieceEffects: [{ stat: 'atk_', value: 10 }],
      },
    ],
    releasedAgentIds: ['synthetic-agent'],
    branchCoverageComplete: true,
    factsGameVersion: 'synthetic-current',
    assessmentGameVersion: 'synthetic-current',
    reviewedUseScope: 'synthetic-reviewed-builds',
  }
}
function policy(profiles: readonly Profile[]): QualityPolicy {
  return {
    id: 'synthetic-growth-policy',
    calibration: 'approved',
    calibratedRarities: ['S'],
    byProfile: Object.fromEntries(
      profiles.map((profile) => [
        profile.id,
        { '6': { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 } },
      ]),
    ),
    investment: {
      id: 'synthetic-investment-policy',
      calibration: 'approved',
      meaningfulWeightFrom: 0.5,
      minimumCoreLines: 1,
      leftSlotMinimumLines: 2,
      rightSlotMinimumLines: 1,
      growthTarget: 'keepFrom',
      progressFloorBySpentNode: { '0': 0, '1': 0.25, '2': 0.45, '3': 0.65, '4': 0.85, '5': 1 },
    },
  }
}
function disc(stat: string, level: number, initial: number): Disc {
  const spent = Math.floor(level / rules.enhancementInterval)
  const names = ['def_flat', 'def_percent', 'hp_flat', 'hp_percent'].slice(
    0,
    initial === 3 && spent === 0 ? 3 : 4,
  )
  const upgrades = Math.max(0, spent - (initial === 3 ? 1 : 0))
  return {
    id: 'synthetic-function-disc',
    setId: 'synthetic-set',
    slot: 6,
    mainStat: stat,
    rarity: 'S',
    level,
    subStats: names.map((name, index) => ({
      stat: name,
      value: rules.rarities.S!.steps[name]! * (1 + (index === 0 ? upgrades : 0)),
      upgrades: index === 0 ? upgrades : 0,
    })),
  }
}
function assess(item: Disc, profiles: readonly Profile[]) {
  return assessDisc(item, catalog(profiles), policy(profiles))
}

describe('sourced main-only functionality has its own legal growth path', () => {
  it.each(mainStats)(
    '%s remains coherent from initial seeds to completed functionality',
    (stat) => {
      const profile = profileFor(stat)
      for (const initial of [3, 4])
        for (const level of levels) {
          const result = assess(disc(stat, level, initial), [profile])
          expect(result.reasonKind, `initial=${initial}, level=${level}`).not.toBe('invalid_record')
          expect(result.evidence[0]!.currentScore).toBe(0)
          if (initial === 4 || level >= 3)
            expect(result.evidence[0]!.possibleFinalScore.upper).toBe(0)
          expect(result.witnessProfileIds).toEqual([profile.id])
          if (level === 15) {
            expect(result.qualityDisposition).toBe('keep')
            expect(result.reasonKind).toBe('functional_ready')
            expect(result.nextAction).toMatchObject({ kind: 'keep', targetLevel: null })
          } else {
            expect(result.qualityDisposition).toBe('observe')
            expect(result.reasonKind).toBe('try_next_upgrade')
            expect(result.nextAction).toMatchObject({
              kind: 'try_upgrade',
              targetLevel: Math.min(15, (Math.floor(level / 3) + 1) * 3),
            })
            expect(result.reasons).toContain('sourced_functional_main_growth')
          }
        }
    },
  )

  it.each(mainStats)(
    '%s conditional functionality requires its conditions before upgrading',
    (stat) => {
      const profile: Profile = {
        ...profileFor(stat),
        mainAvailability: 'conditional',
        conditionEvidence: [
          {
            state: 'conditional',
            predicateId: 'synthetic-team-condition',
            detail: '先核对该具名构筑的队伍前提。',
            evidenceIds: ['synthetic-reviewed-function'],
          },
        ],
      }
      for (const level of levels) {
        const result = assess(disc(stat, level, 4), [profile])
        expect(result.qualityDisposition).toBe('review')
        expect(result.reasonKind).toBe('conditional_use')
        expect(result.nextAction).toMatchObject({ kind: 'check_condition', targetLevel: null })
        expect(result.blockedBy.some((row) => row.predicateId === 'synthetic-team-condition')).toBe(
          true,
        )
      }
    },
  )

  it('retains qualified quality while requiring conditional functionality to be checked first', () => {
    const base = profileFor('impact')
    const profile: Profile = {
      ...base,
      weights: { def_flat: 1, def_percent: 1, hp_flat: 1, hp_percent: 1 },
      mainAvailability: 'conditional',
      conditionEvidence: [
        {
          state: 'conditional',
          predicateId: 'synthetic-team-condition',
          detail: '先核对队伍前提。',
          evidenceIds: ['synthetic-reviewed-function'],
        },
      ],
    }
    for (const level of [6, 12, 15]) {
      const result = assess(disc('impact', level, 4), [profile])
      expect(result.evidence[0]!.currentScore).toBeGreaterThanOrEqual(60)
      expect(result.qualityDisposition).toBe('keep')
      expect(result.reasonKind).toBe('conditional_use')
      expect(result.nextAction).toMatchObject({ kind: 'check_condition', targetLevel: null })
      expect(result.blockedBy.some((row) => row.predicateId === 'synthetic-team-condition')).toBe(
        true,
      )
    }
  })

  it('does not exempt missing, incompatible, invalid or complete-build-only functions', () => {
    const base = profileFor('energy_regen')
    const item = disc('energy_regen', 0, 4)
    expect(assess(item, [{ ...base, sourceIds: [], verified: false }]).reasonKind).toBe(
      'missing_fact',
    )
    expect(
      assess(item, [{ ...base, mainStatsBySlot: { '6': { energy_regen: 'incompatible' } } }])
        .qualityDisposition,
    ).toBe('cleanup_candidate')
    expect(
      assess({ ...item, subStats: [{ stat: 'def_flat', value: 1, upgrades: 0 }] }, [base])
        .reasonKind,
    ).toBe('invalid_record')
    const completeBuild: Profile = {
      ...base,
      functionalMains: base.functionalMains!.map((entry) => ({
        ...entry,
        completion: 'build_threshold',
      })),
    }
    expect(assess(item, [completeBuild]).nextAction).toMatchObject({
      kind: 'check_condition',
      targetLevel: null,
    })
  })

  it('keeps the complete functional witness independent of unrelated failed-quality branches', () => {
    const base = profileFor('impact')
    const unrelated: Profile = { ...base, id: 'synthetic-low-quality', functionalMains: [] }
    const item = disc('impact', 12, 4)
    const result = assess(item, [unrelated, base])
    const reordered = assess({ ...item, id: 'other-id' }, [base, unrelated])
    expect(result.nextAction.kind).toBe('try_upgrade')
    expect(result.witnessProfileIds).toEqual([base.id])
    expect(reordered.qualityDisposition).toBe(result.qualityDisposition)
    expect(reordered.evidence.map((row) => row.currentScore)).toEqual([0, 0])
  })
})
