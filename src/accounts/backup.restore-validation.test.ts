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

describe('account and vault backups', () => {
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
