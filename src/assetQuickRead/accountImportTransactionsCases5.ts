import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { saveAccountRoster } from '../accounts/repository'
import { hydrateRosterDefaults } from '../accounts/rosterHydration'
import { readLatestAssetQuickReadRecovery, restoreAssetQuickReadImport } from './accountImport'
import { accountId, agentId, candidate, otherAccountId, storedDisc } from './accountImport.fixtures'
import type { AccountImportTransactionsFixture } from './accountImportTransactionsFixture'

export function registerAccountImportTransactionsCases5(fixture: AccountImportTransactionsFixture) {
  it('keeps the newest receipt visible as already restored instead of exposing an older undo', async () => {
    const { db, facts, apply } = fixture

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
    const { db, facts, patchAgent, apply } = fixture

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
    const { db, facts, apply } = fixture

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
    const { db, agent, apply } = fixture

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
  it('rejects a stale candidate conflicting with newer manual progression without any writes', async () => {
    const { db, facts, patchAgent, apply } = fixture

    await patchAgent({
      manualSource: 'manual_override',
      progressionManuallySet: true,
      owned: true,
      level: 40,
    })
    const record = (await db.accountRosters.get(accountId))!
    record.updatedAt = record.roster.updatedAt = '2026-10-10T00:01:00.000Z'
    await db.accountRosters.put(record)
    const before = await facts()
    await expect(apply()).rejects.toThrow('请重新读取')
    expect(await facts()).toEqual(before)
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toBeNull()
  })
  it('keeps newer per-field observations and explicit locks while adopting other older manual progression', async () => {
    const { agent, patchAgent, apply } = fixture

    await patchAgent({
      manualSource: 'manual_override',
      owned: true,
      level: 40,
      mindscape: 2,
      ascension: 3,
      lockedFields: ['level', 'skills'],
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
      observedFacts: {
        schemaVersion: 1,
        source: 'asset_quick_read',
        protocolVersion: '3.2',
        fields: {
          mindscape: { capturedAt: '2026-10-09T23:00:00-02:00', snapshotSha256: 'b'.repeat(64) },
        },
      },
    })
    await apply()
    expect(await agent()).toMatchObject({
      level: 40,
      mindscape: 2,
      ascension: 1,
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    expect((await agent()).observedFacts?.fields.mindscape?.snapshotSha256).toBe('b'.repeat(64))
  })
  it('allows player edits after automatic synchronization, blocks an old replay and accepts the next newer observation', async () => {
    const { db, facts, agent, patchAgent, apply } = fixture

    const original = await patchAgent({
      manualSource: 'manual_override',
      progressionManuallySet: true,
      owned: true,
      level: 40,
    })
    const receipt = await apply()
    expect((await agent()).level).toBe(20)
    const roster = (await db.accountRosters.get(accountId))!.roster
    const edited = roster.agents.find((row) => row.agentId === agentId)!
    edited.level = 35
    edited.skillLevels.basic = 8
    await saveAccountRoster(accountId, roster, db)
    expect((await agent()).level).toBe(35)
    expect(
      hydrateRosterDefaults((await db.accountRosters.get(accountId))!.roster).agents.find(
        (row) => row.agentId === agentId,
      )!.skillLevels.basic,
    ).toBe(8)
    const before = await facts()
    const old = candidate()
    old.snapshotSha256 = 'b'.repeat(64)
    await expect(apply(old)).rejects.toThrow('请重新读取')
    expect(await facts()).toEqual(before)
    await expect(
      restoreAssetQuickReadImport(accountId, receipt.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('已有其他修改')
    const next = candidate()
    next.snapshotSha256 = 'c'.repeat(64)
    next.capturedAt = new Date(Date.now() + 60_000).toISOString()
    await apply(next)
    expect(await agent()).toMatchObject({
      level: 20,
      skillLevels: next.agents[0].fields.skillLevels,
      manualSource: 'manual_override',
      progressionManuallySet: true,
    })
    expect(original.level).toBe(40)
  })
}
