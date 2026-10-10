import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { convertAssetSnapshot } from './snapshotAdapter'
import identities from './catalogIdentityProjection.json'
import discCatalog from '../gameDataPacks/generated/current-drive-disc-formula-catalog.v1.json'
import engineCatalog from '../gameDataPacks/generated/current-wengine-static-catalog.v1.json'
import { agentCatalog } from '../assault/catalogData'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'

const present = (value: number) => ({ presence: 'present' as const, value })
const omitted = () => ({ presence: 'omitted' as const, value: null })
const stat = (key: number, base: number, add = 1) => ({
  key: present(key),
  base_value: present(base),
  add_value: present(add),
})
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

/** Entirely synthetic entities; never copies a player's account or physical UID. */
function fixture() {
  return {
    schema: 'soda-asset-snapshot-probe/v1',
    status: 'response_semantics_unverified',
    source: {
      upstream_commit: '4853f07c8fb5322c12b9b580d6364b577c2ac96a',
      protocol_version: '3.2',
      requested_game_region: 'CN',
      mode: 'live_copy_only_client_cn_configuration_candidate',
      capture_started_unix_seconds: 1791564061,
    },
    coverage: { disc_load_received: true, engine_load_received: true, agent_load_received: true },
    counts: {
      discs: 1,
      s_discs: 1,
      a_discs: 0,
      b_discs: 0,
      unknown_rarity_discs: 0,
      engines: 1,
      agents: 1,
    },
    counters: { decoded_messages: 3 },
    response_observations: (['discs', 'engines', 'agents'] as const).map((kind) => ({
      kind,
      command_id: { discs: 3933, engines: 1382, agents: 2470 }[kind],
      status_field: kind === 'agents' ? 8 : 12,
      status_value: null as number | null,
      status_presence: 'omitted',
      assessment: 'omitted_semantics_unverified',
      status_semantics_verified: false,
    })),
    issues: [] as { code: string; asset: string; field: string }[],
    independent_inventory_total_verified: false,
    full_inventory_verified: false,
    ready_for_account_import: false,
    account_write_enabled: false,
    raw_traffic_saved: false,
    response_status_semantics_verified: false,
    assets: {
      discs: [
        {
          uid: present(990001),
          catalog_id: present(31041),
          level: present(15),
          main_stat: stat(11103, 550),
          substats: [stat(13102, 480, 3), stat(20103, 240), stat(12102, 300), stat(21103, 480, 3)],
        },
      ],
      engines: [
        {
          uid: present(990101),
          catalog_id: present(14110),
          level: present(60),
          phase: present(1),
          modification: present(5),
        },
      ],
      agents: [
        {
          catalog_id: present(1101),
          level: present(60),
          promotion: present(6),
          mindscape: omitted() as ReturnType<typeof present> | ReturnType<typeof omitted>,
          weapon_uid: present(990101) as ReturnType<typeof present> | ReturnType<typeof omitted>,
          skills: [6, 5, 3, 2, 1, 0].map((type) => ({
            skill_type: type === 0 ? omitted() : present(type),
            level: present(type === 5 ? 7 : 11),
          })),
          dressed_equips: [{ uid: present(990001), slot: present(1) }],
        },
      ],
    },
  }
}

describe('asset snapshot local candidate adapter', () => {
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
  it('reports equipped engine omitted progression without provenance or zero inference', () => {
    const input = fixture()
    Object.assign(input.assets.engines[0], { level: omitted(), modification: omitted() })
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(true)
    expect(candidate.warnings?.[0]).toContain('1件')
    expect(candidate.agents[0].fields.wEngineDetails?.level).toBeNull()
    expect(candidate.agents[0].observedFields).not.toContain('wEngineDetails.level')
    expect(candidate.agents[0].observedFields).not.toContain('wEngineDetails.ascension')
    expect(candidate.agents[0].observedFields).toContain('wEngineDetails.refinement')
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
    [
      'wrong response',
      (input: ReturnType<typeof fixture>) => {
        input.response_observations[0].command_id = 1382
      },
      'invalid_response_observation',
    ],
  ])('blocks %s', (_name, mutate, code) => {
    const input = fixture()
    mutate(input)
    const candidate = convertAssetSnapshot(input, context)
    expect(candidate.importable).toBe(false)
    expect(candidate.issues.some((row) => row.code === code)).toBe(true)
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
