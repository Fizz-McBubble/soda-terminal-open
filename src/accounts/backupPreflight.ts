import { database, type SodaDatabase } from '../db/databaseCore'
import {
  accountBackupSchema,
  vaultBackupSchema,
  type AccountBackup,
  type AccountBackupIdentity,
  type AccountBackupPreflight,
} from './backupSchemas'
import { resolvePlanningDiscReferences } from './planningDiscReferences'
import { validateTeamPortfolioPlanningDraft } from './teamPortfolioPlanning'
import { getScopedId } from './types'

export function duplicateIds(items: Array<{ scopedId: string }>) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    if (seen.has(item.scopedId)) duplicates.add(item.scopedId)
    seen.add(item.scopedId)
  }
  return [...duplicates]
}

export function getCounts(data: AccountBackup['data']): AccountBackup['counts'] {
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
  const liveDiscIds = new Set(backup.data.driveDiscs.map((item) => item.id))
  const discIds = new Set([
    ...liveDiscIds,
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
      // Only live discs are restored into the warehouse; archived records are history only.
      if (!liveDiscIds.has(discId)) errors.push('一位代理人的当前装备不在该备份范围内。')
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
    risks: [
      ...preflight.risks,
      ...(existing ? ['恢复前将自动保存目标账户的完整恢复副本，可在账户与备份下载。'] : []),
    ],
  }
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
  if (!preflight.backup) return { ...preflight, conflicts: [], affectedAccounts: [] }
  const existing = await db.accounts.toArray()
  const existingIds = new Set(existing.map((account) => account.id))
  const incomingIds = new Set(preflight.backup.accounts.map((item) => item.account.id))
  const conflicts = preflight.backup.accounts
    .filter((account) => existingIds.has(account.account.id))
    .map(
      (account) =>
        `账号 ${account.account.displayName}（${account.account.id}）已存在；确认后保险库恢复将替换它。`,
    )
  const removed = existing.filter((account) => !incomingIds.has(account.id))
  return {
    ...preflight,
    conflicts: [
      ...conflicts,
      ...removed.map(
        (account) =>
          `账户“${account.displayName}”（${account.id}）不在此备份中；恢复会移除它，完整资料将保存在恢复前副本中。`,
      ),
    ],
    affectedAccounts: existing.map((account) => ({
      id: account.id,
      displayName: account.displayName,
      action: incomingIds.has(account.id) ? ('replace' as const) : ('remove' as const),
    })),
    risks: [...preflight.risks, '恢复前将自动保存本机全部账户的完整副本，可在账户与备份下载。'],
  }
}
