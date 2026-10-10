import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountDriveDisc } from '../accounts/types'
import type { RosterAgent } from '../assault/types'
import { createEmptyRoster, hydrateRosterDefaults } from '../accounts/rosterHydration'
import { SodaDatabase } from '../db/databaseCore'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  readLatestAssetQuickReadRecovery,
  restoreAssetQuickReadImport,
} from './accountImport'
import type { AssetQuickReadCandidate } from './snapshotAdapter'

const accountId = 'account-synthetic-alpha'
const otherAccountId = 'account-synthetic-beta'
const now = '2026-10-10T00:00:00.000Z'
const earlier = '2026-10-09T00:00:00.000Z'
const agentId = 'agent-nicole'

/** Entirely invented observation, with catalog identity only from the public current catalog. */
function candidate(): AssetQuickReadCandidate {
  return {
    capturedAt: now,
    snapshotSha256: 'a'.repeat(64),
    protocolVersion: '3.2',
    fullInventoryVerified: false,
    counts: { discs: 1, sDiscs: 1, engines: 1, agents: 1, importableAgents: 1 },
    importable: true,
    issues: [],
    warnings: [],
    discs: {
      format: 'soda-terminal-drive-disc-import',
      formatVersion: 1,
      source: { adapter: 'asset-quick-read', capturedAt: now },
      batch: {},
      discs: [
        {
          setId: 'set-woodpecker-electro',
          slot: 1,
          level: 0,
          rarity: 'S',
          mainStat: 'hp_flat',
          subStats: [
            { stat: 'crit_rate', value: 2.4, upgrades: 0 },
            { stat: 'atk_percent', value: 3, upgrades: 0 },
            { stat: 'def_percent', value: 4.8, upgrades: 0 },
          ],
          locked: false,
          sourceId: 'asset-quick-read:880001',
        },
      ],
    },
    agents: [
      {
        agentId,
        name: '妮可',
        fields: {
          owned: true,
          level: 20,
          ascension: 1,
          mindscape: 0,
          skillLevels: { basic: 3, dodge: 3, assist: 4, special: 4, chain: 4, core: 2 },
          wEngineDetails: { id: 'wengine-13001', name: '聚宝箱', level: null, refinement: 1 },
        },
        observedFields: [
          'owned',
          'level',
          'ascension',
          'mindscape',
          'skillLevels.basic',
          'skillLevels.dodge',
          'skillLevels.assist',
          'skillLevels.special',
          'skillLevels.chain',
          'skillLevels.core',
          'wEngineDetails.id',
          'wEngineDetails.name',
          'wEngineDetails.refinement',
          'equippedDiscIds',
        ],
        equippedSourceIds: ['asset-quick-read:880001'],
      },
    ],
  }
}

function storedDisc(id: string, source: string, scope = accountId): AccountDriveDisc {
  const incoming = candidate().discs.discs[0]
  return {
    id,
    scopedId: `${scope}:${id}`,
    accountId: scope,
    sourceLegacyId: 'synthetic-legacy',
    migratedAt: earlier,
    setId: incoming.setId!,
    slot: incoming.slot,
    level: incoming.level,
    rarity: 'S',
    mainStat: 'hp_flat',
    subStats: incoming.subStats.map((row) => ({
      ...row,
      stat: row.stat as 'crit_rate' | 'atk_percent' | 'def_percent',
    })),
    locked: true,
    favorite: true,
    tags: ['保留'],
    createdAt: earlier,
    updatedAt: earlier,
    dataVersion: 'synthetic-version',
    discVersion: `old-${id}`,
    importSource: {
      adapter: source.startsWith('asset-quick-read:') ? 'asset-quick-read' : 'synthetic-scanner',
      sourceId: source,
      capturedAt: earlier,
    },
  }
}

