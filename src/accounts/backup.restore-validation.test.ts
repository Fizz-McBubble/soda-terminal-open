import {
  describe,
  expect,
  it,
  sampleDiscs,
  getScopedId,
  createAccountBackup,
  createVaultBackup,
  preflightAccountBackup,
  restoreAccountBackup,
  restoreVaultBackup,
  createDatabase,
  seedAccount,
  snapshotAccountState,
} from './backup.testFixture'
import {
  preflightVaultBackup,
  preflightVaultBackupAgainstDatabase,
  accountBackupSchema,
  restoreAccountBackupIndependently,
  vaultBackupFormat,
  vaultBackupFormatVersion,
} from './backup'
import { rosterSnapshotSchema } from './rosterSnapshotCore'
import { scanImportBatchMetaSchema } from '../domain/scanImportStagingSchemas'
import { readRestoreRecoveries, removeSavedRestoreRecovery } from './restoreRecovery'

describe('account and vault backups', () => {
  it('saves an independently exportable full vault before replacing missing accounts', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-alpha', '新资料')
    await seedAccount(target, 'account-alpha', '原资料')
    await seedAccount(target, 'account-removed', '不会出现在新备份的账户')
    const before = await createVaultBackup(target)
    const incoming = await createVaultBackup(source)
    const preview = await preflightVaultBackupAgainstDatabase(incoming, target)
    expect(preview.conflicts.join(' ')).toContain('account-removed')
    expect(preview.conflicts.join(' ')).toContain('恢复会移除')
    await restoreVaultBackup(incoming, target, undefined, preview.affectedAccounts)
    const saved = await readRestoreRecoveries(target)
    expect(saved).toHaveLength(1)
    const recovery = saved[0].backup as typeof before
    const withoutExportTimes = (accounts: typeof before.accounts) =>
      accounts.map((item) => ({
        ...item,
        exportedAt: '',
        data: {
          ...item.data,
          roster: item.data.roster ? { ...item.data.roster, exportedAt: '' } : null,
        },
      }))
    expect(withoutExportTimes(recovery.accounts)).toEqual(withoutExportTimes(before.accounts))
    const restored = createDatabase()
    await restoreVaultBackup(recovery, restored)
    expect((await restored.accounts.toArray()).map((row) => row.id).sort()).toEqual([
      'account-alpha',
      'account-removed',
    ])
    expect(await readRestoreRecoveries(target)).toEqual(saved)
  })

  it('keeps quick-read receipts in the saved account replacement snapshot', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-alpha', '新账户')
    await seedAccount(target, 'account-alpha', '原账户')
    const key = `asset-quick-read-recovery-${'a'.repeat(64)}`
    await target.accountPreferences.put({
      scopedId: getScopedId('account-alpha', key),
      accountId: 'account-alpha',
      key,
      updatedAt: new Date().toISOString(),
      value: { synthetic: 'protected receipt' },
    })
    const backup = await createAccountBackup('account-alpha', source)
    await restoreAccountBackup(backup, target)
    const saved = (await readRestoreRecoveries(target))[0].backup as typeof backup
    expect(saved.data.preferences.find((row) => row.key === key)?.value).toEqual({
      synthetic: 'protected receipt',
    })
  })

  it('fails closed at the recovery limit and releases only an explicitly confirmed unchanged copy', async () => {
    const db = createDatabase()
    await seedAccount(db, 'account-alpha', '合成账户')
    const backup = await createAccountBackup('account-alpha', db)
    for (let i = 0; i < 10; i++) await restoreAccountBackup(backup, db)
    const before = await snapshotAccountState(db)
    await expect(restoreAccountBackup(backup, db)).rejects.toThrow('已达 10 份')
    expect(await snapshotAccountState(db)).toEqual(before)
    const saved = (await readRestoreRecoveries(db))[0]
    await expect(
      removeSavedRestoreRecovery(saved.key, 'wrong-hash', 'downloaded_and_keep_external_copy', db),
    ).rejects.toThrow('已变化')
    await removeSavedRestoreRecovery(
      saved.key,
      saved.backupHash,
      'downloaded_and_keep_external_copy',
      db,
    )
    expect(await readRestoreRecoveries(db)).toHaveLength(9)
    await restoreAccountBackup(backup, db)
    expect(await readRestoreRecoveries(db)).toHaveLength(10)
  })

  it('rechecks account and vault identity under the replacement transaction', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-alpha', '源账户')
    const account = await createAccountBackup('account-alpha', source)
    const vault = await createVaultBackup(source)
    await seedAccount(target, 'account-alpha', '新增本机账户')
    const before = await snapshotAccountState(target)
    await expect(restoreAccountBackup(account, target, undefined, 'new_account')).rejects.toThrow(
      '身份已变化',
    )
    await expect(restoreVaultBackup(vault, target, undefined, [])).rejects.toThrow('范围已变化')
    expect(await snapshotAccountState(target)).toEqual(before)
    expect(await readRestoreRecoveries(target)).toEqual([])
  })

  it('restores archived accounts without selecting them and retains a valid active account', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-archived', '归档账户')
    await source.accounts.update('account-archived', { status: 'archived', isDefault: false })
    const backup = await createAccountBackup('account-archived', source)
    await seedAccount(target, 'account-current', '当前账户')
    await target.settings.put({ key: 'active-account-id', value: 'account-current' })
    await restoreAccountBackup(backup, target)
    expect((await target.settings.get('active-account-id'))?.value).toBe('account-current')
    const empty = createDatabase()
    await restoreAccountBackup(backup, empty)
    expect(await empty.settings.get('active-account-id')).toBeUndefined()
  })
  it('rejects cross-account data and missing references before writing', async () => {
    const db = createDatabase()
    await seedAccount(db, 'account-alpha', '账号 A')
    const backup = await createAccountBackup('account-alpha', db)
    const damaged = structuredClone(backup)
    damaged.data.driveDiscs[0].accountId = 'account-other'
    expect(preflightAccountBackup(damaged).success).toBe(false)
    expect(await db.accounts.count()).toBe(1)
  })

  it('rejects a saved plan that points outside the backup disc scope', async () => {
    const db = createDatabase()
    await seedAccount(db, 'account-alpha', '账号 A')
    const backup = await createAccountBackup('account-alpha', db)
    backup.data.planningDrafts.push({
      scopedId: getScopedId('account-alpha', 'plan-outside-scope'),
      accountId: 'account-alpha',
      id: 'plan-outside-scope',
      kind: 'agent',
      name: '越界方案',
      state: 'saved',
      selection: { agentIds: ['agent-anby'], bangbooId: null, scenario: '验证' },
      manualOverrides: {
        wEngineDirection: '',
        discDirection: '',
        progressionDirection: '',
        notes: '',
      },
      knowledgeRefs: [],
      warehouseRefs: ['disc-not-in-backup'],
      comparisonCapability: 'direction',
      createdAt: '2026-07-06T00:00:00.000Z',
      updatedAt: '2026-07-06T00:00:00.000Z',
      revision: 1,
    })
    backup.counts.planningDrafts = 1

    expect(preflightAccountBackup(backup).errors).toContain(
      '一份已保存方案引用了备份范围外的驱动盘。',
    )
  })

  it('rolls back a failed account restore transaction', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-alpha', '账号 A')
    await seedAccount(target, 'account-alpha', '原账号 A')
    const before = await snapshotAccountState(target)
    const backup = await createAccountBackup('account-alpha', source)
    await expect(
      restoreAccountBackup(backup, target, () => {
        throw new Error('simulated failure')
      }),
    ).rejects.toThrow('simulated failure')
    expect(await snapshotAccountState(target)).toEqual(before)
  })

  it('restores a complete vault without touching legacy tables', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-alpha', '账号 A')
    await seedAccount(source, 'account-beta', '账号 B')
    await target.driveDiscs.add({ ...sampleDiscs.potentialCandidate, id: 'legacy-disc' })
    const vault = await createVaultBackup(source)
    await restoreVaultBackup(vault, target)
    expect(await target.accounts.count()).toBe(2)
    expect(await target.accountDriveDiscs.count()).toBe(2)
    expect(await target.driveDiscs.get('legacy-disc')).toBeTruthy()
    expect(
      await target.accountPreferences.get(getScopedId('account-alpha', 'optimizer-mode')),
    ).toBeTruthy()
  })

  it('restores a usable active account from a valid zero-default vault', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-alpha', '账号 A')
    await seedAccount(source, 'account-beta', '账号 B')
    const vault = await createVaultBackup(source)
    for (const backup of vault.accounts) backup.account.isDefault = false

    await restoreVaultBackup(vault, target)

    expect((await target.settings.get('active-account-id'))?.value).toBe('account-alpha')
  })

  it('clears the active selection when a valid vault contains no active accounts', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await seedAccount(source, 'account-archived', '归档账号')
    await source.accounts.update('account-archived', { status: 'archived', isDefault: false })
    await seedAccount(target, 'account-previous', '旧账号')
    await target.settings.put({ key: 'active-account-id', value: 'account-previous' })

    await restoreVaultBackup(await createVaultBackup(source), target)

    expect(await target.settings.get('active-account-id')).toBeUndefined()
  })
})

