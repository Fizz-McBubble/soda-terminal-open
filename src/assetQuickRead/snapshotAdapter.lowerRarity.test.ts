import { describe, expect, it } from 'vitest'
import { convertAssetSnapshot } from './snapshotAdapter'
import { present, omitted, stat, syntheticAssetSnapshot } from './syntheticAssetSnapshotTestFixture'
import rawDiscData from '../data/drive-disc-data.v1.json'
import { preflightDriveDiscImport } from '../domain/discImport'
import type { SnapshotObservation } from './snapshotProtocolSchema'
import { driveDiscDataManifestSchema } from '../domain/schemas'

const context = { snapshotSha256: 'a'.repeat(64) }
// Only stat facts are reproduced from the authorized failed observation.
// Identities, sets, main stats and transport data are synthetic.
const observedLowerDiscs = [
  {
    rarity: 'B',
    level: 2,
    subs: [
      [11103, 37, 1],
      [11102, 100, 1],
    ],
  },
  { rarity: 'B', level: null, subs: [[12103, 6, 1]] },
  {
    rarity: 'B',
    level: 9,
    subs: [
      [13103, 5, 1],
      [11103, 37, 1],
      [13102, 160, 1],
      [20103, 80, 1],
    ],
  },
  {
    rarity: 'A',
    level: null,
    subs: [
      [13103, 10, 1],
      [12103, 13, 1],
      [11102, 200, 1],
    ],
  },
  {
    rarity: 'A',
    level: 12,
    subs: [
      [12102, 200, 1],
      [11102, 200, 2],
      [13103, 10, 1],
      [12103, 13, 2],
    ],
  },
] as const
function mixedFixture() {
  const input = syntheticAssetSnapshot()
  const discs: (Omit<(typeof input.assets.discs)[number], 'level'> & {
    level: SnapshotObservation
  })[] = input.assets.discs
  for (const [index, row] of observedLowerDiscs.entries()) {
    discs.push({
      uid: present(880000 + index),
      catalog_id: present(row.rarity === 'B' ? 31023 : 31033),
      level: row.level === null ? omitted() : present(row.level),
      main_stat: stat(13103, row.rarity === 'B' ? 15 : 31),
      substats: row.subs.map(([key, base, add]) => stat(key, base, add)),
    })
    input.counts.discs++
    if (row.rarity === 'B') input.counts.b_discs++
    else input.counts.a_discs++
  }
  // Avoid a deliberately invalid main/sub duplicate in the synthetic +9/+12 examples.
  input.assets.discs[3].catalog_id = present(31022)
  input.assets.discs[3].main_stat = stat(12103, 26)
  input.assets.discs[4].catalog_id = present(31031)
  input.assets.discs[4].main_stat = stat(11103, 367)
  input.assets.discs[5].catalog_id = present(31036)
  input.assets.discs[5].main_stat = stat(30502, 1000)
  return input
}

describe('asset quick-read exact lower-rarity substat bases', () => {
  it('scopes A/B before schema validation, keeps total read counts and excludes duplicated or malformed lower-grade identities', () => {
    const input = mixedFixture()
    const raw = input as unknown as { assets: { discs: Record<string, unknown>[] } }
    raw.assets.discs[1].uid = input.assets.discs[0].uid
    raw.assets.discs[1].substats = { unconsumed: 'malformed' }
    raw.assets.discs[2].uid = 'unconsumed malformed identity'
    raw.assets.discs[2].main_stat = 'unconsumed malformed stat'
    const result = convertAssetSnapshot(input, context)
    expect(result.importable).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.counts.discs).toBe(6)
    expect(result.discs.discs).toHaveLength(1)
    expect(result.discs.discs.every((disc) => disc.rarity === 'S')).toBe(true)
  })
  it.each(['base', 'multiplier', 'level', 'duplicate', 'unknown'] as const)(
    'continues to block malformed S %s facts without silently skipping the S disc',
    (failure) => {
      const input = mixedFixture()
      const disc = input.assets.discs[0]
      if (failure === 'base') disc.substats[0].base_value = present(38)
      if (failure === 'multiplier') disc.substats[0].add_value = present(7)
      if (failure === 'level') disc.level = present(16)
      if (failure === 'duplicate') disc.substats[1].key = disc.substats[0].key
      if (failure === 'unknown') disc.substats[0].key = present(999999)
      const result = convertAssetSnapshot(input, context)
      expect(result.importable).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.counts.sDiscs).toBe(1)
    },
  )
  it('accepts the five lower-grade stat patterns that caused six blocking issues while importing every S disc', () => {
    const result = convertAssetSnapshot(mixedFixture(), context)
    expect(result.issues).toEqual([])
    expect(result.importable).toBe(true)
    expect(result.counts).toMatchObject({ discs: 6, sDiscs: 1 })
    expect(result.discs.discs).toEqual(
      convertAssetSnapshot(syntheticAssetSnapshot(), context).discs.discs,
    )
  })
  it.each([
    ['B', 37, 6, 5, 3, 3],
    ['A', 75, 13, 10, 6, 6],
    ['S', 112, 19, 15, 9, 9],
  ] as const)(
    'keeps all %s flat substat bases exactly aligned with the primary scanner metadata',
    (grade, hp, atk, def, pen, anomaly) => {
      const steps = rawDiscData.rules.subStatStepsByRarity[grade]
      for (const [key, value] of [
        ['hp_flat', hp],
        ['atk_flat', atk],
        ['def_flat', def],
        ['pen', pen],
        ['anomaly_proficiency', anomaly],
      ] as const)
        expect(steps.find((row) => row.stat === key)?.baseValue).toBe(value)
    },
  )
  it.each([
    ['B', 37],
    ['A', 75],
  ] as const)(
    'validates %s actual HP progression in the shared domain preflight without tolerance widening',
    (rarity, base) => {
      const input = {
        format: 'soda-terminal-drive-disc-import',
        formatVersion: 1,
        discs: [
          {
            setId: 'set-woodpecker-electro',
            slot: 2,
            level: 0,
            rarity,
            mainStat: 'atk_flat',
            subStats: [{ stat: 'hp_flat', value: base, upgrades: 0 }],
          },
        ],
      }
      const data = driveDiscDataManifestSchema.parse(rawDiscData)
      const settings = {
        driveDiscSets: data.driveDiscSets,
        driveDiscRules: data.rules,
        gameDataVersion: data.gameVersion,
      }
      expect(preflightDriveDiscImport(input, settings).summary.failed).toBe(0)
      input.discs[0].subStats[0].value++
      expect(preflightDriveDiscImport(input, settings).summary.failed).toBe(1)
    },
  )
  it.each(['base', 'multiplier', 'level', 'duplicate', 'unknown'] as const)(
    'excludes malformed A/B %s fields before import validation',
    (failure) => {
      const input = mixedFixture()
      const lower = input.assets.discs[1]
      if (failure === 'base') lower.substats[0].base_value = present(38)
      if (failure === 'multiplier') lower.substats[0].add_value = present(7)
      if (failure === 'level') lower.level = present(10)
      if (failure === 'duplicate') lower.substats[1].key = lower.substats[0].key
      if (failure === 'unknown') lower.substats[0].key = present(999999)
      const result = convertAssetSnapshot(input, context)
      expect(result.importable).toBe(true)
      expect(result.issues).toEqual([])
      expect(result.discs.discs).toEqual(
        convertAssetSnapshot(syntheticAssetSnapshot(), context).discs.discs,
      )
    },
  )
})
