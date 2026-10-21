import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import type { AccountDriveDisc, AccountRosterRecord } from '../accounts/types'
import { accountIdSchema, getScopedId } from '../accounts/types'
import { contentHash } from '../application/contentHash'
import { assertActiveAccountScope } from '../db/accountScanImportScope'
import { database, type SodaDatabase } from '../db/databaseCore'
import { driveDiscFactIdentity } from '../db/discReplacementFacts'
import { driveDiscSchema } from '../domain/schemas'
import { AssetQuickReadImportError } from './importErrors'

export type AccountFacts = { discs: AccountDriveDisc[]; roster: AccountRosterRecord | null }
export type Recovery = {
  format: 'soda-asset-quick-read-recovery'
  schemaVersion: 1
  accountId: string
  createdAt: string
  before: AccountFacts
  beforeHash: string
  afterHash: string
  restoredAt?: string
}

export function factHash(facts: AccountFacts) {
  return contentHash({ ...facts, discs: [...facts.discs].sort((a, b) => a.id.localeCompare(b.id)) })
}

export function validRecovery(value: unknown, accountId: string): value is Recovery {
  if (!value || typeof value !== 'object') return false
  const recovery = value as Partial<Recovery>
  if (
    recovery.format !== 'soda-asset-quick-read-recovery' ||
    recovery.schemaVersion !== 1 ||
    recovery.accountId !== accountId ||
    typeof recovery.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(recovery.createdAt)) ||
    typeof recovery.beforeHash !== 'string' ||
    typeof recovery.afterHash !== 'string' ||
    !recovery.before ||
    !Array.isArray(recovery.before.discs) ||
    (recovery.before.roster !== null && recovery.before.roster?.accountId !== accountId)
  )
    return false
  try {
    return (
      recovery.before.discs.every(
        (disc) =>
          driveDiscSchema.safeParse(disc).success &&
          disc.accountId === accountId &&
          disc.scopedId === getScopedId(accountId, disc.id),
      ) && factHash(recovery.before) === recovery.beforeHash
    )
  } catch {
    return false
  }
}

export type AssetQuickReadRecoverySummary = {
  recoveryKey: string
  createdAt: string
  canRestore: boolean
  unavailableReason?: string
}

/** Discover only this active account's saved receipt; discovery never restores or writes. */
export function readLatestAssetQuickReadRecovery(
  accountId: string,
  db: SodaDatabase = database,
): Promise<AssetQuickReadRecoverySummary | null> {
  return db.transaction(
    'r',
    [
      db.accounts,
      db.settings,
      db.accountDriveDiscs,
      db.accountRosters,
      db.accountPreferences,
      db.accountPlanningDrafts,
    ],
    async () => {
      await assertScope(accountId, db)
      const saved = (await db.accountPreferences.where('accountId').equals(accountId).toArray())
        .filter(
          (row) =>
            /^asset-quick-read-recovery-[a-f0-9]{64}$/.test(row.key) &&
            row.scopedId === getScopedId(accountId, row.key) &&
            validRecovery(row.value, accountId),
        )
        .sort(
          (left, right) =>
            Date.parse((right.value as Recovery).createdAt) -
              Date.parse((left.value as Recovery).createdAt) || right.key.localeCompare(left.key),
        )[0]
      if (!saved) return null
      const recovery = saved.value as Recovery
      const unavailableReason = await recoveryUnavailableReason(
        accountId,
        recovery,
        await readFacts(accountId, db),
        db,
      )
      return {
        recoveryKey: saved.key,
        createdAt: recovery.createdAt,
        canRestore: unavailableReason === undefined,
        ...(unavailableReason ? { unavailableReason } : {}),
      }
    },
  )
}

export async function readFacts(accountId: string, db: SodaDatabase): Promise<AccountFacts> {
  return {
    discs: await db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
    roster: (await db.accountRosters.get(accountId)) ?? null,
  }
}

export async function assertScope(accountId: string, db: SodaDatabase) {
  accountIdSchema.parse(accountId)
  const account = await db.accounts.get(accountId)
  if (!account || account.status !== 'active')
    throw new AssetQuickReadImportError(
      'import_scope_changed',
      '资产快读目标账户已不存在或已归档。',
    )
  await assertActiveAccountScope(accountId, db)
}

export async function readPlanningDiscIds(accountId: string, db: SodaDatabase) {
  const drafts = await db.accountPlanningDrafts.where('accountId').equals(accountId).toArray()
  return new Set(drafts.flatMap((draft) => resolvePlanningDiscReferences(draft).referenceIds))
}

/** Shared by preview and commit, inside the transaction protecting both assets and plans. */
export async function recoveryUnavailableReason(
  accountId: string,
  recovery: Recovery,
  current: AccountFacts,
  db: SodaDatabase,
): Promise<string | undefined> {
  const currentHash = factHash(current)
  if (recovery.restoredAt || currentHash !== recovery.afterHash)
    return recovery.restoredAt || currentHash === recovery.beforeHash
      ? '这次资产快读导入已恢复，恢复副本继续保留。'
      : '导入后账户已有其他修改，恢复副本保留，不能直接覆盖；请通过账户备份单独恢复。'

  const previousById = new Map(recovery.before.discs.map((disc) => [disc.id, disc]))
  const affectedIds = new Set(
    current.discs
      .filter((disc) => {
        const previous = previousById.get(disc.id)
        return !previous || driveDiscFactIdentity(previous) !== driveDiscFactIdentity(disc)
      })
      .map((disc) => disc.id),
  )
  if (affectedIds.size === 0) return
  const drafts = await db.accountPlanningDrafts.where('accountId').equals(accountId).toArray()
  const affectedDrafts = drafts.filter((draft) =>
    resolvePlanningDiscReferences(draft).referenceIds.some((id) => affectedIds.has(id)),
  )
  if (affectedDrafts.length === 0) return
  const names = affectedDrafts
    .slice(0, 3)
    .map((draft) => `“${draft.name.trim() || '未命名规划'}”`)
    .join('、')
  const remaining = affectedDrafts.length > 3 ? `等 ${affectedDrafts.length} 个规划` : ''
  return `规划${names}${remaining}引用了本次恢复将移除或回滚属性的驱动盘。请先调整这些规划的用盘，再尝试恢复；当前资产、规划和恢复副本均保留。`
}
