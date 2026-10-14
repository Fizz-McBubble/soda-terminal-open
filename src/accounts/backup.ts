import { database, databaseSchemaVersion, type SodaDatabase } from '../db/databaseCore'
import { preflightAccountBackup, preflightVaultBackup } from './backupPreflight'
import {
  accountBackupFormat,
  accountBackupFormatVersion,
  accountBackupSchema,
  vaultBackupFormat,
  vaultBackupFormatVersion,
  vaultBackupSchema,
  type AccountBackup,
  type AccountBackupIdentity,
  type VaultBackup,
} from './backupSchemas'
import { exportRosterSnapshot } from './publicRosterSnapshot'
import { restoreBackupRoster } from './restoreBackupRoster'
import { saveRestoreRecovery } from './restoreRecovery'
import {
  accountIdSchema,
  getScopedId,
  type AccountDiscEvaluation,
  type AccountDriveDisc,
  type AccountOptimizationResult,
  type AccountPlanningDraft,
  type AccountPreference,
  type AccountScanImportBatch,
  type AccountScanImportItem,
} from './types'
export {
  preflightAccountBackup,
  preflightAccountBackupAgainstDatabase,
  preflightVaultBackup,
  preflightVaultBackupAgainstDatabase,
} from './backupPreflight'

export {
  accountBackupFormat,
  accountBackupFormatVersion,
  accountBackupSchema,
  vaultBackupFormat,
  vaultBackupFormatVersion,
  vaultBackupSchema,
} from './backupSchemas'
export type {
  AccountBackup,
  AccountBackupIdentity,
  AccountBackupPreflight,
  VaultBackup,
} from './backupSchemas'

export async function createAccountBackup(
  accountId: string,
  db: SodaDatabase = database,
  now = new Date(),
): Promise<AccountBackup> {
  return db.transaction('r', accountTables(db), async () => {
    const account = await db.accounts.get(accountId)
    if (!account) throw new Error('账号不存在。')
    const [
      driveDiscs,
      discEvaluations,
      scanBatches,
      scanItems,
      roster,
      results,
      preferences,
      planningDrafts,
    ] = await Promise.all([
      db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
      db.accountDiscEvaluations.where('accountId').equals(accountId).toArray(),
      db.accountScanImportBatches.where('accountId').equals(accountId).toArray(),
      db.accountScanImportItems.where('accountId').equals(accountId).toArray(),
      db.accountRosters.get(accountId),
      db.accountOptimizationResults.where('accountId').equals(accountId).toArray(),
      db.accountPreferences.where('accountId').equals(accountId).toArray(),
      db.accountPlanningDrafts.where('accountId').equals(accountId).toArray(),
    ])
    const data = {
      driveDiscs,
      discEvaluations,
      scanBatches,
      scanItems,
      roster: roster ? exportRosterSnapshot(roster.roster) : null,
      optimizationResults: results,
      preferences,
      planningDrafts,
    }
    return accountBackupSchema.parse({
      format: accountBackupFormat,
      formatVersion: accountBackupFormatVersion,
      exportedAt: now.toISOString(),
      databaseSchemaVersion,
      account,
      dataPackRefs: {
        gameDataVersion: driveDiscs[0]?.dataVersion ?? 'unknown',
        buildKnowledgeVersion: null,
        rotationId: null,
      },
      counts: {
        driveDiscs: driveDiscs.length,
        discEvaluations: discEvaluations.length,
        scanBatches: scanBatches.length,
        scanItems: scanItems.length,
        roster: roster ? 1 : 0,
        optimizationResults: results.length,
        preferences: preferences.length,
        planningDrafts: planningDrafts.length,
      },
      data,
    })
  })
}

