import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { input as worldInput } from '../decision/warehouseActionProjection.testFixture'
import { driveDiscSchema, type DriveDisc, type StatKey } from '../domain/schemas'
import { preflightDriveDiscImport, driveDiscImportFormat } from '../domain/discImport'
import { driveDiscData } from '../data/gameData'
import {
  absoluteDiscRetentionCatalog as catalog,
  absoluteDiscRetentionPolicy as policy,
  toAbsoluteRetentionDisc,
} from './absoluteDiscRetentionCatalog'
import { assessDisc, assessWarehouse } from './absoluteDiscRetentionKernel'
import { analyzeAccountWarehouse } from './discWarehouseAnalysis'
import { warehouseClearAlternative, warehouseTestDisc } from './discWarehouseAnalysis.testFixtures'

function disc(
  rarity: 'A' | 'B',
  level: number,
  initial: number,
): DriveDisc & { rarity: 'A' | 'B' } {
  const rules = catalog.rules.rarities[rarity]!
  const spent = Math.floor(level / catalog.rules.enhancementInterval)
  const lines = Math.min(catalog.rules.maxSubStats, initial + spent)
  const upgrades = spent - (lines - initial)
  const stats: StatKey[] = ['crit_rate', 'crit_dmg', 'atk_percent', 'def_flat']
  const source = warehouseTestDisc(`${rarity}-${level}-${initial}`, {
    level,
    setId: 'set-woodpecker-electro',
    slot: 1,
    mainStat: 'hp_flat',
    subStats: stats.slice(0, lines).map((stat, index) => ({
      stat,
      value: rules.steps[stat]! * (1 + (index === 0 ? upgrades : 0)),
      upgrades: index === 0 ? upgrades : 0,
    })),
  })
  return { ...source, rarity }
}

const cases = (['A', 'B'] as const).flatMap((rarity) => {
  const rules = catalog.rules.rarities[rarity]!
  return rules.initialLineCounts.flatMap((initial) =>
    [...new Set([0, 1, 3, 4, 6, rules.maxLevel])].map((level) => disc(rarity, level, initial)),
  )
})

