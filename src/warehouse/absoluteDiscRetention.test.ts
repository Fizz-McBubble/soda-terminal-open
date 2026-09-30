import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import {
  absoluteDiscRetentionCatalog,
  absoluteDiscRetentionCoverage,
  absoluteDiscRetentionPolicy,
} from './absoluteDiscRetentionCatalog'
import { assessDisc, twoPieceApplicability } from './absoluteDiscRetentionKernel'
import { analyzeAccountWarehouse } from './discWarehouseAnalysis'
import { warehouseClearAlternative, warehouseTestDisc } from './discWarehouseAnalysis.testFixtures'

const roster = () => createEmptyRoster('2026-09-28T00:00:00.000Z')
const strong = () => warehouseClearAlternative('retained-disc')
const other = () =>
  warehouseTestDisc('other-disc', {
    setId: 'set-woodpecker-electro',
    slot: 1,
    mainStat: 'hp_flat',
    subStats: [
      { stat: 'def_flat', value: 90, upgrades: 5 },
      { stat: 'hp_percent', value: 3, upgrades: 0 },
      { stat: 'atk_flat', value: 19, upgrades: 0 },
      { stat: 'def_percent', value: 4.8, upgrades: 0 },
    ],
  })

describe('production absolute-retention adapter', () => {
  it('covers released agent identities with source-backed separate build profiles', () => {
    expect(absoluteDiscRetentionCoverage.releasedAgentCount).toBeGreaterThan(50)
    expect(absoluteDiscRetentionCoverage.profileCount).toBeGreaterThan(
      absoluteDiscRetentionCoverage.releasedAgentCount,
    )
    expect(absoluteDiscRetentionCoverage.missingAgentIds).toEqual([])
    expect(absoluteDiscRetentionCoverage.complete).toBe(true)
  })

  it('keeps intrinsic quality invariant to another copy, order, identity and ownership', () => {
    const initial = analyzeAccountWarehouse({
      accountId: 'invariant',
      discs: [strong()],
      roster: roster(),
      drafts: [],
    }).decisions[0]!
    const withOther = analyzeAccountWarehouse({
      accountId: 'invariant',
      discs: [other(), strong()],
      roster: roster(),
      drafts: [],
    }).decisions.find((row) => row.discId === strong().id)!
    const owned = roster()
    owned.agents = owned.agents.map((agent) =>
      agent.agentId === 'agent-billy' ? { ...agent, owned: true } : agent,
    )
    const changed = analyzeAccountWarehouse({
      accountId: 'invariant',
      discs: [{ ...strong(), id: 'renamed' }],
      roster: owned,
      drafts: [],
    }).decisions[0]!
    expect(withOther.absoluteRetention?.disposition).toBe(initial.absoluteRetention?.disposition)
    expect(withOther.absoluteRetention?.bestUseScore).toBe(initial.absoluteRetention?.bestUseScore)
    expect(changed.absoluteRetention?.disposition).toBe(initial.absoluteRetention?.disposition)
    expect(changed.absoluteRetention?.bestUseScore).toBe(initial.absoluteRetention?.bestUseScore)
    expect(withOther.category).toBe(initial.category)
  })

  it('protects explicit equipment without changing intrinsic quality', () => {
    const unprotected = analyzeAccountWarehouse({
      accountId: 'protection',
      discs: [other()],
      roster: roster(),
      drafts: [],
    }).decisions[0]!
    const equipped = roster()
    equipped.agents = equipped.agents.map((agent) =>
      agent.agentId === 'agent-billy'
        ? { ...agent, owned: true, equippedDiscIds: ['other-disc'] }
        : agent,
    )
    const protectedRow = analyzeAccountWarehouse({
      accountId: 'protection',
      discs: [other()],
      roster: equipped,
      drafts: [],
    }).decisions[0]!
    expect(protectedRow.absoluteRetention?.disposition).toBe(
      unprotected.absoluteRetention?.disposition,
    )
    expect(protectedRow.absoluteRetention?.bestUseScore).toBe(
      unprotected.absoluteRetention?.bestUseScore,
    )
    expect(protectedRow.category).toBe('current_plan_key')
  })

  it('shares equal two-piece effect utility without sharing set identity or four-piece uses', () => {
    const swing = absoluteDiscRetentionCatalog.sets.find((set) => set.id === 'set-swing-jazz')!
    const moonlight = absoluteDiscRetentionCatalog.sets.find(
      (set) => set.id === 'set-moonlight-lullaby',
    )!
    const profile = absoluteDiscRetentionCatalog.profiles.find(
      (item) => item.agentId === 'agent-nicole',
    )!
    expect(swing.twoPieceEffects).toEqual(moonlight.twoPieceEffects)
    expect(twoPieceApplicability(swing, profile)).toBe(twoPieceApplicability(moonlight, profile))
    expect(swing.id).not.toBe(moonlight.id)
  })

  it('does not turn an ordinary recommended main or an effect output into functional protection', () => {
    const billy = absoluteDiscRetentionCatalog.profiles.find(
      (item) => item.agentId === 'agent-billy',
    )!
    expect(billy.mainStatsBySlot['4']?.crit_rate).toBe('valid')
    expect(billy.functionalMains?.some((row) => row.stat === 'crit_rate')).toBe(false)
    const nicole = absoluteDiscRetentionCatalog.profiles.filter(
      (item) => item.agentId === 'agent-nicole',
    )
    expect(
      nicole.flatMap((row) => row.functionalMains ?? []).some((row) => row.stat === 'crit_rate'),
    ).toBe(false)
    const rina = absoluteDiscRetentionCatalog.profiles.filter(
      (item) => item.agentId === 'agent-rina',
    )
    expect(
      rina
        .flatMap((row) => row.functionalMains ?? [])
        .some((row) => row.stat === 'pen_ratio' && row.sourceId.startsWith('mechanic-effect:')),
    ).toBe(true)
  })

  it('rejects incompatible mains and elemental two-piece effects within a verified build', () => {
    const zhu = absoluteDiscRetentionCatalog.profiles.find(
      (item) => item.agentId === 'agent-zhu-yuan',
    )!
    expect(zhu.mainStatsBySlot['5']?.ether_dmg).toBe('valid')
    expect(zhu.mainStatsBySlot['5']?.wind_dmg).toBe('incompatible')
    expect(zhu.effectUtility.wind_dmg_).toBe('incompatible')
    expect(zhu.effectUtility.ether_dmg_).toBe('valid')
    expect(zhu.effectUtility.crit_dmg_).toBe('valid')
  })

  it('uses versioned S-rarity cutoffs and reports legal growth bounds without probabilities', () => {
    const assessment = assessDisc(
      {
        id: 'candidate',
        setId: 'set-woodpecker-electro',
        slot: 1,
        rarity: 'S',
        level: 15,
        mainStat: 'hp_flat',
        subStats: other().subStats,
      },
      absoluteDiscRetentionCatalog,
      absoluteDiscRetentionPolicy,
    )
    expect(absoluteDiscRetentionPolicy.calibration).toBe('approved')
    expect(absoluteDiscRetentionPolicy.calibratedRarities).toEqual(['S'])
    expect(assessment.evidence[0]?.cutoffs).toEqual({
      cleanupBelow: 48,
      keepFrom: 60,
      premiumFrom: 67,
    })
    expect(assessment.evidence.length).toBeGreaterThan(0)
    expect(assessment.evidence.every((row) => row.expectedScore === null)).toBe(true)
    expect(
      assessment.evidence.every(
        (row) => row.possibleFinalScore.lower <= row.possibleFinalScore.upper,
      ),
    ).toBe(true)
  })

  it('allows a fully grown weak two-piece disc into manual cleanup only within calibrated rarity', () => {
    const disc = {
      id: 'weak-two-piece',
      setId: 'set-34100',
      slot: 3,
      rarity: 'S',
      level: 15,
      mainStat: 'def_flat',
      subStats: [
        { stat: 'hp_flat', value: 336, upgrades: 2 },
        { stat: 'atk_percent', value: 3, upgrades: 0 },
        { stat: 'def_percent', value: 9.6, upgrades: 1 },
        { stat: 'pen', value: 18, upgrades: 1 },
      ],
    }
    const assessed = assessDisc(disc, absoluteDiscRetentionCatalog, absoluteDiscRetentionPolicy)
    expect(assessed.qualityDisposition).toBe('cleanup_candidate')
    expect(assessed.evidence.some((row) => row.twoPieceFit === 'valid')).toBe(true)
    expect(assessed.evidence.every((row) => row.possibleFinalScore.upper < 48)).toBe(true)
    const excluded = assessDisc(disc, absoluteDiscRetentionCatalog, {
      ...absoluteDiscRetentionPolicy,
      calibratedRarities: ['A'],
    })
    expect(excluded.qualityDisposition).toBe('review')
    expect(excluded.reasons).toContain('rarity_cleanup_threshold_not_calibrated')
  })

  it('treats a sourced functional main stat as a use, not free quality points', () => {
    const assessment = assessDisc(
      {
        id: 'functional-low-quality',
        setId: 'set-swing-jazz',
        slot: 6,
        rarity: 'S',
        level: 15,
        mainStat: 'energy_regen',
        subStats: [
          { stat: 'def_flat', value: 90, upgrades: 5 },
          { stat: 'hp_percent', value: 3, upgrades: 0 },
          { stat: 'atk_flat', value: 19, upgrades: 0 },
          { stat: 'def_percent', value: 4.8, upgrades: 0 },
        ],
      },
      absoluteDiscRetentionCatalog,
      absoluteDiscRetentionPolicy,
    )
    expect(assessment.evidence.some((row) => row.functionalMain)).toBe(true)
    expect(assessment.qualityDisposition).toBe('keep')
    expect(assessment.reasonKind).toBe('functional_ready')
    expect(
      assessment.evidence.find((row) => row.functionalState === 'ready')?.currentScore,
    ).toBeLessThan(48)
  })

  it.each([
    ['A', 0, [1.6, 3.2]],
    ['A', 3, [1.6, 3.2, 2]],
    ['B', 0, [0.8]],
    ['B', 3, [0.8, 1.6]],
  ] as const)(
    'validates %s level %s growth rules independently of the approved rarity cleanup rule',
    (rarity, level, values) => {
      const stats = ['crit_rate', 'crit_dmg', 'atk_percent']
      const assessment = assessDisc(
        {
          id: 'lower-rarity-growth',
          setId: 'set-woodpecker-electro',
          slot: 2,
          mainStat: 'atk_flat',
          rarity,
          level,
          subStats: values.map((value, index) => ({ stat: stats[index]!, value, upgrades: 0 })),
        },
        absoluteDiscRetentionCatalog,
        { ...absoluteDiscRetentionPolicy, rarityCleanup: undefined },
      )
      expect(assessment.reasons).not.toContain('invalid_record')
      expect(assessment.evidence.length).toBeGreaterThan(0)
      expect(
        assessment.evidence.every((row) => row.possibleFinalScore.upper >= row.currentScore),
      ).toBe(true)
      expect(assessment.qualityDisposition).not.toBe('cleanup_candidate')
    },
  )

  it.each([
    ['set-king-of-the-summit', 'crit_rate', 'valid'],
    ['set-phaethons-melody', 'anomaly_proficiency', 'valid'],
    ['set-swing-jazz', 'anomaly_proficiency', 'incompatible'],
  ])('preserves the actual %s / %s function and set gate', (setId, mainStat, setFit) => {
    const assessment = assessDisc(
      {
        id: 'functional-main-only',
        setId,
        slot: 4,
        rarity: 'S',
        level: 15,
        mainStat,
        subStats: [
          { stat: 'def_flat', value: 60, upgrades: 3 },
          { stat: 'hp_flat', value: 224, upgrades: 1 },
          { stat: 'atk_flat', value: 38, upgrades: 1 },
          { stat: 'def_percent', value: 4.8, upgrades: 0 },
        ],
      },
      absoluteDiscRetentionCatalog,
      absoluteDiscRetentionPolicy,
    )
    expect(
      assessment.evidence.some(
        (row) => row.mainFit !== 'incompatible' && row.setFit === setFit && row.functionalMain,
      ),
    ).toBe(true)
    if (setFit === 'incompatible') {
      expect(assessment.qualityDisposition).toBe('cleanup_candidate')
      expect(assessment.reasonKind).toBe('proven_low_ceiling')
      const applicable = assessment.evidence.filter(
        (row) => row.setFit === 'valid' && row.mainFit === 'valid',
      )
      expect(applicable.length).toBeGreaterThan(0)
      expect(applicable.every((row) => row.possibleFinalScore.upper < 48)).toBe(true)
    } else {
      expect(assessment.qualityDisposition).toBe('review')
      expect(assessment.reasonKind).toBe('conditional_use')
      expect(assessment.blockedBy.some((row) => row.field === 'functionalTarget')).toBe(true)
    }
  })
})
