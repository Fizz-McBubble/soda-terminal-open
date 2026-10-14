import type { Catalog, Disc, Profile, QualityPolicy } from './absoluteDiscRetentionContract'
import { assessDisc } from './absoluteDiscRetentionKernel'

export const rules: Catalog['rules'] = {
  sourceIds: ['synthetic-rules'],
  standardRarity: 'S',
  enhancementInterval: 3,
  maxSubStats: 4,
  mainStatsBySlot: { '1': ['hp_flat'], '4': ['atk_percent', 'energy_regen'] },
  rarities: {
    S: {
      maxLevel: 15,
      initialLineCounts: [3, 4],
      steps: {
        hp_flat: 1,
        atk_percent: 1,
        crit_rate: 1,
        crit_dmg: 1,
        def_flat: 1,
        def_percent: 1,
        hp_percent: 1,
        pen: 1,
      },
    },
  },
}
export const baseProfile: Profile = {
  id: 'crit',
  agentId: 'agent-test',
  verified: true,
  sourceIds: ['synthetic-build'],
  weights: { crit_rate: 1, crit_dmg: 1, atk_percent: 0.75 },
  goal: 'crit_damage',
  coreStats: ['crit_rate', 'crit_dmg'],
  weightEvidence: {
    id: 'test-quality',
    method: 'goal_bound_standard_roll_quality_proxy',
    sourceIds: ['synthetic-build'],
  },
  mainStatsBySlot: { '4': { atk_percent: 'valid', energy_regen: 'valid' } },
  effectUtility: { atk_: 'valid' },
  fourPieceUses: { 'set-test': 'incompatible' },
}
export function catalog(profiles: readonly Profile[] = [baseProfile]): Catalog {
  return {
    rules,
    profiles,
    sets: [
      {
        id: 'set-test',
        verified: true,
        sourceIds: ['synthetic-set'],
        twoPieceEffects: [{ stat: 'atk_', value: 10 }],
      },
    ],
    releasedAgentIds: [...new Set(profiles.map((row) => row.agentId))],
    factsGameVersion: 'test',
    assessmentGameVersion: 'test',
    branchCoverageComplete: true,
    reviewedUseScope: 'all-test-builds',
  }
}
export function policy(profiles: readonly Profile[] = [baseProfile]): QualityPolicy {
  return {
    id: 'test-policy',
    calibration: 'approved',
    calibratedRarities: ['S'],
    byProfile: Object.fromEntries(
      profiles.map((row) => [
        row.id,
        {
          '1': { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 },
          '4': { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 },
        },
      ]),
    ),
    investment: {
      id: 'test-stage',
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
export function disc(
  stats = ['crit_rate', 'crit_dmg', 'def_flat'],
  level = 0,
  initial = 3,
  target = 'crit_rate',
): Disc {
  const spent = Math.floor(level / 3)
  const names = spent && initial === 3 ? [...stats, 'def_percent'] : stats
  const upgrades = Math.max(0, spent - (initial === 3 ? 1 : 0))
  return {
    id: 'test-disc',
    setId: 'set-test',
    slot: 1,
    mainStat: 'hp_flat',
    rarity: 'S',
    level,
    subStats: names.map((stat) => ({
      stat,
      value: 1 + (stat === target ? upgrades : 0),
      upgrades: stat === target ? upgrades : 0,
    })),
  }
}
export const assess = (item: Disc, profiles: readonly Profile[] = [baseProfile]) =>
  assessDisc(item, catalog(profiles), policy(profiles))