describe('asset quick read isolated account transactions', () => {
  let db: SodaDatabase
  beforeEach(async () => {
    db = new SodaDatabase(`asset-quick-read-test-${crypto.randomUUID()}`)
    await db.open()
    await db.accounts.bulkPut(
      [accountId, otherAccountId].map((id) => ({
        id,
        displayName: '合成测试账户',
        createdAt: earlier,
        updatedAt: earlier,
        isDefault: false,
        status: 'active' as const,
        source: 'manual' as const,
      })),
    )
    await db.settings.put({ key: 'active-account-id', value: accountId })
    await db.accountDriveDiscs.put(
      storedDisc('unrelated-physical-disc', 'asset-quick-read:889999', otherAccountId),
    )
    const roster = createEmptyRoster(earlier)
    await db.accountRosters.put({ accountId, roster, updatedAt: earlier, source: 'manual' })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    db.close()
    // The only deleted database is the uniquely created synthetic test database.
    expect(db.name.startsWith('asset-quick-read-test-')).toBe(true)
    await Dexie.delete(db.name)
  })
  async function facts() {
    return {
      accounts: await db.accounts.toArray(),
      settings: await db.settings.toArray(),
      discs: await db.accountDriveDiscs.toArray(),
      rosters: await db.accountRosters.toArray(),
      preferences: await db.accountPreferences.toArray(),
    }
  }
  async function agent() {
    return (await db.accountRosters.get(accountId))!.roster.agents.find(
      (row) => row.agentId === agentId,
    )!
  }
  async function patchAgent(patch: Partial<RosterAgent>) {
    const record = (await db.accountRosters.get(accountId))!
    const existing = record.roster.agents.find((row) => row.agentId === agentId)!
    Object.assign(existing, patch)
    await db.accountRosters.put(record)
    return structuredClone(existing)
  }
  async function apply(input = candidate()) {
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    return confirmAssetQuickReadImport(
      input,
      plan,
      { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
      db,
    )
  }

  it('prepares a usable plan without any database writes or recovery side effects', async () => {
    const before = await facts()
    const plan = await prepareAssetQuickReadImport(accountId, candidate(), db)
    expect(plan.importable).toBe(true)
    expect(plan.summary).toMatchObject({ newDiscs: 1, observedAgents: 1 })
    expect(await facts()).toEqual(before)
  })
  it('guards missing, archived and inactive target scopes before preparing', async () => {
    await expect(
      prepareAssetQuickReadImport('account-synthetic-missing', candidate(), db),
    ).rejects.toThrow('已不存在')
    await db.accounts.update(accountId, { status: 'archived' })
    await expect(prepareAssetQuickReadImport(accountId, candidate(), db)).rejects.toThrow('已归档')
    await db.accounts.update(accountId, { status: 'active' })
    await db.settings.put({ key: 'active-account-id', value: otherAccountId })
    const before = await facts()
    await expect(prepareAssetQuickReadImport(accountId, candidate(), db)).rejects.toThrow(
      '活动账号已变化',
    )
    expect(await facts()).toEqual(before)
  })
  it('rechecks active account at confirmation and never touches the other account', async () => {
    const input = candidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    await db.settings.put({ key: 'active-account-id', value: otherAccountId })
    const before = await facts()
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
        db,
      ),
    ).rejects.toThrow('活动账号已变化')
    expect(await facts()).toEqual(before)
  })
  it('imports precise owned A-rank M0 and survives roster hydration without default M6', async () => {
    const unrelated = await db.accountDriveDiscs.where('accountId').equals(otherAccountId).toArray()
    await apply()
    const imported = await agent()
    expect(imported.mindscape).toBe(0)
    expect(imported.skillLevels.basic).toBe(3)
    expect(imported.observedFacts?.fields.mindscape).toEqual({
      capturedAt: now,
      snapshotSha256: 'a'.repeat(64),
    })
    const hydrated = hydrateRosterDefaults(
      (await db.accountRosters.get(accountId))!.roster,
    ).agents.find((row) => row.agentId === agentId)!
    expect(hydrated.mindscape).toBe(0)
    expect(hydrated.skillLevels).toEqual(imported.skillLevels)
    expect(await db.accountDriveDiscs.where('accountId').equals(otherAccountId).toArray()).toEqual(
      unrelated,
    )
  })
  it('preserves manual_override fields without acquiring new observation provenance', async () => {
    const before = await patchAgent({
      owned: true,
      manualSource: 'manual_override',
      level: 40,
      ascension: 3,
      mindscape: 2,
      skills: '用户技能说明',
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
      wEngine: '用户已录入音擎',
      wEngineDetails: {
        id: 'wengine-13002',
        name: '用户已录入音擎',
        level: 40,
        ascension: 3,
        refinement: 3,
      },
      refinement: 3,
    })
    const imported = await apply()
    expect(imported.protectedFields).toBe(candidate().agents[0].observedFields.length)
    expect(await agent()).toEqual(before)
  })
  it('protects deliberate progression while allowing independently observed engine fields', async () => {
    await patchAgent({
      owned: true,
      progressionManuallySet: true,
      level: 40,
      ascension: 3,
      mindscape: 2,
      skills: '用户技能说明',
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    await apply()
    const imported = await agent()
    expect(imported).toMatchObject({
      level: 40,
      ascension: 3,
      mindscape: 2,
      skills: '用户技能说明',
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    expect(imported.observedFacts?.fields.level).toBeUndefined()
    expect(imported.observedFacts?.fields['wEngineDetails.name']).toBeDefined()
  })
  it('protects parent and exact locked fields independently', async () => {
    await patchAgent({
      owned: true,
      level: 40,
      mindscape: 2,
      skills: '用户锁定技能',
      lockedFields: ['level', 'mindscape', 'skillLevels', 'wEngine'],
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    await apply()
    const imported = await agent()
    expect(imported).toMatchObject({
      level: 40,
      mindscape: 2,
      skills: '用户锁定技能',
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    expect(imported.observedFacts?.fields.level).toBeUndefined()
    expect(imported.observedFacts?.fields['wEngineDetails.id']).toBeUndefined()
  })
  it('keeps identical-property physical copies and matched legacy metadata', async () => {
    await db.accountDriveDiscs.bulkPut([
      storedDisc('local-a', 'scanner:synthetic-a'),
      { ...storedDisc('local-b', 'scanner:synthetic-b'), favorite: false, tags: ['测试'] },
    ])
    const input = candidate()
    input.discs.discs.push({
      ...structuredClone(input.discs.discs[0]),
      sourceId: 'asset-quick-read:880002',
    })
    input.counts.discs = input.counts.sDiscs = 2
    const result = await apply(input)
    expect(result).toMatchObject({
      totalDiscs: 2,
      newDiscs: 0,
      updatedDiscs: 2,
      inferredDiscLinks: 2,
    })
    const discs = await db.accountDriveDiscs.where('accountId').equals(accountId).sortBy('id')
    expect(discs.map((row) => row.id)).toEqual(['local-a', 'local-b'])
    expect(
      discs.map((row) => ({
        favorite: row.favorite,
        tags: row.tags,
        createdAt: row.createdAt,
        sourceLegacyId: row.sourceLegacyId,
      })),
    ).toEqual([
      { favorite: true, tags: ['保留'], createdAt: earlier, sourceLegacyId: 'synthetic-legacy' },
      { favorite: false, tags: ['测试'], createdAt: earlier, sourceLegacyId: 'synthetic-legacy' },
    ])
    expect(new Set(discs.map((row) => row.importSource?.sourceId)).size).toBe(2)
  })
  it('keeps the local ID and metadata when a stable UID is upgraded', async () => {
    await db.accountDriveDiscs.put(storedDisc('my-retained-local-id', 'asset-quick-read:880001'))
    const input = candidate()
    input.discs.discs[0].level = 15
    input.discs.discs[0].subStats.push({ stat: 'crit_dmg', value: 9.6, upgrades: 1 })
    const result = await apply(input)
    expect(result).toMatchObject({ newDiscs: 0, updatedDiscs: 1, totalDiscs: 1 })
    const disc = (await db.accountDriveDiscs.where('accountId').equals(accountId).toArray())[0]
    expect(disc).toMatchObject({
      id: 'my-retained-local-id',
      level: 15,
      locked: true,
      favorite: true,
      tags: ['保留'],
    })
    expect(disc.discVersion).not.toBe('old-my-retained-local-id')
    expect((await agent()).equippedDiscIds).toEqual(['my-retained-local-id'])
  })
  it('rejects an older observation that would downgrade the same physical disc without any writes', async () => {
    const saved = storedDisc('newer-observation', 'asset-quick-read:880001')
    saved.level = 15
    saved.importSource!.capturedAt = '2026-10-11T00:00:00.000Z'
    saved.updatedAt = saved.importSource!.capturedAt
    await db.accountDriveDiscs.put(saved)
    const before = await facts()
    await expect(apply()).rejects.toThrow('早于或冲突')
    expect(await facts()).toEqual(before)
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toBeNull()
  })
  it('keeps the provenance and metadata of an identical newer disc while linking equipment', async () => {
    const saved = storedDisc('newer-observation', 'asset-quick-read:880001')
    saved.importSource!.capturedAt = '2026-10-11T00:00:00.000Z'
    saved.updatedAt = saved.importSource!.capturedAt
    await db.accountDriveDiscs.put(saved)
    await apply()
    expect(await db.accountDriveDiscs.get(saved.scopedId)).toEqual(saved)
    expect((await agent()).equippedDiscIds).toEqual([saved.id])
  })
  it('accepts a newer observation after metadata edits without rewinding the edit timestamp', async () => {
    const saved = storedDisc('metadata-edited', 'asset-quick-read:880001')
    saved.updatedAt = '2026-10-11T00:00:00.000Z'
    await db.accountDriveDiscs.put(saved)
    const input = candidate()
    input.discs.discs[0].level = 15
    input.discs.discs[0].subStats.push({ stat: 'crit_dmg', value: 9.6, upgrades: 1 })
    await apply(input)
    expect(await db.accountDriveDiscs.get(saved.scopedId)).toMatchObject({
      level: 15,
      updatedAt: saved.updatedAt,
      favorite: true,
      tags: ['保留'],
      importSource: { capturedAt: now },
    })
  })
  it('adds a distinct UID even when an unobserved prior quick-read disc has identical properties', async () => {
    const preserved = storedDisc('existing-distinct-uid', 'asset-quick-read:880555')
    await db.accountDriveDiscs.put(preserved)
    const result = await apply()
    expect(result).toMatchObject({ newDiscs: 1, updatedDiscs: 0, retainedDiscs: 1, totalDiscs: 2 })
    expect(await db.accountDriveDiscs.get(preserved.scopedId)).toEqual(preserved)
    const sources = (await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()).map(
      (row) => row.importSource?.sourceId,
    )
    expect(new Set(sources).size).toBe(2)
  })
  it('rejects stale plans, mutated candidates and wrong confirmation digest without writes', async () => {
    const input = candidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    const confirmation = {
      accountId,
      snapshotSha256: input.snapshotSha256,
      sameGameAccountAndCounts: true as const,
    }
    let before = await facts()
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { ...confirmation, snapshotSha256: 'b'.repeat(64) },
        db,
      ),
    ).rejects.toThrow('快照已变化')
    await expect(
      confirmAssetQuickReadImport(
        { ...input, capturedAt: '2026-10-11T00:00:00.000Z' },
        plan,
        confirmation,
        db,
      ),
    ).rejects.toThrow('快照已变化')
    expect(await facts()).toEqual(before)
    await patchAgent({ priority: 1 })
    before = await facts()
    await expect(confirmAssetQuickReadImport(input, plan, confirmation, db)).rejects.toThrow(
      '检查后发生了变化',
    )
    expect(await facts()).toEqual(before)
  })
  it('rolls back discs, roster and recovery together when the commit boundary fails', async () => {
    const input = candidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    const before = await facts()
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
        db,
        () => {
          throw new Error('synthetic transaction failure')
        },
      ),
    ).rejects.toThrow('synthetic transaction failure')
    expect(await facts()).toEqual(before)
    expect(await db.accountPreferences.count()).toBe(0)
  })
  it('explicit restore returns account assets and roster exactly while retaining the recovery record', async () => {
    await db.accountDriveDiscs.put(storedDisc('existing-before', 'asset-quick-read:880001'))
    const before = await facts()
    const result = await apply()
    expect(await db.accountPreferences.count()).toBe(1)
    await restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db)
    const restored = await facts()
    expect(restored.discs).toEqual(before.discs)
    expect(restored.rosters).toEqual(before.rosters)
    expect(restored.accounts).toEqual(before.accounts)
    expect(restored.settings).toEqual(before.settings)
    expect(restored.preferences).toHaveLength(1)
  })
  it('requires the explicit restore confirmation and refuses duplicate snapshot imports', async () => {
    const input = candidate()
    const result = await apply(input)
    const after = await facts()
    await expect(
      restoreAssetQuickReadImport(
        accountId,
        result.recoveryKey,
        'wrong' as 'restore_asset_quick_read',
        db,
      ),
    ).rejects.toThrow('明确确认')
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
        db,
      ),
    ).rejects.toThrow('已导入')
    expect(await facts()).toEqual(after)
  })
  it('refuses a changed recovery payload without affecting current assets', async () => {
    const result = await apply()
    const key = `${accountId}:${result.recoveryKey}`
    const record = (await db.accountPreferences.get(key))!
    const changed = structuredClone(record.value) as {
      before: { discs: AccountDriveDisc[] }
      beforeHash: string
    }
    changed.beforeHash = 'changed-synthetic-recovery-digest'
    await db.accountPreferences.update(key, { value: changed })
    const after = await facts()
    await expect(
      restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('恢复副本不可用')
    expect(await facts()).toEqual(after)
  })
  it('restores a formerly absent roster and deletes only discs introduced by this import', async () => {
    await db.accountRosters.delete(accountId)
    const before = await facts()
    const result = await apply()
    await restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db)
    expect((await facts()).discs).toEqual(before.discs)
    expect(await db.accountRosters.get(accountId)).toBeUndefined()
  })
  it('rejects restoration after later player edits without covering those edits', async () => {
    const result = await apply()
    await patchAgent({ priority: 1 })
    const edited = await facts()
    await expect(
      restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('已有其他修改')
    expect(await facts()).toEqual(edited)
  })
  it('rolls back partial restore writes after an injected roster write failure', async () => {
    await db.accountDriveDiscs.put(storedDisc('existing-before', 'asset-quick-read:880001'))
    const result = await apply()
    const after = await facts()
    vi.spyOn(db.accountRosters, 'put').mockRejectedValueOnce(
      new Error('synthetic restore write failure'),
    )
    await expect(
      restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('synthetic restore write failure')
    expect(await facts()).toEqual(after)
  })
  it('does not mark unobserved equipped engine level or ascension or overwrite stored values', async () => {
    await patchAgent({
      wEngineDetails: {
        id: 'wengine-13002',
        name: '原音擎',
        level: 40,
        ascension: 3,
        refinement: 2,
      },
    })
    await apply()
    const imported = await agent()
    expect(imported.wEngineDetails).toMatchObject({
      id: 'wengine-13001',
      level: 40,
      ascension: 3,
      refinement: 1,
    })
    expect(imported.observedFacts?.fields['wEngineDetails.level']).toBeUndefined()
    expect(imported.observedFacts?.fields['wEngineDetails.ascension']).toBeUndefined()
  })
  it('rediscovers a committed recovery after reopening without modifying any account facts', async () => {
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toBeNull()
    const receipt = await apply()
    const committed = await facts()
    db.close()
    await db.open()
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
      recoveryKey: receipt.recoveryKey,
      canRestore: true,
    })
    expect(await facts()).toEqual(committed)
  })
  it('keeps the newest receipt visible as already restored instead of exposing an older undo', async () => {
    await apply()
    const later = candidate()
    later.snapshotSha256 = 'b'.repeat(64)
    later.capturedAt = '2026-10-10T00:01:00.000Z'
    later.agents[0].fields.level = 21
    const receipt = await apply(later)
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
      recoveryKey: receipt.recoveryKey,
      canRestore: true,
    })
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    const restored = await facts()
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
      recoveryKey: receipt.recoveryKey,
      canRestore: false,
      unavailableReason: expect.stringContaining('已恢复'),
    })
    expect(await facts()).toEqual(restored)
  })
  it('rediscovers a retained copy but disables undo after subsequent player edits', async () => {
    const receipt = await apply()
    await patchAgent({ level: 31 })
    const edited = await facts()
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
      recoveryKey: receipt.recoveryKey,
      canRestore: false,
      unavailableReason: expect.stringContaining('其他修改'),
    })
    expect(await facts()).toEqual(edited)
  })
  it('does not offer a corrupt or foreign-account recovery and checks the active account', async () => {
    const receipt = await apply()
    const scopedId = `${accountId}:${receipt.recoveryKey}`
    const row = (await db.accountPreferences.get(scopedId))!
    const value = row.value as { accountId: string; beforeHash: string }
    await db.accountPreferences.update(scopedId, { value: { ...value, accountId: otherAccountId } })
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toBeNull()
    await db.accountPreferences.update(scopedId, { value: { ...value, beforeHash: 'corrupt' } })
    const corrupted = await facts()
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toBeNull()
    expect(await facts()).toEqual(corrupted)
    await db.settings.put({ key: 'active-account-id', value: otherAccountId })
    await expect(readLatestAssetQuickReadRecovery(accountId, db)).rejects.toThrow()
  })
  it('imports an agent-only candidate with no S discs and keeps existing unobserved disc entities', async () => {
    await db.accountDriveDiscs.put(storedDisc('unobserved-original', 'asset-quick-read:880555'))
    const input = candidate()
    input.discs.discs = []
    input.counts.discs = input.counts.sDiscs = 0
    input.agents[0].equippedSourceIds = []
    input.agents[0].observedFields = input.agents[0].observedFields.filter(
      (field) => field !== 'equippedDiscIds',
    )
    const before = await db.accountDriveDiscs.toArray()
    const result = await apply(input)
    expect(result).toMatchObject({ newDiscs: 0, totalDiscs: 1, observedAgents: 1 })
    expect(await db.accountDriveDiscs.toArray()).toEqual(before)
    expect((await agent()).mindscape).toBe(0)
  })
})