describe('approved A/B retention rule', () => {
  it.each(['A', 'B'] as const)(
    'preserves %s equipment references even when the roster ownership marker conflicts',
    (rarity) => {
      const source = disc(rarity, 0, 2)
      const roster = createEmptyRoster('2026-10-04T00:00:00.000Z')
      roster.agents[0] = { ...roster.agents[0]!, owned: false, equippedDiscIds: [source.id] }
      const input = {
        accountId: 'isolated-equipment-reference',
        discs: [source],
        roster,
        drafts: [],
      }
      const before = structuredClone(input)
      const snapshot = analyzeAccountWarehouse(input)
      const decision = snapshot.decisions[0]!
      expect(input).toEqual(before)
      expect(decision.category).toBe('current_plan_key')
      expect(decision.cleanupSafety.equipped).toBe(true)
      expect(decision.absoluteRetention?.nextAction?.kind).toBe('keep')
      expect(snapshot.referenceIssues?.equipmentNeedsReview).toBe(true)
    },
  )

  it.each(['A', 'B'] as const)(
    'preserves %s in standard and compatible scanner JSON imports',
    (rarity) => {
      const source = disc(rarity, 0, 2)
      const context = {
        driveDiscSets: driveDiscData!.driveDiscSets,
        driveDiscRules: driveDiscData!.rules,
        gameDataVersion: driveDiscData!.gameVersion,
        now: '2026-09-30T00:00:00.000Z',
      }
      for (const payload of [
        { format: driveDiscImportFormat, formatVersion: 1, discs: [source] },
        { drive_discs: [source] },
      ]) {
        const result = preflightDriveDiscImport(payload, context)
        expect(result.summary).toMatchObject({ ready: 1, failed: 0 })
        expect(result.readyDiscs[0]?.rarity).toBe(rarity)
      }
    },
  )
  it.each(cases)('cleans legal $id without quality scores or growth trials', (source) => {
    const result = assessDisc(source, catalog, policy)
    expect(result).toMatchObject({
      qualityDisposition: 'cleanup_candidate',
      reasonKind: 'approved_rarity_cleanup',
      sourceCoverage: 'complete',
      bestUseScore: null,
      evidence: [],
      nextAction: { kind: 'manual_cleanup', targetLevel: null },
    })
    expect(result.reviewedUseScope).toContain(policy.rarityCleanup!.sourceIds[0])
    expect(result.blockedBy).toEqual([])
  })

  it.each(['A', 'B'] as const)('does not let a functional main reserve %s', (rarity) => {
    const source = { ...disc(rarity, 0, 2), slot: 6, mainStat: 'energy_regen' }
    expect(assessDisc(source, catalog, policy).reasonKind).toBe('approved_rarity_cleanup')
  })

  it('is independent of actor ownership, inventory order and unresolved build facts', () => {
    const source = disc('A', 0, 2)
    const initial = assessDisc(source, catalog, policy)
    expect(
      assessDisc(source, { ...catalog, profiles: [], branchCoverageComplete: false }, policy),
    ).toEqual(initial)
    expect(
      assessDisc(source, catalog, policy, { ownedAgentIds: catalog.releasedAgentIds }),
    ).toEqual(initial)
    expect(
      assessWarehouse(
        [toAbsoluteRetentionDisc(warehouseClearAlternative()), source],
        catalog,
        policy,
      )[1],
    ).toEqual(initial)
    const renamed = assessDisc({ ...source, id: 'renamed' }, catalog, policy)
    expect({ ...renamed, discId: source.id }).toEqual(initial)
  })

  it('leaves S quality, growth and functional decisions unchanged', () => {
    const withoutRule = { ...policy, rarityCleanup: undefined }
    for (const raw of [warehouseClearAlternative(), warehouseTestDisc('ordinary-s')]) {
      const source = toAbsoluteRetentionDisc(raw)
      expect(assessDisc(source, catalog, policy)).toEqual(assessDisc(source, catalog, withoutRule))
    }
  })

  it.each(['A', 'B'] as const)(
    'accepts %s through the existing account disc contract',
    (rarity) => {
      const source = disc(rarity, 0, 2)
      expect(driveDiscSchema.parse(source)).toMatchObject({ rarity, id: source.id })
    },
  )

  it('requires an approved, attributable rarity rule rather than inferring calibration', () => {
    const source = disc('A', 0, 2)
    const rule = policy.rarityCleanup!
    for (const rarityCleanup of [
      undefined,
      { ...rule, approval: 'candidate' as const },
      { ...rule, id: '' },
      { ...rule, sourceIds: [] },
      { ...rule, sourceIds: [''] },
      { ...rule, rarities: ['B' as const] },
    ]) {
      expect(assessDisc(source, catalog, { ...policy, rarityCleanup }).reasonKind).not.toBe(
        'approved_rarity_cleanup',
      )
    }
  })

  it('continues to flag malformed records and duplicate physical identities', () => {
    const source = disc('A', 0, 2)
    const malformed = {
      ...source,
      subStats: source.subStats.map((line) => ({ ...line, value: 999 })),
    }
    expect(assessDisc(malformed, catalog, policy).reasonKind).toBe('invalid_record')
    const duplicates = assessWarehouse([source, source], catalog, policy)
    expect(duplicates.every((row) => row.reasonKind === 'invalid_record')).toBe(true)
    expect(duplicates.every((row) => row.nextAction.kind === 'complete_data')).toBe(true)
  })

  it.each(['A', 'B'] as const)(
    'preserves all account protections for %s without writes',
    (rarity) => {
      const base = worldInput()
      for (let mask = 0; mask < 16; mask++) {
        const source = { ...disc(rarity, 0, 2), favorite: Boolean(mask & 1) }
        const roster = createEmptyRoster('2026-09-30T00:00:00.000Z')
        roster.agents[0] = {
          ...roster.agents[0]!,
          owned: true,
          equippedDiscIds: mask & 2 ? [source.id] : [],
        }
        const input = {
          accountId: base.warehouse.accountId!,
          discs: [source],
          roster,
          drafts: mask & 4 ? [{ ...base.drafts[0]!, warehouseRefs: [source.id] }] : [],
          protectedSimultaneousDemands: mask & 8 ? [{ id: 'selected', discIds: [source.id] }] : [],
          protectedDemandCoverageComplete: true,
        }
        const before = structuredClone(input)
        const result = analyzeAccountWarehouse(input).decisions[0]!
        expect(input).toEqual(before)
        expect(result.absoluteRetention?.reasonKind).toBe('approved_rarity_cleanup')
        expect(result.absoluteRetention?.bestUseScore).toBeNull()
        expect(result.absoluteRetention?.nextAction?.kind).toBe(mask ? 'keep' : 'manual_cleanup')
        expect(result.category === 'cleanup_candidate').toBe(mask === 0)
      }
    },
  )
})