async function replaceAccountBackupData(backup: AccountBackup, db: SodaDatabase) {
  const accountId = backup.account.id
  await Promise.all([
    db.accountDriveDiscs.where('accountId').equals(accountId).delete(),
    db.accountDiscEvaluations.where('accountId').equals(accountId).delete(),
    db.accountScanImportBatches.where('accountId').equals(accountId).delete(),
    db.accountScanImportItems.where('accountId').equals(accountId).delete(),
    db.accountRosters.delete(accountId),
    db.accountOptimizationResults.where('accountId').equals(accountId).delete(),
    db.accountPreferences.where('accountId').equals(accountId).delete(),
    db.accountPlanningDrafts.where('accountId').equals(accountId).delete(),
  ])
  const otherDefault = backup.account.isDefault
    ? await db.accounts.filter((account) => account.id !== accountId && account.isDefault).first()
    : undefined
  // A single-account restore cannot replace another account's local default role.
  // The active pointer still explicitly selects this restored account below.
  await db.accounts.put({
    ...backup.account,
    isDefault: backup.account.isDefault && !otherDefault,
    source: 'backup_restore',
  })
  await db.accountDriveDiscs.bulkAdd(backup.data.driveDiscs as AccountDriveDisc[])
  await db.accountDiscEvaluations.bulkAdd(backup.data.discEvaluations as AccountDiscEvaluation[])
  await db.accountScanImportBatches.bulkAdd(backup.data.scanBatches as AccountScanImportBatch[])
  await db.accountScanImportItems.bulkAdd(backup.data.scanItems as AccountScanImportItem[])
  if (backup.data.roster) {
    await db.accountRosters.add({
      accountId,
      roster: restoreBackupRoster(backup.data.roster),
      updatedAt: backup.exportedAt,
      source: 'backup_restore',
    })
  }
  await db.accountOptimizationResults.bulkAdd(
    backup.data.optimizationResults as AccountOptimizationResult[],
  )
  await db.accountPreferences.bulkAdd(backup.data.preferences as AccountPreference[])
  await db.accountPlanningDrafts.bulkAdd(backup.data.planningDrafts as AccountPlanningDraft[])
}

const accountTables = (db: SodaDatabase) => [
  db.accounts,
  db.accountDriveDiscs,
  db.accountDiscEvaluations,
  db.accountScanImportBatches,
  db.accountScanImportItems,
  db.accountRosters,
  db.accountOptimizationResults,
  db.accountPreferences,
  db.accountPlanningDrafts,
  db.settings,
]

export async function restoreAccountBackup(
  input: unknown,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
  expectedIdentity?: AccountBackupIdentity,
) {
  const preflight = preflightAccountBackup(input)
  if (!preflight.success || !preflight.backup) {
    throw new Error(preflight.errors[0] ?? '账号备份预检失败。')
  }
  await db.transaction('rw', accountTables(db), async () => {
    const existing = await db.accounts.get(preflight.backup!.account.id)
    if (expectedIdentity && Boolean(existing) !== (expectedIdentity === 'same_id'))
      throw new Error('目标账户身份已变化，请重新检查并确认恢复范围。')
    if (existing)
      await saveRestoreRecovery(
        await createAccountBackup(existing.id, db),
        `账户“${existing.displayName}”`,
        db,
      )
    await replaceAccountBackupData(preflight.backup!, db)
    await selectRestoredActiveAccount(preflight.backup!.account.id, db)
    beforeCommit?.()
  })
  return preflight.backup.counts
}

async function selectRestoredActiveAccount(accountId: string, db: SodaDatabase) {
  if ((await db.accounts.get(accountId))?.status === 'active') {
    await db.settings.put({ key: 'active-account-id', value: accountId })
    return
  }
  const currentId = (await db.settings.get('active-account-id'))?.value
  if (typeof currentId === 'string' && (await db.accounts.get(currentId))?.status === 'active')
    return
  const active = await db.accounts.filter((account) => account.status === 'active').toArray()
  const next = active.find((account) => account.isDefault) ?? active[0]
  if (next) await db.settings.put({ key: 'active-account-id', value: next.id })
  else await db.settings.delete('active-account-id')
}

function rescopeBackupForIndependentRestore(
  backup: AccountBackup,
  accountId: string,
  displayName: string,
  now: Date,
): AccountBackup {
  const scoped = <T extends { id: string; accountId: string; scopedId: string }>(items: T[]) =>
    items.map((item) => ({ ...item, accountId, scopedId: getScopedId(accountId, item.id) }))
  const preferences = backup.data.preferences.map((item) => ({
    ...item,
    accountId,
    scopedId: getScopedId(accountId, item.key),
  }))
  return {
    ...backup,
    account: {
      ...backup.account,
      id: accountId,
      displayName,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      isDefault: false,
      source: 'backup_restore',
    },
    data: {
      ...backup.data,
      driveDiscs: scoped(backup.data.driveDiscs),
      discEvaluations: scoped(backup.data.discEvaluations),
      scanBatches: scoped(backup.data.scanBatches),
      scanItems: scoped(backup.data.scanItems),
      optimizationResults: scoped(backup.data.optimizationResults),
      preferences,
      planningDrafts: scoped(backup.data.planningDrafts),
    },
  }
}

