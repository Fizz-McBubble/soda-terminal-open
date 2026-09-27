import { resolvePlanningDiscReferences } from './planningDiscReferences'
import { restoreBackupRoster } from './restoreBackupRoster'
import { exportRosterSnapshot } from './publicRosterSnapshot'
import { database, databaseSchemaVersion, type SodaDatabase } from '../db/databaseCore'
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
import {
  accountBackupFormat,
  accountBackupFormatVersion,
  accountBackupSchema,
  vaultBackupFormat,
  vaultBackupFormatVersion,
  vaultBackupSchema,
  type AccountBackup,
  type AccountBackupIdentity,
  type AccountBackupPreflight,
  type VaultBackup,
} from './backupSchemas'
import { validateTeamPortfolioPlanningDraft } from './teamPortfolioPlanning'

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

function duplicateIds(items: Array<{ scopedId: string }>) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    if (seen.has(item.scopedId)) duplicates.add(item.scopedId)
    seen.add(item.scopedId)
  }
  return [...duplicates]
}

function getCounts(data: AccountBackup['data']): AccountBackup['counts'] {
  return {
    driveDiscs: data.driveDiscs.length,
    discEvaluations: data.discEvaluations.length,
    scanBatches: data.scanBatches.length,
    scanItems: data.scanItems.length,
    roster: data.roster ? 1 : 0,
    optimizationResults: data.optimizationResults.length,
    preferences: data.preferences.length,
    planningDrafts: data.planningDrafts.length,
  }
}

export function preflightAccountBackup(input: unknown): AccountBackupPreflight {
  const parsed = accountBackupSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      errors: [parsed.error.issues[0]?.message ?? '账号备份损坏或版本过新。'],
      conflicts: [],
      risks: [],
    }
  }
  const backup = parsed.data
  const errors: string[] = []
  const accountId = backup.account.id
  const collections = [
    ['驱动盘', backup.data.driveDiscs],
    ['鉴定历史', backup.data.discEvaluations],
    ['扫描批次', backup.data.scanBatches],
    ['扫描条目', backup.data.scanItems],
    ['配装结果', backup.data.optimizationResults],
    ['偏好', backup.data.preferences],
    ['已保存方案', backup.data.planningDrafts],
  ] as const
  for (const [label, items] of collections) {
    const duplicates = duplicateIds(items)
    if (duplicates.length) errors.push(`${label}包含重复记录，无法安全恢复。`)
    const crossAccount = items.find((item) => item.accountId !== accountId)
    if (crossAccount) errors.push(`${label}包含不属于该玩家账户的数据。`)
    const logicalIds = items.map((item) => ('id' in item ? item.id : item.key))
    if (new Set(logicalIds).size !== logicalIds.length)
      errors.push(`${label}包含重复身份，无法安全恢复。`)
    if (
      items.some(
        (item) => item.scopedId !== getScopedId(accountId, 'id' in item ? item.id : item.key),
      )
    )
      errors.push(`${label}的账户记录标识不一致，无法安全恢复。`)
  }
  // Historical references may outlive the live warehouse, but must still have a saved record.
  // These archived discs are deliberately not restored into accountDriveDiscs or solver inputs.
  const discIds = new Set([
    ...backup.data.driveDiscs.map((item) => item.id),
    ...backup.data.scanBatches.flatMap((batch) =>
      (batch.replacedDiscs ?? []).map((disc) => disc.id),
    ),
  ])
  const batchIds = new Set(backup.data.scanBatches.map((item) => item.id))
  for (const evaluation of backup.data.discEvaluations) {
    if (!discIds.has(evaluation.discId)) errors.push('一条驱动盘评价缺少对应的驱动盘记录。')
  }
  for (const item of backup.data.scanItems) {
    if (!batchIds.has(item.batchId)) errors.push('一条扫描暂存记录缺少对应批次。')
  }
  for (const agent of backup.data.roster?.agents ?? []) {
    for (const discId of agent.equippedDiscIds ?? []) {
      if (!discIds.has(discId)) errors.push('一位代理人的当前装备不在该备份范围内。')
    }
  }
  const planningDiscIds = backup.data.planningDrafts.flatMap(
    (draft) => resolvePlanningDiscReferences(draft).referenceIds,
  )
  if (planningDiscIds.some((discId) => !discIds.has(discId))) {
    errors.push('一份已保存方案引用了备份范围外的驱动盘。')
  }
  for (const draft of backup.data.planningDrafts) {
    if (!draft.teamPortfolioSnapshot) continue
    const validation = validateTeamPortfolioPlanningDraft(draft)
    if (!validation.valid) errors.push(`一份多队已保存方案无效：${validation.errors.join('；')}`)
  }
  if (JSON.stringify(getCounts(backup.data)) !== JSON.stringify(backup.counts)) {
    errors.push('账号备份声明数量与实际内容不一致。')
  }
  return {
    success: errors.length === 0,
    backup: errors.length === 0 ? backup : undefined,
    errors,
    conflicts: [],
    risks: ['恢复会替换目标账号的作用域数据，但不会影响其他账号、旧单账号表或游戏数据包。'],
  }
}

