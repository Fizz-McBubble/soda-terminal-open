import { describe, expect, it } from 'vitest'
import type { DriveDisc } from '../domain/schemas'
import { projectOutOfCombatPanel } from './outOfCombatPanel'

// Transcribed equipment values; expectations are independent arithmetic from
// the published base stats and the locked core/2pc rules, not generated panels.
const ariaDiscs: DriveDisc[] = (
  [
    [
      'hp_flat',
      [
        ['atk_percent', 9],
        ['atk_flat', 57],
        ['crit_dmg', 9.6],
        ['pen', 9],
      ],
    ],
    [
      'atk_flat',
      [
        ['anomaly_proficiency', 27],
        ['atk_percent', 6],
        ['def_percent', 9.6],
        ['crit_dmg', 9.6],
      ],
    ],
    [
      'def_flat',
      [
        ['crit_rate', 4.8],
        ['anomaly_proficiency', 27],
        ['hp_flat', 112],
        ['atk_flat', 38],
      ],
    ],
    [
      'anomaly_proficiency',
      [
        ['atk_percent', 3],
        ['hp_flat', 336],
        ['def_percent', 4.8],
        ['atk_flat', 57],
      ],
    ],
    [
      'ether_dmg',
      [
        ['atk_flat', 57],
        ['hp_flat', 112],
        ['pen', 18],
        ['anomaly_proficiency', 18],
      ],
    ],
    [
      'anomaly_mastery',
      [
        ['anomaly_proficiency', 18],
        ['atk_percent', 9],
        ['hp_percent', 6],
        ['def_flat', 30],
      ],
    ],
  ] as Array<[DriveDisc['mainStat'], Array<[DriveDisc['mainStat'], number]>]>
).map(([mainStat, subs], index) => ({
  id: `aria-menu-${index + 1}`,
  setId: [2, 4].includes(index) ? 'set-shining-aria' : 'set-phaethons-melody',
  slot: (index + 1) as DriveDisc['slot'],
  level: 15,
  rarity: 'S',
  mainStat,
  subStats: subs.map(([stat, value]) => ({ stat, value, upgrades: 0 })),
  locked: false,
  favorite: false,
  tags: [],
  dataVersion: 'synthetic-menu-comparison',
  createdAt: '2026-10-04T00:00:00.000Z',
  updatedAt: '2026-10-04T00:00:00.000Z',
}))
const input = {
  agentId: 'agent-aria',
  level: 60,
  ascension: 5,
  core: 5,
  wEngine: { id: 'wengine-14133', level: 60, ascension: 5, refinement: 1 },
  discs: ariaDiscs,
}

describe('published menu bases and core multiplication order', () => {
  it('matches the Aria equipment panel without replacing final results with observed values', () => {
    const result = projectOutOfCombatPanel(input)
    expect(result.status).toBe('ok')
    expect(result.values.hp).toBeCloseTo(10973.94, 6)
    expect(result.values.atk).toBeCloseTo(2526.52, 6)
    expect(result.values.def).toBeCloseTo(922.136, 6)
    // (115 base + 36 core F) * (1 + 30% slot6 + 8% Phaethon).
    expect(result.values.anomalyMastery).toBeCloseTo(208.38, 6)
    expect(result.values.anomalyProficiency).toBe(388)
    expect(result.values.critRate).toBeCloseTo(9.8, 6)
    expect(result.values.critDamage).toBeCloseTo(69.2, 6)
    expect(result.values.impact).toBe(87)
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        source: 'character:coreStats.anomMas',
        operation: 'base',
        value: 36,
      }),
    )
  })

  it('keeps core-zero, learned-core and percent equipment distinct', () => {
    expect(projectOutOfCombatPanel({ ...input, core: -1 }).values.anomalyMastery).toBeCloseTo(
      158.7,
      6,
    )
    const withoutMain = ariaDiscs.map((disc) =>
      disc.slot === 6 ? { ...disc, mainStat: 'atk_percent' as const } : disc,
    )
    expect(
      projectOutOfCombatPanel({ ...input, discs: withoutMain }).values.anomalyMastery,
    ).toBeCloseTo(163.08, 6)
    expect(
      projectOutOfCombatPanel({ ...input, agentId: 'agent-nangong' }).values.anomalyMastery,
    ).toBeCloseTo(173.88, 6)
  })

  it('multiplies Koleda core impact together with base impact', () => {
    const discs = ariaDiscs.map((disc) => ({
      ...disc,
      setId: disc.slot <= 2 ? 'set-shockstar-disco' : 'set-woodpecker-electro',
      mainStat: disc.slot === 6 ? ('impact' as const) : disc.mainStat,
    }))
    const result = projectOutOfCombatPanel({ ...input, agentId: 'agent-koleda', discs })
    // (116 + 18) * (1 + 18% slot6 + 6% Shockstar).
    expect(result.values.impact).toBeCloseTo(166.16, 6)
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        source: 'character:coreStats.impact',
        operation: 'base',
        value: 18,
      }),
    )
  })
})
