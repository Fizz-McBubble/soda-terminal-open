import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { convertAssetSnapshot } from './snapshotAdapter'
import identities from './catalogIdentityProjection.json'
import discCatalog from '../gameDataPacks/generated/current-drive-disc-formula-catalog.v1.json'
import engineCatalog from '../gameDataPacks/generated/current-wengine-static-catalog.v1.json'
import rawDiscData from '../data/drive-disc-data.v1.json'
import { agentCatalog } from '../assault/catalogData'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'

import {
  present,
  omitted,
  stat,
  syntheticAssetSnapshot as fixture,
} from './syntheticAssetSnapshotTestFixture'

const context = { snapshotSha256: 'a'.repeat(64) }
const publicCatalogState = vi.hoisted(() => ({ unavailable: false }))
vi.mock('../application/publicScannerCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../application/publicScannerCatalog')>()
  return {
    ...actual,
    get publicScannerDriveDiscData() {
      return publicCatalogState.unavailable ? null : actual.publicScannerDriveDiscData
    },
  }
})

describe('asset snapshot local candidate adapter', () => {
  it.each(['A', 'B'] as const)(
    'accepts legal %s discs while keeping mixed-grade equipment unsupported',
    (rarity) => {
      const input = fixture()
      const rules = rawDiscData.rules
      const lower = structuredClone(input.assets.discs[0])
      lower.uid = present(990002)
      lower.catalog_id = present(rarity === 'A' ? 31032 : 31022)
      lower.level = present(0)
      lower.main_stat = stat(
        12103,
        rules.mainStatBaseByRarity[rarity].find((row) => row.stat === 'atk_flat')!.baseValue,
      )
      lower.substats = [
        stat(
          11102,
          rules.subStatStepsByRarity[rarity].find((row) => row.stat === 'hp_percent')!.baseValue *
            100,
        ),
      ]
      if (rarity === 'A')
        lower.substats.push(
          stat(
            20103,
            rules.subStatStepsByRarity.A.find((row) => row.stat === 'crit_rate')!.baseValue * 100,
          ),
        )
      input.assets.discs.push(lower)
      input.counts.discs++
      if (rarity === 'A') input.counts.a_discs++
      else input.counts.b_discs++
      input.assets.agents[0].dressed_equips.push({ uid: present(990002), slot: present(2) })
      const result = convertAssetSnapshot(input, context)
      expect(result.issues).toEqual([])
      expect(result.importable).toBe(true)
      expect(result.discs.discs).toHaveLength(1)
      expect(result.discs.discs[0].rarity).toBe('S')
      expect(result.agents[0].observedFields).not.toContain('equippedDiscIds')
      expect(result.warnings?.some((warning) => warning.includes('A/B'))).toBe(true)
    },
  )
  it('refuses conversion when the validated public disc projection is unavailable', () => {
    publicCatalogState.unavailable = true
    try {
      const candidate = convertAssetSnapshot(fixture(), context)
      expect(candidate.importable).toBe(false)
      expect(candidate.issues[0].code).toBe('public_disc_catalog_unavailable')
    } finally {
      publicCatalogState.unavailable = false
    }
  })
  it('can review owned agents when no S discs were observed, without clearing equipment', () => {
    const input = fixture()
    input.assets.discs = []
    input.counts.discs = input.counts.s_discs = 0
    input.assets.agents[0].dressed_equips = []
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.discs.discs).toEqual([])
    expect(candidate.agents).toHaveLength(1)
    expect(candidate.agents[0].observedFields).not.toContain('equippedDiscIds')
  })
  it.skipIf(!process.env.SODA_ASSET_SNAPSHOT_VALIDATION_DIR)(
    'validates two authorized local snapshots without storing account fixtures',
    () => {
      const directory = process.env.SODA_ASSET_SNAPSHOT_VALIDATION_DIR!
      const hashes = [
        '94466965C5F24AF2360064164BA10F17C932B1DC4359FD176C2BB237A79EC8A4',
        'DBFA7610AB9788C259F32093E672A49202D36720B664E45C901C1FE2D0789702',
      ]
      for (const [index, hash] of hashes.entries()) {
        const bytes = readFileSync(
          join(directory, `cn-login-20261009-${index === 0 ? '09' : '10'}`, 'asset-snapshot.json'),
        )
        expect(createHash('sha256').update(bytes).digest('hex').toUpperCase()).toBe(hash)
        const candidate = convertAssetSnapshot(JSON.parse(bytes.toString('utf8')), {
          snapshotSha256: hash,
        })
        expect(candidate.issues).toEqual([])
        expect(candidate.importable).toBe(true)
        expect(candidate.counts).toEqual({
          discs: 374,
          sDiscs: 374,
          engines: 119,
          agents: 33,
          importableAgents: 33,
        })
        expect(candidate.discs.discs.length).toBe(374)
        expect(candidate.agents.length).toBe(33)
        expect(
          candidate.agents.find((row) => row.agentId === 'agent-nicole')?.fields.skillLevels,
        ).toEqual({ basic: 11, dodge: 11, assist: 15, special: 15, chain: 15, core: 7 })
        expect(
          candidate.agents.find((row) => row.agentId === 'agent-koleda')?.fields,
        ).toMatchObject({
          level: 60,
          ascension: 5,
          mindscape: 0,
          skillLevels: { basic: 11, dodge: 11, assist: 11, special: 11, chain: 11, core: 7 },
        })
      }
    },
  )
  it('keeps lightweight identities exactly aligned with canonical catalogs', () => {
    expect(identities.agents).toEqual([
      ...agentCatalog.map((row) => ({ gameId: row[3], id: row[0], name: row[1] })),
      ...currentReleasedIdentityMap.entries
        .filter((row) => row.stableId.startsWith('agent-'))
        .map((row) => ({ gameId: row.gameEvidenceId, id: row.stableId, name: row.playerName })),
    ])
    expect(identities.discs).toEqual(
      discCatalog.items.map((row) => ({ gameId: row.gameId, id: row.stableId })),
    )
    expect(identities.engines).toEqual(
      engineCatalog.items.map((row) => ({
        gameId: row.gameId,
        id: row.stableId,
        name: row.playerName,
      })),
    )
  })
  it('converts percent rolls and equipped details without exporting inventory or completeness authority', () => {
    const candidate = convertAssetSnapshot(fixture(), context)
    expect(candidate.issues).toEqual([])
    expect(candidate.importable).toBe(true)
    expect(candidate.fullInventoryVerified).toBe(false)
    expect(candidate.discs.discs[0].subStats).toEqual([
      { stat: 'def_percent', value: 14.4, upgrades: 2 },
      { stat: 'crit_rate', value: 2.4, upgrades: 0 },
      { stat: 'atk_percent', value: 3, upgrades: 0 },
      { stat: 'crit_dmg', value: 14.4, upgrades: 2 },
    ])
    expect(candidate.agents[0].fields).toMatchObject({
      level: 60,
      ascension: 5,
      mindscape: 0,
      skillLevels: { basic: 11, special: 11, dodge: 11, chain: 11, assist: 11, core: 7 },
      wEngineDetails: { id: 'wengine-14110', level: 60, ascension: 5, refinement: 1 },
    })
    expect(candidate.agents[0].equippedSourceIds).toEqual(['asset-quick-read:990001'])
    expect(candidate).not.toHaveProperty('engines')
    expect(candidate.agents[0].fields).not.toHaveProperty('potentialImage')
  })
  it('applies M3 and M5 exactly once while retaining core raw1..7', () => {
    const input = fixture()
    const agent = input.assets.agents[0]
    agent.catalog_id = present(1031)
    agent.mindscape = present(6)
    agent.skills.forEach((skill) => {
      skill.level = present(
        [0, 2].includes(skill.skill_type.value ?? 0) ? 7 : skill.skill_type.value === 5 ? 7 : 11,
      )
    })
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.agents[0].fields.skillLevels).toEqual({
      basic: 11,
      dodge: 11,
      special: 15,
      chain: 15,
      assist: 15,
      core: 7,
    })
  })
  it('supports confirmed zero-level S discs but does not invent omitted engine progression or clear equipment', () => {
    const input = fixture()
    const disc = input.assets.discs[0]
    Object.assign(disc, {
      level: omitted(),
      catalog_id: present(31642),
      main_stat: stat(12103, 79),
      substats: [stat(20103, 240), stat(12102, 300), stat(13102, 480)],
    })
    input.assets.agents[0].dressed_equips = []
    input.assets.agents[0].weapon_uid = omitted()
    Object.assign(input.assets.engines[0], { level: omitted(), modification: omitted() })
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.discs.discs[0].level).toBe(0)
    expect(candidate.agents[0].fields).not.toHaveProperty('wEngineDetails')
    expect(candidate.agents[0].observedFields).not.toContain('equippedDiscIds')
  })
  it('preserves identical-property physical copies with different UIDs', () => {
    const input = fixture()
    input.assets.discs.push({ ...structuredClone(input.assets.discs[0]), uid: present(990002) })
    input.counts.discs = input.counts.s_discs = 2
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.discs.discs.map((row) => row.sourceId)).toEqual([
      'asset-quick-read:990001',
      'asset-quick-read:990002',
    ])
  })
  it('resolves a complete known engine with omitted base progression using the locked protocol default', () => {
    const input = fixture()
    Object.assign(input.assets.engines[0], { level: omitted(), modification: omitted() })
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.warnings?.some((warning) => warning.includes('等级或突破未读到'))).toBe(false)
    expect(candidate.agents[0].fields.wEngineDetails?.level).toBe(0)
    expect(candidate.agents[0].fields.wEngineDetails?.ascension).toBe(0)
    expect(candidate.agents[0].observedFields).toContain('wEngineDetails.level')
    expect(candidate.agents[0].observedFields).toContain('wEngineDetails.ascension')
    expect(candidate.agents[0].observedFields).toContain('wEngineDetails.refinement')
  })
  it.each(['missing-phase', 'invalid-level', 'incompatible-pair'])(
    'does not manufacture default progression for %s',
    (failure) => {
      const input = fixture()
      Object.assign(input.assets.engines[0], { level: omitted(), modification: omitted() })
      if (failure === 'missing-phase') Object.assign(input.assets.engines[0], { phase: omitted() })
      if (failure === 'invalid-level')
        Object.assign(input.assets.engines[0], { level: { presence: 'invalid', value: null } })
      if (failure === 'incompatible-pair')
        Object.assign(input.assets.engines[0], { modification: present(5) })
      const candidate = convertAssetSnapshot(input, context)
      expect(candidate.importable).toBe(true)
      expect(candidate.agents[0].observedFields).not.toContain('wEngineDetails.level')
      expect(candidate.agents[0].fields.wEngineDetails?.level).toBeNull()
    },
  )
  it('keeps missing agent growth and individual skills unobserved while importing discs', () => {
    const input = fixture()
    const agent = input.assets.agents[0]
    Object.assign(agent, { level: omitted(), promotion: omitted() })
    agent.skills = agent.skills.filter((skill) => skill.skill_type.value !== 1)
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.discs.discs).toHaveLength(1)
    expect(candidate.agents[0].observedFields).not.toContain('level')
    expect(candidate.agents[0].observedFields).not.toContain('ascension')
    expect(candidate.agents[0].observedFields).not.toContain('skillLevels.special')
    expect(candidate.agents[0].observedFields).toContain('skillLevels.basic')
    expect(candidate.agents[0].observedFields).toContain('wEngineDetails.id')
  })
  it('does not adopt an ambiguous skill or partial equipment relationship', () => {
    const input = fixture()
    input.assets.agents[0].skills[0].skill_type = present(5)
    input.assets.agents[0].dressed_equips.push({ uid: present(999999), slot: present(2) })
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.agents[0].observedFields).not.toContain('skillLevels.core')
    expect(candidate.agents[0].observedFields).not.toContain('equippedDiscIds')
    expect(candidate.agents[0].equippedSourceIds).toEqual([])
  })
  it.each(['engine', 'agent'] as const)(
    'quarantines %s decoding issues without blocking S discs',
    (asset) => {
      const input = fixture()
      input.issues.push({ code: 'wrong_wire_type', asset, field: 'level' })
      Object.assign(input.assets[asset === 'engine' ? 'engines' : 'agents'][0], {
        level: { presence: 'invalid', value: null },
      })
      const candidate = convertAssetSnapshot(input, context)
      expect(candidate.importable).toBe(true)
      expect(candidate.discs.discs).toHaveLength(1)
      if (asset === 'agent') expect(candidate.agents).toEqual([])
      else expect(candidate.agents[0].observedFields).not.toContain('wEngineDetails.id')
    },
  )
  it('still blocks invalid disc decoding instead of inventing level zero', () => {
    const input = fixture()
    Object.assign(input.assets.discs[0], { level: { presence: 'invalid', value: null } })
    input.issues.push({ code: 'wrong_wire_type', asset: 'disc', field: 'level' })
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(false)
    expect(candidate.discs.discs).toEqual([])
  })
  it.each(['engines', 'agents'] as const)(
    'does not trust inconsistent optional %s counts',
    (kind) => {
      const input = fixture()
      input.counts[kind]++
      const candidate = convertAssetSnapshot(input, context)
      expect(candidate.importable).toBe(true)
      expect(candidate.discs.discs).toHaveLength(1)
      if (kind === 'agents') expect(candidate.agents).toEqual([])
      else expect(candidate.agents[0].fields).not.toHaveProperty('wEngineDetails')
    },
  )
  it('recognizes every released engine model and agent identity, independently of growth', () => {
    for (const engine of identities.engines) {
      const input = fixture()
      Object.assign(input.assets.engines[0], {
        catalog_id: present(Number(engine.gameId)),
        level: omitted(),
        modification: omitted(),
      })
      const candidate = convertAssetSnapshot(input, context)
      expect(candidate.importable, engine.id).toBe(true)
      expect(candidate.agents[0].fields.wEngineDetails?.id, engine.id).toBe(engine.id)
      expect(candidate.agents[0].observedFields).toContain('wEngineDetails.level')
      expect(candidate.agents[0].fields.wEngineDetails?.level).toBe(0)
    }
    for (const agent of identities.agents) {
      const input = fixture()
      Object.assign(input.assets.agents[0], {
        catalog_id: present(Number(agent.gameId)),
        level: omitted(),
        promotion: omitted(),
        skills: [],
      })
      const candidate = convertAssetSnapshot(input, context)
      expect(candidate.importable, agent.id).toBe(true)
      expect(candidate.agents[0].agentId, agent.id).toBe(agent.id)
      expect(candidate.agents[0].observedFields).toContain('owned')
    }
  })
  it('covers every released S set, slot and legal main stat with actual formula values', () => {
    const keys: Record<string, [number, number]> = {
      hp_percent: [11102, 100],
      hp_flat: [11103, 1],
      atk_percent: [12102, 100],
      atk_flat: [12103, 1],
      impact: [12202, 100],
      def_percent: [13102, 100],
      def_flat: [13103, 1],
      crit_rate: [20103, 100],
      crit_dmg: [21103, 100],
      pen_ratio: [23103, 100],
      pen: [23203, 1],
      energy_regen: [30502, 100],
      anomaly_proficiency: [31203, 1],
      anomaly_mastery: [31402, 100],
      physical_dmg: [31503, 100],
      fire_dmg: [31603, 100],
      ice_dmg: [31703, 100],
      electric_dmg: [31803, 100],
      ether_dmg: [31903, 100],
      wind_dmg: [32303, 100],
    }
    const input = fixture()
    input.assets.discs = []
    input.assets.agents[0].dressed_equips = []
    for (const set of identities.discs) {
      for (const [slot, mains] of Object.entries(rawDiscData.rules.mainStatsBySlot)) {
        for (const main of mains) {
          const [mainKey, scale] = keys[main]
          const base = rawDiscData.rules.mainStatBaseByRarity.S.find(
            (row) => row.stat === main,
          )!.baseValue
          const subs = rawDiscData.rules.subStatStepsByRarity.S.filter(
            (row) => row.stat !== main,
          ).slice(0, 3)
          input.assets.discs.push({
            uid: present(900000 + input.assets.discs.length),
            catalog_id: present(Number(set.gameId) + 40 + Number(slot)),
            level: present(0),
            main_stat: stat(mainKey, base * scale),
            substats: subs.map((row) => stat(keys[row.stat][0], row.baseValue * keys[row.stat][1])),
          })
        }
      }
    }
    input.counts.discs = input.counts.s_discs = input.assets.discs.length
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.issues).toEqual([])
    expect(candidate.importable).toBe(true)
    expect(candidate.discs.discs).toHaveLength(input.assets.discs.length)
    expect(new Set(candidate.discs.discs.map((disc) => disc.setId)).size).toBe(
      identities.discs.length,
    )
  })
  it.each([
    [
      'duplicate UID',
      (input: ReturnType<typeof fixture>) => {
        input.assets.discs.push(structuredClone(input.assets.discs[0]))
        input.counts.discs = input.counts.s_discs = 2
      },
      'duplicate_uid',
    ],
    [
      'unknown disc',
      (input: ReturnType<typeof fixture>) => {
        input.assets.discs[0].catalog_id = present(99941)
      },
      'unknown_disc_catalog',
    ],
    [
      'wrong main',
      (input: ReturnType<typeof fixture>) => {
        input.assets.discs[0].main_stat.base_value = present(2200)
      },
      'invalid_main_stat_value',
    ],
    [
      'bad roll',
      (input: ReturnType<typeof fixture>) => {
        input.assets.discs[0].substats[0].add_value = present(0)
      },
      'invalid_substat',
    ],
    [
      'counts',
      (input: ReturnType<typeof fixture>) => {
        input.counts.discs++
      },
      'count_mismatch',
    ],
    [
      'wrong response',
      (input: ReturnType<typeof fixture>) => {
        input.response_observations[0].command_id = 1382
      },
      'invalid_response_observation',
    ],
  ])('blocks unsafe disc/transport input: %s', (_name, mutate, code) => {
    const input = fixture()
    mutate(input)
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(false)
    expect(candidate.issues.some((row) => row.code === code)).toBe(true)
  })
  it.each([
    [
      'unknown agent',
      (input: ReturnType<typeof fixture>) => {
        input.assets.agents[0].catalog_id = present(999999)
      },
      'unknown_agent_catalog',
    ],
    [
      'unknown engine',
      (input: ReturnType<typeof fixture>) => {
        input.assets.engines[0].catalog_id = present(999999)
      },
      'unknown_engine_catalog',
    ],
    [
      'engine phase range',
      (input: ReturnType<typeof fixture>) => {
        input.assets.engines[0].phase = present(6)
      },
      'invalid_asset_field',
    ],
    [
      'missing ref',
      (input: ReturnType<typeof fixture>) => {
        input.assets.agents[0].dressed_equips[0].uid = present(999999)
      },
      'invalid_equipped_disc_reference',
    ],
    [
      'duplicate ref',
      (input: ReturnType<typeof fixture>) => {
        input.assets.agents[0].dressed_equips.push(
          structuredClone(input.assets.agents[0].dressed_equips[0]),
        )
      },
      'invalid_equipped_disc_reference',
    ],
    [
      'wrong skill enum',
      (input: ReturnType<typeof fixture>) => {
        input.assets.agents[0].skills[0].skill_type = present(4)
      },
      'invalid_skill_type',
    ],
    [
      'duplicate skill',
      (input: ReturnType<typeof fixture>) => {
        input.assets.agents[0].skills[0].skill_type = present(5)
      },
      'invalid_skill_type',
    ],
    [
      'decoder issue',
      (input: ReturnType<typeof fixture>) => {
        input.issues.push({ code: 'decode_failure', asset: 'agent', field: 'level' })
      },
      'native_decode_issues',
    ],
  ])('keeps valid discs importable with optional problem: %s', (_name, mutate) => {
    const input = fixture()
    mutate(input)
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.issues).toEqual([])
    expect(candidate.discs.discs).toHaveLength(1)
    expect(candidate.warnings?.length).toBeGreaterThan(1)
  })
  it.each([
    [
      'protocol',
      (input: ReturnType<typeof fixture>) => {
        input.source.protocol_version = '3.3'
      },
    ],
    [
      'region',
      (input: ReturnType<typeof fixture>) => {
        input.source.requested_game_region = 'GLOBAL'
      },
    ],
    [
      'mode',
      (input: ReturnType<typeof fixture>) => {
        input.source.mode = 'replay'
      },
    ],
    [
      'coverage',
      (input: ReturnType<typeof fixture>) => {
        input.coverage.agent_load_received = false
      },
    ],
    [
      'decoded',
      (input: ReturnType<typeof fixture>) => {
        input.counters.decoded_messages = 2
      },
    ],
    [
      'fractional',
      (input: ReturnType<typeof fixture>) => {
        input.assets.agents[0].level = present(2.5)
      },
    ],
    [
      'negative',
      (input: ReturnType<typeof fixture>) => {
        input.assets.discs[0].uid = present(-1)
      },
    ],
    [
      'capture mutation',
      (input: ReturnType<typeof fixture>) => {
        input.account_write_enabled = true
      },
    ],
  ])('rejects invalid %s contract', (_name, mutate) => {
    const input = fixture()
    mutate(input)
    expect(convertAssetSnapshot(input, context).issues[0].code).toBe('invalid_snapshot')
  })
  it('strips unknown fields and excludes transport/security data from issues and candidate', () => {
    const input = {
      ...fixture(),
      security_secret: ['must', 'not', 'escape'].join('-'),
      raw_body: 'must-not-escape',
    }
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(JSON.stringify(candidate)).not.toContain('must-not-escape')
    expect(convertAssetSnapshot(input, { ...context, capturedAt: 'wrong' }).importable).toBe(false)
    expect(convertAssetSnapshot(input, { snapshotSha256: 'wrong' }).importable).toBe(false)
    expect(convertAssetSnapshot(null, context).importable).toBe(false)
  })
})