describe('backup live-reference and legacy-core regression', () => {
  async function backupWithArchivedDisc() {
    const source = createDatabase()
    await seedAccount(source, 'account-alpha', '独立审计合成账户')
    const backup = await createAccountBackup('account-alpha', source)
    const live = backup.data.driveDiscs[0]
    const agent = backup.data.roster?.agents[0]
    if (!live || !agent) throw new Error('Expected a complete synthetic backup fixture.')
    const archived = { ...live, id: 'audit-archived-disc' }
    const batchId = 'audit-archive-batch'
    backup.data.scanBatches.push({
      ...scanImportBatchMetaSchema.parse({
        id: batchId,
        source: 'synthetic-audit',
        createdAt: backup.exportedAt,
        updatedAt: backup.exportedAt,
        dataVersion: live.dataVersion,
        recognitionVersion: 'audit-fixture-v1',
        sourceReport: 'synthetic-audit',
        total: 0,
        replacedDiscs: [archived],
      }),
      accountId: backup.account.id,
      scopedId: getScopedId(backup.account.id, batchId),
      sourceLegacyId: null,
      migratedAt: null,
    })
    backup.counts.scanBatches = backup.data.scanBatches.length
    agent.equippedDiscIds = [live.id]
    agent.currentEquipment = 'known'
    return { backup, live, archived, agent }
  }

  it('restores live equipment without promoting archived history into inventory', async () => {
    const { backup, live, archived, agent } = await backupWithArchivedDisc()
    expect(accountBackupSchema.safeParse(backup).success).toBe(true)
    expect(preflightAccountBackup(backup).success).toBe(true)
    const target = createDatabase()
    await restoreAccountBackup(backup, target)
    const discs = await target.accountDriveDiscs.toArray()
    expect(discs.map((disc) => disc.id)).toEqual([live.id])
    expect(discs.some((disc) => disc.id === archived.id)).toBe(false)
    const restored = await target.accountRosters.get(backup.account.id)
    expect(
      restored?.roster.agents.find((row) => row.agentId === agent.agentId)?.equippedDiscIds,
    ).toEqual([live.id])
    const batches = await target.accountScanImportBatches.toArray()
    expect(batches[0]?.replacedDiscs?.[0]?.id).toBe(archived.id)
  })

  it('rejects equipment absent from both live inventory and recoverable history before writes', async () => {
    const { backup, agent } = await backupWithArchivedDisc()
    agent.equippedDiscIds = ['missing-from-live-and-history']
    // Ensure the failure is the reference invariant, not malformed test data.
    expect(accountBackupSchema.safeParse(backup).success).toBe(true)
    const originalInput = structuredClone(backup)
    const target = createDatabase()
    await seedAccount(target, 'account-alpha', '受保护的目标账户')
    await seedAccount(target, 'account-other', '受保护的其他账户')
    const before = await snapshotAccountState(target)
    const recoveries = await readRestoreRecoveries(target)
    expect(preflightAccountBackup(backup).errors).toContain(
      '一位代理人的当前装备不在该备份范围内。',
    )
    await expect(restoreAccountBackup(backup, target)).rejects.toThrow(
      '一位代理人的当前装备不在该备份范围内。',
    )
    expect(await snapshotAccountState(target)).toEqual(before)
    expect(await readRestoreRecoveries(target)).toEqual(recoveries)

    // Independent restore entry point zero-write rejection
    await expect(
      restoreAccountBackupIndependently(backup, { displayName: '独立副本' }, target),
    ).rejects.toThrow('一位代理人的当前装备不在该备份范围内。')
    expect(await snapshotAccountState(target)).toEqual(before)
    expect(await readRestoreRecoveries(target)).toEqual(recoveries)

    // Vault restore entry point zero-write rejection
    const vault = {
      format: vaultBackupFormat,
      formatVersion: vaultBackupFormatVersion,
      exportedAt: backup.exportedAt,
      databaseSchemaVersion: backup.databaseSchemaVersion,
      accounts: [backup],
    }
    expect(preflightVaultBackup(vault).errors).toContain('一位代理人的当前装备不在该备份范围内。')
    await expect(restoreVaultBackup(vault, target)).rejects.toThrow(
      '一位代理人的当前装备不在该备份范围内。',
    )
    expect(await snapshotAccountState(target)).toEqual(before)
    expect(await readRestoreRecoveries(target)).toEqual(recoveries)
    expect(backup).toEqual(originalInput)
  })

  it('restores old equipment references as history without reviving discs removed by a full scan', async () => {
    const { backup, archived, live, agent } = await backupWithArchivedDisc()
    agent.equippedDiscIds = [archived.id]
    expect(preflightAccountBackup(backup).success).toBe(true)
    const target = createDatabase()
    await restoreAccountBackup(backup, target)
    expect((await target.accountDriveDiscs.toArray()).map((disc) => disc.id)).toEqual([live.id])
    expect(
      (await target.accountRosters.get(backup.account.id))!.roster.agents.find(
        (row) => row.agentId === agent.agentId,
      )!.equippedDiscIds,
    ).toEqual([archived.id])
    expect((await target.accountScanImportBatches.toArray())[0]!.replacedDiscs?.[0]?.id).toBe(
      archived.id,
    )
  })

  it('retains historical saved-plan archive references without making their discs live', async () => {
    const { backup, archived } = await backupWithArchivedDisc()
    const planId = 'audit-history-plan'
    backup.data.planningDrafts.push({
      scopedId: getScopedId(backup.account.id, planId),
      accountId: backup.account.id,
      id: planId,
      kind: 'agent',
      name: '合成历史方案',
      state: 'saved',
      savedRole: 'history',
      selection: { agentIds: ['agent-anby'], bangbooId: null, scenario: 'synthetic-audit' },
      manualOverrides: {
        wEngineDirection: '',
        discDirection: '',
        progressionDirection: '',
        notes: '',
      },
      knowledgeRefs: [],
      warehouseRefs: [archived.id],
      comparisonCapability: 'direction',
      createdAt: backup.exportedAt,
      updatedAt: backup.exportedAt,
      revision: 1,
    })
    backup.counts.planningDrafts = backup.data.planningDrafts.length
    expect(accountBackupSchema.safeParse(backup).success).toBe(true)
    expect(preflightAccountBackup(backup).success).toBe(true)
    const target = createDatabase()
    await restoreAccountBackup(backup, target)
    expect((await target.accountPlanningDrafts.toArray())[0]?.warehouseRefs).toEqual([archived.id])
    expect((await target.accountDriveDiscs.toArray()).some((row) => row.id === archived.id)).toBe(
      false,
    )
  })

  it('retains historical disc evaluations referencing archived discs without making their discs live', async () => {
    const { backup, archived } = await backupWithArchivedDisc()
    const evaluationId = 'audit-history-evaluation'
    backup.data.discEvaluations.push({
      scopedId: getScopedId(backup.account.id, evaluationId),
      accountId: backup.account.id,
      id: evaluationId,
      discId: archived.id,
      discVersion: '3.0',
      templateId: 'tpl-history',
      templateVersion: '1',
      templateContentHash: 'content-hash-1',
      ruleVersion: '1',
      ruleContentHash: 'rule-hash-1',
      gameDataVersion: '3.0',
      evaluatedAt: backup.exportedAt,
      status: 'valid',
      source: 'manual',
      sourceLegacyId: null,
      migratedAt: null,
    })
    backup.counts.discEvaluations = backup.data.discEvaluations.length
    expect(accountBackupSchema.safeParse(backup).success).toBe(true)
    expect(preflightAccountBackup(backup).success).toBe(true)
    const target = createDatabase()
    await restoreAccountBackup(backup, target)
    const storedEvaluations = await target.accountDiscEvaluations.toArray()
    expect(storedEvaluations.some((row) => row.discId === archived.id)).toBe(true)
    expect((await target.accountDriveDiscs.toArray()).some((row) => row.id === archived.id)).toBe(
      false,
    )
  })

  const coreSchema = rosterSnapshotSchema.shape.agents.element.shape.skillLevels.unwrap().shape.core

  it('maps only single A through F core labels to levels 2 through 7', () => {
    for (const [index, letter] of [...'ABCDEF'].entries()) {
      expect(coreSchema.parse(letter)).toBe(index + 2)
      expect(coreSchema.parse(letter.toLowerCase())).toBe(index + 2)
    }
  })

  it('preserves numeric core levels, numeric strings and unknown values', () => {
    for (let level = 1; level <= 7; level++) {
      expect(coreSchema.parse(level)).toBe(level)
      expect(coreSchema.parse(String(level))).toBe(level)
    }
    expect(coreSchema.parse(null)).toBeNull()
    // Never migrate an already stored 6 to 7 without evidence of its original source.
    expect(coreSchema.parse(6)).toBe(6)
  })

  it('rejects malformed labels instead of reading their first character', () => {
    for (const value of ['G', 'g', 'Foo', 'Aardvark', 'AF', 'F6', ' F', 'F ', '', 0, 8, -1, 1.5]) {
      expect(coreSchema.safeParse(value).success).toBe(false)
    }
  })

  it('carries a legacy F label through backup restore and re-export as level 7', async () => {
    const { backup, agent } = await backupWithArchivedDisc()
    if (!backup.data.roster) throw new Error('Expected a synthetic roster snapshot.')
    const raw = {
      ...backup,
      data: {
        ...backup.data,
        roster: {
          ...backup.data.roster,
          agents: backup.data.roster.agents.map((row) =>
            row.agentId === agent.agentId
              ? {
                  ...row,
                  skillLevels: { basic: 1, dodge: 1, assist: 1, special: 1, chain: 1, core: 'F' },
                }
              : row,
          ),
        },
      },
    }
    expect(accountBackupSchema.safeParse(raw).success).toBe(true)
    const target = createDatabase()
    await restoreAccountBackup(raw, target)
    const exported = await createAccountBackup(backup.account.id, target)
    expect(
      exported.data.roster?.agents.find((row) => row.agentId === agent.agentId)?.skillLevels?.core,
    ).toBe(7)
  })
})