/**
 * Restores a backup whose stable ID is not present locally as an explicitly separate account.
 * This deliberately never matches or overwrites by display name.
 */
export async function restoreAccountBackupIndependently(
  input: unknown,
  options: { accountId?: string; displayName?: string; now?: Date } = {},
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  const preflight = preflightAccountBackup(input)
  if (!preflight.success || !preflight.backup) {
    throw new Error(preflight.errors[0] ?? '账号备份预检失败。')
  }
  const accountId = accountIdSchema.parse(options.accountId ?? `account-${crypto.randomUUID()}`)
  const displayName = (
    options.displayName ?? `${preflight.backup.account.displayName}（恢复副本）`
  ).trim()
  if (!displayName || displayName.length > 40) throw new Error('恢复副本名称无效。')
  const restored = rescopeBackupForIndependentRestore(
    preflight.backup,
    accountId,
    displayName,
    options.now ?? new Date(),
  )
  await db.transaction('rw', accountTables(db), async () => {
    // The preview is advisory. Recheck both identities under the same lock as replacement.
    if (await db.accounts.get(preflight.backup!.account.id))
      throw new Error('该备份的稳定账号已存在；请使用完整替换确认，而不是创建副本。')
    if (await db.accounts.get(accountId)) throw new Error('恢复副本标识已存在，请重新确认。')
    await replaceAccountBackupData(restored, db)
    await selectRestoredActiveAccount(accountId, db)
    beforeCommit?.()
  })
  return { account: restored.account, counts: restored.counts }
}

export async function createVaultBackup(
  db: SodaDatabase = database,
  now = new Date(),
): Promise<VaultBackup> {
  return db.transaction('r', accountTables(db), async () => {
    const accounts = await db.accounts.toArray()
    const backups = await Promise.all(
      accounts.map((account) => createAccountBackup(account.id, db, now)),
    )
    return vaultBackupSchema.parse({
      format: vaultBackupFormat,
      formatVersion: vaultBackupFormatVersion,
      exportedAt: now.toISOString(),
      databaseSchemaVersion,
      accounts: backups,
    })
  })
}

export async function restoreVaultBackup(
  input: unknown,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
  expectedAccounts?: Array<{ id: string; displayName: string }>,
) {
  const preflight = preflightVaultBackup(input)
  if (!preflight.success || !preflight.backup) {
    throw new Error(preflight.errors[0] ?? '保险库备份预检失败。')
  }
  const activeAccount =
    preflight.backup.accounts.find(
      (backup) => backup.account.status === 'active' && backup.account.isDefault,
    )?.account ??
    preflight.backup.accounts.find((backup) => backup.account.status === 'active')?.account ??
    null
  await db.transaction('rw', accountTables(db), async () => {
    if (expectedAccounts) {
      const identity = (items: Array<{ id: string; displayName: string }>) =>
        JSON.stringify(
          items
            .map(({ id, displayName }) => ({ id, displayName }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        )
      if (identity(await db.accounts.toArray()) !== identity(expectedAccounts))
        throw new Error('本机账户范围已变化，请重新检查保险库并明确确认。')
    }
    if (await db.accounts.count())
      await saveRestoreRecovery(await createVaultBackup(db), '全部账户保险库', db)
    await Promise.all(
      accountTables(db)
        .filter((table) => table !== db.settings)
        .map((table) => table.clear()),
    )
    // Only the active-account pointer belongs to the restored vault. Application
    // settings and the legacy single-account roster are outside its data scope.
    await db.settings.delete('active-account-id')
    for (const account of preflight.backup!.accounts) await replaceAccountBackupData(account, db)
    if (activeAccount) await db.settings.put({ key: 'active-account-id', value: activeAccount.id })
    beforeCommit?.()
  })
  return preflight.backup.accounts.length
}

export function getAccountBackupFilename(accountId: string, date = new Date()) {
  return `soda-terminal-account-${accountId}-${date.toISOString().slice(0, 10)}.json`
}

export function getVaultBackupFilename(date = new Date()) {
  return `soda-terminal-vault-${date.toISOString().slice(0, 10)}.json`
}

export function createEmptyPreference(accountId: string, key: string, value: unknown, now: string) {
  return {
    scopedId: getScopedId(accountId, key),
    accountId,
    key,
    value,
    updatedAt: now,
  } satisfies AccountPreference
}
