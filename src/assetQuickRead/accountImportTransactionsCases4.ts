import Dexie from 'dexie'
import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { saveAccountPlanningDraft, saveCurrentAgentBuild } from '../accounts/planningDrafts'
import type { AccountDriveDisc } from '../accounts/types'
import { contentHash } from '../application/contentHash'
import { SodaDatabase } from '../db/databaseCore'
import {
  prepareAssetQuickReadImport,
  readLatestAssetQuickReadRecovery,
  removeSavedAssetQuickReadRecovery,
  restoreAssetQuickReadImport,
} from './accountImport'
import { accountId, candidate, earlier, now, storedDisc } from './accountImport.fixtures'
import type { AccountImportTransactionsFixture } from './accountImportTransactionsFixture'

export function registerAccountImportTransactionsCases4(fixture: AccountImportTransactionsFixture) {
  it('serializes a concurrent plan save before the restore and then blocks with zero asset writes', async () => {
    const { db, apply, planningInput, expectPlanningRestoreBlocked } = fixture

    const receipt = await apply()
    const otherTab = new SodaDatabase(db.name)
    await otherTab.open()
    let releaseSave!: () => void
    let signalStarted!: () => void
    const gate = new Promise<void>((resolve) => (releaseSave = resolve))
    const started = new Promise<void>((resolve) => (signalStarted = resolve))
    try {
      const save = saveAccountPlanningDraft(
        accountId,
        planningInput('concurrent-plan', ['asset-disc-880001']),
        otherTab,
        async () => {
          signalStarted()
          await Dexie.waitFor(gate)
        },
      )
      await started
      const deletes = vi.spyOn(db.accountDriveDiscs, 'bulkDelete')
      const restore = restoreAssetQuickReadImport(
        accountId,
        receipt.recoveryKey,
        'restore_asset_quick_read',
        db,
      )
      const rejected = expect(restore).rejects.toThrow('concurrent-plan')
      releaseSave()
      await save
      await rejected
      expect(deletes).not.toHaveBeenCalled()
      expect(await db.accountDriveDiscs.get(`${accountId}:asset-disc-880001`)).toBeDefined()
      await expectPlanningRestoreBlocked(receipt.recoveryKey, 'concurrent-plan')
    } finally {
      releaseSave()
      otherTab.close()
    }
  })
  it('rejects a stale plan save after restore committed and leaves the restored account unchanged', async () => {
    const { db, facts, apply, planningInput } = fixture

    const receipt = await apply()
    const stale = planningInput('late-plan', ['asset-disc-880001'])
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    const before = await facts()
    await expect(saveAccountPlanningDraft(accountId, stale, db)).rejects.toThrow('不存在')
    expect(await facts()).toEqual(before)
  })
  it('serializes restore first and rejects a concurrently queued stale save from another tab', async () => {
    const { db, apply, planningInput } = fixture

    const receipt = await apply()
    const otherTab = new SodaDatabase(db.name)
    await otherTab.open()
    let releaseRestore!: () => void
    let signalStarted!: () => void
    const gate = new Promise<void>((resolve) => (releaseRestore = resolve))
    const started = new Promise<void>((resolve) => (signalStarted = resolve))
    const bulkDelete = db.accountDriveDiscs.bulkDelete.bind(db.accountDriveDiscs)
    vi.spyOn(db.accountDriveDiscs, 'bulkDelete').mockImplementationOnce((keys) => {
      signalStarted()
      return Dexie.Promise.resolve(Dexie.waitFor(gate)).then(() => bulkDelete(keys))
    })
    try {
      const restore = restoreAssetQuickReadImport(
        accountId,
        receipt.recoveryKey,
        'restore_asset_quick_read',
        db,
      )
      await started
      const lateSave = Dexie.ignoreTransaction(() =>
        saveAccountPlanningDraft(
          accountId,
          planningInput('queued-late-plan', ['asset-disc-880001']),
          otherTab,
        ),
      )
      const rejected = expect(lateSave).rejects.toThrow('不存在')
      releaseRestore()
      await restore
      await rejected
      expect(await db.accountPlanningDrafts.count()).toBe(0)
      expect(await db.accountDriveDiscs.get(`${accountId}:asset-disc-880001`)).toBeUndefined()
      expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
        canRestore: false,
      })
    } finally {
      releaseRestore()
      otherTab.close()
    }
  })
  it('rejects a stale current-agent build after restore without modifying the existing reference', async () => {
    const { db, facts, apply, planningInput } = fixture

    const context = {
      contract: 'soda-solution-context/v1' as const,
      scope: 'agent_independent' as const,
      resourcePolicy: 'advisory' as const,
      sourceCandidateId: 'synthetic-candidate',
      inputFingerprint: 'synthetic-input',
      solverMethod: 'synthetic',
      gameVersion: '3.2',
      knowledgeVersion: 'synthetic',
      exactVariantKey: null,
    }
    await saveCurrentAgentBuild(
      accountId,
      { ...planningInput('existing-direction', []), solutionContext: context },
      db,
    )
    const receipt = await apply()
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    const restored = await facts()
    await expect(
      saveCurrentAgentBuild(
        accountId,
        { ...planningInput('late-agent-plan', ['asset-disc-880001']), solutionContext: context },
        db,
      ),
    ).rejects.toThrow('不存在')
    expect(await facts()).toEqual(restored)
  })
  it('refuses recovery after a later actual disc edit without changing the player edit or plans', async () => {
    const { db, facts, apply } = fixture

    const receipt = await apply()
    await db.accountDriveDiscs.update(`${accountId}:asset-disc-880001`, { level: 3 })
    const edited = await facts()
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
      canRestore: false,
    })
    await expect(
      restoreAssetQuickReadImport(accountId, receipt.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('已有其他修改')
    expect(await facts()).toEqual(edited)
  })
  it('requires the explicit restore confirmation and refuses duplicate snapshot imports', async () => {
    const { db, facts, apply } = fixture

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
    await expect(prepareAssetQuickReadImport(accountId, input, db)).rejects.toMatchObject({
      diagnosticCode: 'import_snapshot_reused',
      message: expect.stringContaining('已导入'),
    })
    expect(await facts()).toEqual(after)
  })
  it('allows the same snapshot again only after explicit restore to exactly its original facts', async () => {
    const { db, patchAgent, apply } = fixture

    const input = candidate()
    const first = await apply(input)
    await restoreAssetQuickReadImport(accountId, first.recoveryKey, 'restore_asset_quick_read', db)
    const second = await apply(input)
    expect(second.recoveryKey).toBe(first.recoveryKey)
    expect(await db.accountPreferences.count()).toBe(1)
    await restoreAssetQuickReadImport(accountId, second.recoveryKey, 'restore_asset_quick_read', db)
    await patchAgent({ priority: 1 })
    await expect(apply(input)).rejects.toThrow('其他修改')
  })
  it('keeps at most ten saved quick-read receipts and never silently removes one', async () => {
    const { db, facts, apply } = fixture

    for (let i = 0; i < 10; i++) {
      const input = candidate()
      input.snapshotSha256 = i.toString(16).repeat(64)
      input.capturedAt = new Date(Date.parse(now) + i * 1000).toISOString()
      await apply(input)
    }
    const before = await facts()
    const next = candidate()
    next.snapshotSha256 = 'f'.repeat(64)
    next.capturedAt = new Date(Date.parse(now) + 11_000).toISOString()
    await expect(apply(next)).rejects.toMatchObject({
      diagnosticCode: 'import_recovery_limit_reached',
      message: expect.stringContaining('已达 10 份'),
    })
    expect(await facts()).toEqual(before)
    const copy = (await db.accountPreferences.toArray())[0]
    await removeSavedAssetQuickReadRecovery(
      accountId,
      copy.key,
      contentHash(copy.value),
      'downloaded_and_keep_external_copy',
      db,
    )
    await apply(next)
    expect(await db.accountPreferences.count()).toBe(10)
  })
  it('refuses invalid existing manual and disc times rather than silently superseding them', async () => {
    const { db, facts, patchAgent, apply } = fixture

    await patchAgent({ manualSource: 'manual_override', level: 40 })
    await db.accountRosters.update(accountId, { updatedAt: 'invalid-manual-time' })
    const before = await facts()
    await expect(apply()).rejects.toThrow('时间无效')
    expect(await facts()).toEqual(before)
    await db.accountRosters.update(accountId, { updatedAt: earlier })
    const disc = storedDisc('invalid-time', 'asset-quick-read:880001')
    disc.updatedAt = 'invalid-disc-time'
    await db.accountDriveDiscs.put(disc)
    await expect(apply()).rejects.toThrow('时间无效')
  })
  it('refuses a changed recovery payload without affecting current assets', async () => {
    const { db, facts, apply } = fixture

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
    const { db, facts, apply } = fixture

    await db.accountRosters.delete(accountId)
    const before = await facts()
    const result = await apply()
    await restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db)
    expect((await facts()).discs).toEqual(before.discs)
    expect(await db.accountRosters.get(accountId)).toBeUndefined()
  })
  it('rejects restoration after later player edits without covering those edits', async () => {
    const { db, facts, patchAgent, apply } = fixture

    const result = await apply()
    await patchAgent({ priority: 1 })
    const edited = await facts()
    await expect(
      restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('已有其他修改')
    expect(await facts()).toEqual(edited)
  })
  it('rolls back partial restore writes after an injected roster write failure', async () => {
    const { db, facts, apply } = fixture

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
    const { agent, patchAgent, apply } = fixture

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
    const { db, facts, apply } = fixture

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
}
