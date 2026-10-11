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
import { preflightVaultBackupAgainstDatabase } from './backup'
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
