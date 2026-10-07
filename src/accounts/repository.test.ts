import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { SodaDatabase } from '../db/database'
import { sampleDiscs } from '../evaluation/fixtures'
import { loadCoreWarehouse } from './coreWarehouse'
import {
  createAccount,
  deleteAccount,
  getAccountPreference,
  getAccountSelectionDiagnostic,
  getActiveAccount,
  getAccountRoster,
  listAccountDriveDiscs,
  renameAccount,
  saveAccountDriveDisc,
  saveAccountPreference,
  saveAccountRoster,
  setActiveAccount,
} from './repository'

const names: string[] = []

afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

describe('account-scoped repository', () => {
  it.each(['legacy-id', 'account-missing', 42, null])(
    'reads a valid default without rewriting an unusable saved selection %s',
    async (selectedId) => {
      const name = `soda-account-selection-recovery-${crypto.randomUUID()}`
      names.push(name)
      const db = new SodaDatabase(name)
      const valid = await createAccount('默认账户', db, { id: 'account-valid', makeDefault: true })
      await db.accounts.put({ ...valid, id: 'legacy-id', displayName: '历史账户' })
      await db.accountRosters.put({
        accountId: 'legacy-id',
        roster: createEmptyRoster(),
        updatedAt: valid.updatedAt,
        source: 'manual',
      })
      await db.settings.put({ key: 'active-account-id', value: selectedId })
      const before = {
        accounts: await db.accounts.toArray(),
        rosters: await db.accountRosters.toArray(),
        settings: await db.settings.toArray(),
      }

      expect(await getActiveAccount(db)).toEqual(valid)
      expect(await getAccountSelectionDiagnostic(db)).toMatchObject({
        kind: 'invalid-active-pointer',
        retainedAccountCount: 2,
      })
      await expect(loadCoreWarehouse(db)).resolves.toMatchObject({ accountId: valid.id })
      expect({
        accounts: await db.accounts.toArray(),
        rosters: await db.accountRosters.toArray(),
        settings: await db.settings.toArray(),
      }).toEqual(before)
    },
  )

  it('opens the legacy read projection when only malformed default accounts remain', async () => {
    const name = `soda-account-invalid-default-${crypto.randomUUID()}`
    names.push(name)
    const db = new SodaDatabase(name)
    const valid = await createAccount('历史账户', db, { id: 'account-valid', makeDefault: true })
    await db.accounts.delete(valid.id)
    const historical = { ...valid, id: 'legacy-id' }
    await db.accounts.put(historical)
    await db.settings.put({ key: 'active-account-id', value: historical.id })
    await db.driveDiscs.put(sampleDiscs.potentialCandidate)
    const before = await db.settings.toArray()

    expect(await getActiveAccount(db)).toBeUndefined()
    expect(await getAccountSelectionDiagnostic(db)).toMatchObject({
      kind: 'invalid-account-records',
      retainedAccountCount: 1,
      message: expect.stringContaining('原账户和资产均未修改'),
    })
    await expect(loadCoreWarehouse(db)).resolves.toMatchObject({
      accountId: null,
      discs: [sampleDiscs.potentialCandidate],
    })
    expect(await db.accounts.get(historical.id)).toEqual(historical)
    expect(await db.settings.toArray()).toEqual(before)
    await expect(getAccountRoster(historical.id, db)).rejects.toThrow()
    await expect(setActiveAccount(historical.id, db)).rejects.toThrow()
  })

  it('keeps identical entity IDs isolated when switching accounts', async () => {
    const name = `soda-account-repository-${crypto.randomUUID()}`
    names.push(name)
    const db = new SodaDatabase(name)
    await createAccount('账号 A', db, { id: 'account-alpha', makeDefault: true })
    await createAccount('账号 B', db, { id: 'account-beta' })
    await saveAccountDriveDisc(
      'account-alpha',
      { ...sampleDiscs.potentialCandidate, id: 'same-disc-id', level: 0 },
      db,
    )
    await saveAccountDriveDisc(
      'account-beta',
      { ...sampleDiscs.potentialCandidate, id: 'same-disc-id', level: 15 },
      db,
    )
    await saveAccountPreference('account-alpha', 'optimizer-mode', 'general', db)
    await saveAccountPreference('account-beta', 'optimizer-mode', 'shiyu', db)

    expect((await listAccountDriveDiscs('account-alpha', db))[0].level).toBe(0)
    expect((await listAccountDriveDiscs('account-beta', db))[0].level).toBe(15)
    expect(await getAccountPreference('account-alpha', 'optimizer-mode', db)).toBe('general')
    expect(await getAccountPreference('account-beta', 'optimizer-mode', db)).toBe('shiyu')

    await setActiveAccount('account-beta', db)
    expect((await getActiveAccount(db))?.id).toBe('account-beta')
    expect(await getAccountSelectionDiagnostic(db)).toBeNull()
    expect(await db.driveDiscs.count()).toBe(0)
  })

  it('renames only the display name and warns about ambiguous duplicates', async () => {
    const name = `soda-account-rename-${crypto.randomUUID()}`
    names.push(name)
    const db = new SodaDatabase(name)
    const createdAt = new Date('2026-07-01T00:00:00.000Z')
    await createAccount('账号 A', db, { id: 'account-alpha', now: createdAt })
    await createAccount('同名账号', db, { id: 'account-beta', now: createdAt })
    const result = await renameAccount(
      'account-alpha',
      '  同名账号  ',
      db,
      new Date('2026-07-06T00:00:00.000Z'),
    )
    expect(result.warning).toMatch(/创建日期和账号 ID 后缀/)
    expect(result.account).toMatchObject({
      id: 'account-alpha',
      displayName: '同名账号',
      createdAt: createdAt.toISOString(),
      updatedAt: '2026-07-06T00:00:00.000Z',
    })
    await expect(renameAccount('account-alpha', '   ', db)).rejects.toThrow('不能为空')
  })

  it('hydrates a legacy roster as a read-only projection', async () => {
    const name = `soda-account-roster-read-${crypto.randomUUID()}`
    names.push(name)
    const db = new SodaDatabase(name)
    await createAccount('账号 A', db, { id: 'account-alpha', makeDefault: true })
    const legacyRoster = createEmptyRoster() as Record<string, unknown>
    delete legacyRoster.wEngines
    await db.accountRosters.put({
      accountId: 'account-alpha',
      roster: legacyRoster as never,
      updatedAt: '2026-08-01T00:00:00.000Z',
      source: 'manual',
    })

    const roster = await getAccountRoster('account-alpha', db)
    expect(roster.wEngines).toEqual([])
    expect((await db.accountRosters.get('account-alpha'))?.roster).not.toHaveProperty('wEngines')
  })

  it('keeps a newly created account free of W-Engine inventory rows', async () => {
    const name = `soda-account-empty-wengines-${crypto.randomUUID()}`
    names.push(name)
    const db = new SodaDatabase(name)
    const account = await createAccount('新账户', db, {
      id: 'account-empty-wengines',
      makeDefault: true,
    })

    expect((await getAccountRoster(account.id, db)).wEngines).toEqual([])
  })

  it('deletes one complete account scope and activates the remaining account', async () => {
    const name = `soda-account-delete-${crypto.randomUUID()}`
    names.push(name)
    const db = new SodaDatabase(name)
    await createAccount('账号 A', db, { id: 'account-alpha', makeDefault: true })
    await createAccount('账号 B', db, { id: 'account-beta' })
    await saveAccountDriveDisc(
      'account-alpha',
      { ...sampleDiscs.potentialCandidate, id: 'alpha-disc' },
      db,
    )
    await saveAccountPreference('account-alpha', 'assets.last-agent', 'agent-anby', db)
    await saveAccountRoster('account-alpha', createEmptyRoster(), db)

    const result = await deleteAccount('account-alpha', db)

    expect(result).toMatchObject({
      accountId: 'account-alpha',
      deleted: { driveDiscs: 1, rosters: 1, preferences: 1 },
      nextActiveAccountId: 'account-beta',
    })
    expect(await db.accounts.get('account-alpha')).toBeUndefined()
    expect(await db.accountDriveDiscs.where('accountId').equals('account-alpha').count()).toBe(0)
    expect(await db.accountPreferences.where('accountId').equals('account-alpha').count()).toBe(0)
    expect((await getActiveAccount(db))?.id).toBe('account-beta')
    expect(await db.accounts.get('account-beta')).toMatchObject({ isDefault: true })
  })

  it('clears the active pointer after deleting the last account', async () => {
    const name = `soda-account-delete-last-${crypto.randomUUID()}`
    names.push(name)
    const db = new SodaDatabase(name)
    await createAccount('唯一账号', db, { id: 'account-only' })

    await expect(deleteAccount('account-only', db)).resolves.toMatchObject({
      nextActiveAccountId: null,
    })
    expect(await db.accounts.count()).toBe(0)
    expect(await db.settings.get('active-account-id')).toBeUndefined()
    expect(await getActiveAccount(db)).toBeUndefined()
    expect(await getAccountSelectionDiagnostic(db)).toBeNull()
  })
})