export async function preflightAccountBackupAgainstDatabase(
  input: unknown,
  db: SodaDatabase = database,
) {
  const preflight = preflightAccountBackup(input)
  if (!preflight.backup) return preflight
  const accountId = preflight.backup.account.id
  const existing = await db.accounts.get(accountId)
  const sameName = await db.accounts
    .filter(
      (account) =>
        account.id !== accountId &&
        account.status === 'active' &&
        account.displayName.toLocaleLowerCase() ===
          preflight.backup!.account.displayName.toLocaleLowerCase(),
    )
    .toArray()
  const identity: AccountBackupIdentity = existing
    ? 'same_id'
    : sameName.length
      ? 'same_name_different_id'
      : 'new_account'
  return {
    ...preflight,
    identity,
    conflicts: existing
      ? [`玩家账户“${existing.displayName}”已存在；确认后将完整替换该账户的数据范围。`]
      : sameName.length
        ? [`本机已有同名玩家账户；此备份会作为独立账户恢复，不会合并或覆盖现有账户。`]
        : [],
  }
}

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
) {
  const preflight = preflightAccountBackup(input)
  if (!preflight.success || !preflight.backup) {
    throw new Error(preflight.errors[0] ?? '账号备份预检失败。')
  }
  await db.transaction('rw', accountTables(db), async () => {
    await replaceAccountBackupData(preflight.backup!, db)
    await db.settings.put({ key: 'active-account-id', value: preflight.backup!.account.id })
    beforeCommit?.()
  })
  return preflight.backup.counts
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
    await db.settings.put({ key: 'active-account-id', value: accountId })
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

export function preflightVaultBackup(input: unknown) {
  const parsed = vaultBackupSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, backup: undefined, errors: ['保险库备份损坏或版本过新。'], risks: [] }
  }
  const accountIds = parsed.data.accounts.map((item) => item.account.id)
  const duplicateAccounts = accountIds.filter((id, index) => accountIds.indexOf(id) !== index)
  const errors = [...new Set(duplicateAccounts)].map((id) => `保险库包含重复账号：${id}`)
  if (parsed.data.accounts.filter((account) => account.account.isDefault).length > 1) {
    errors.push('保险库不能包含多个默认账号。')
  }
  for (const account of parsed.data.accounts) errors.push(...preflightAccountBackup(account).errors)
  return {
    success: errors.length === 0,
    backup: errors.length === 0 ? parsed.data : undefined,
    errors,
    risks: ['完整保险库恢复会替换全部账号作用域数据；旧单账号表和游戏数据包不受影响。'],
  }
}

export async function preflightVaultBackupAgainstDatabase(
  input: unknown,
  db: SodaDatabase = database,
) {
  const preflight = preflightVaultBackup(input)
  if (!preflight.backup) return { ...preflight, conflicts: [] }
  const existingIds = new Set((await db.accounts.toArray()).map((account) => account.id))
  const conflicts = preflight.backup.accounts
    .filter((account) => existingIds.has(account.account.id))
    .map(
      (account) =>
        `账号 ${account.account.displayName}（${account.account.id}）已存在；确认后保险库恢复将替换它。`,
    )
  return { ...preflight, conflicts }
}

export async function restoreVaultBackup(
  input: unknown,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
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
