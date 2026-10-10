import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { DriveDisc } from '../domain/schemas'
import { analyzeAccountWarehouse } from './discWarehouseAnalysis'
import { warehouseTestDisc } from './discWarehouseAnalysis.testFixtures'
import {
  absoluteDiscRetentionCatalog,
  absoluteDiscRetentionPolicy,
} from './absoluteDiscRetentionCatalog'
import { scoreProfile, twoPieceApplicability } from './absoluteDiscRetentionScoring'
import { retentionUseGuidance } from './warehouseRetentionGuidance'

describe('player stat explanations from the actual scored build', () => {
  it('projects the named effective investment minimum while unresolved HP mains retain their positive minor stat', () => {
    const catalog = absoluteDiscRetentionCatalog
    for (const [id, slot, main, minimum] of [
      ['agent-seth:base-0:fnv1a-f5ec', 2, 'atk_flat', 1],
      ['agent-zhao:base-0:fnv1a-2a59', 4, 'hp_percent', 1],
    ] as const) {
      const profile = catalog.profiles.find((row) => row.id === id)!
      const set = catalog.sets.find(
        (row) => twoPieceApplicability(row, profile) !== 'incompatible',
      )!
      const native = catalog.rules.rarities.S!
      const legalStats = Object.keys(native.steps) as DriveDisc['subStats'][number]['stat'][]
      const disc = warehouseTestDisc('synthetic-calibration-guide', {
        rarity: 'S',
        setId: set.id,
        slot,
        mainStat: main,
        level: 0,
        subStats: legalStats
          .filter((stat) => stat !== main)
          .sort((a, b) => (profile.weights[b] ?? 0) - (profile.weights[a] ?? 0))
          .slice(0, 4)
          .map((stat) => ({ stat, value: native.steps[stat]!, upgrades: 0 })),
      })
      const use = scoreProfile(
        { ...disc, rarity: 'S' },
        profile,
        set,
        catalog.rules,
        absoluteDiscRetentionPolicy,
      )
      const guide = retentionUseGuidance(disc, use, profile, absoluteDiscRetentionPolicy)!
      expect(guide.minimumLines).toBe(minimum)
      expect(guide.minimumCoreLines).toBe(1)
      if (slot === 2) {
        expect(use.investment.calibrationId).toBeTruthy()
        expect(use.investment.qualified).toBe(true)
        expect(guide.subStats).toEqual(['atk_percent'])
        expect(absoluteDiscRetentionPolicy.investment!.leftSlotMinimumLines).toBe(2)
      } else {
        expect(use.investment.calibrationId).toBeNull()
        expect(use.investment.qualified).toBeNull()
        expect(guide.minorStats).toContain('hp_flat')
        expect(guide.unusedStats).not.toContain('hp_flat')
      }
    }
  })
  it('explains the reported Thorned Rose disc without claiming a two-piece user wants four pieces', () => {
    const disc = warehouseTestDisc('rose', {
      setId: 'set-34200',
      slot: 3,
      mainStat: 'def_flat',
      level: 0,
      subStats: [
        { stat: 'crit_rate', value: 2.4, upgrades: 0 },
        { stat: 'hp_flat', value: 112, upgrades: 0 },
        { stat: 'anomaly_proficiency', value: 9, upgrades: 0 },
      ],
    })
    const input = {
      accountId: 'explanation-test',
      discs: [disc],
      roster: createEmptyRoster('2026-10-04'),
      drafts: [],
    }
    const before = structuredClone(input)
    const result = analyzeAccountWarehouse(input).decisions[0]!.absoluteRetention!
    expect(result.reasonKind).toBe('low_investment_value')
    const ben = result.leadingUses.find((use) => use.agentId === 'agent-ben')!
    const claret = result.leadingUses.find((use) => use.agentId === 'agent-claret')!
    expect(ben.twoPieceFit).toBe('valid')
    expect(ben.fourPieceFit).toBe('incompatible')
    expect(claret.guidance?.fourPieceEffect).toContain('1000/1800')
    for (const use of [ben, claret]) {
      expect(use.guidance).toMatchObject({
        mainStats: ['def_flat'],
        matchedStats: ['crit_rate'],
        unusedStats: ['hp_flat', 'anomaly_proficiency'],
        minimumLines: 2,
        twoPieceEffect: '防御力提升16%。',
      })
      expect(use.guidance?.subStats).not.toContain('def_flat')
      expect(use.investment?.meaningfulStats).toEqual(['crit_rate'])
      expect(use.guidance?.sources.length).toBeGreaterThan(0)
    }
    expect(ben.guidance?.sources.some((source) => source.sourceVersion === null)).toBe(true)
    expect(claret.guidance?.sources.some((source) => source.sourceVersion === '3.2')).toBe(true)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    expect(input).toEqual(before)
  })

  it('describes Claret crit damage as conversion rather than ordinary critical amplification', () => {
    const profile = absoluteDiscRetentionCatalog.profiles.find(
      (entry) => entry.agentId === 'agent-claret',
    )!
    expect(profile.utilityEvidence?.crit_dmg_?.detail).toContain('35%转为暴击率')
    expect(profile.utilityEvidence?.crit_dmg_?.detail).toContain('不直接使用普通暴击伤害')
    // Presentation changes do not silently recalibrate the existing quality policy.
    expect(profile.weights.crit_dmg).toBe(1)
  })
})
