import type {
  AccountDriveDisc,
  AccountRosterRecord,
  AccountScanImportBatch,
  AccountScanImportItem,
} from '../accounts/types'
import { accountIdSchema, getScopedId } from '../accounts/types'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { contentHash, sha256 } from '../application/contentHash'
import {
  refreshScanBatchManifestPayloadHash,
  resolveScanBatchManifest,
  summarizeScanImportItems,
} from '../domain/scanImportStaging'
import { driveDiscSchema } from '../domain/schemas'
import { driveDiscFactIdentity } from './discReplacementFacts'
import { database, type SodaDatabase } from './databaseCore'
import { assertActiveAccountScope } from './accountScanImportScope'

const scannerImportRecoveryPrefix = 'scanner-import-recovery-'
const scannerImportRecoveryKeyPattern = /^scanner-import-recovery-[a-f0-9]{64}$/

export type ScannerImportAccountFacts = {
  discs: AccountDriveDisc[]
  roster: AccountRosterRecord | null
}

export type ScannerImportRecovery = {
  format: 'soda-scanner-import-recovery'
  schemaVersion: 1
  accountId: string
  batchId: string
  mode: 'empty_account' | 'replace'
  createdAt: string
  before: ScannerImportAccountFacts
  after: ScannerImportAccountFacts
  beforeHash: string
  afterHash: string
  batchHash: string
  itemsHash: string
  restoredAt?: string
}

export type ScannerImportRecoverySummary = {
  recoveryKey: string
  createdAt: string
  canRestore: boolean
  unavailableReason?: string
}

function sortedDiscs(discs: AccountDriveDisc[]) {
  return [...discs].sort(
    (left, right) => left.scopedId.localeCompare(right.scopedId) || left.id.localeCompare(right.id),
  )
}

export function scannerImportFactsHash(facts: ScannerImportAccountFacts) {
  return contentHash({
    discs: sortedDiscs(facts.discs),
    roster: facts.roster ?? null,
  })
}

export function scannerImportBatchHash(batch: AccountScanImportBatch) {
  return contentHash(batch)
}

export function scannerImportItemsHash(items: AccountScanImportItem[]) {
  return contentHash(
    [...items].sort(
      (left, right) =>
        left.scopedId.localeCompare(right.scopedId) || left.id.localeCompare(right.id),
    ),
  )
}

function hasAccountDiscScope(disc: AccountDriveDisc, accountId: string) {
  return disc.accountId === accountId && disc.scopedId === getScopedId(accountId, disc.id)
}

export function validScannerImportRecovery(
  value: unknown,
  accountId: string,
): value is ScannerImportRecovery {
  if (!value || typeof value !== 'object') return false
  const recovery = value as Partial<ScannerImportRecovery>
  if (
    recovery.format !== 'soda-scanner-import-recovery' ||
    recovery.schemaVersion !== 1 ||
    recovery.accountId !== accountId ||
    typeof recovery.batchId !== 'string' ||
    !recovery.batchId ||
    (recovery.mode !== 'empty_account' && recovery.mode !== 'replace') ||
    typeof recovery.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(recovery.createdAt)) ||
    typeof recovery.beforeHash !== 'string' ||
    typeof recovery.afterHash !== 'string' ||
    typeof recovery.batchHash !== 'string' ||
    typeof recovery.itemsHash !== 'string' ||
    !recovery.before ||
    !recovery.after ||
    !Array.isArray(recovery.before.discs) ||
    !Array.isArray(recovery.after.discs) ||
    (recovery.before.roster !== null && recovery.before.roster?.accountId !== accountId) ||
    (recovery.after.roster !== null && recovery.after.roster?.accountId !== accountId)
  )
    return false
  try {
    const beforeDiscsValid = recovery.before.discs.every(
      (disc) => driveDiscSchema.safeParse(disc).success && hasAccountDiscScope(disc, accountId),
    )
    const afterDiscsValid = recovery.after.discs.every(
      (disc) => driveDiscSchema.safeParse(disc).success && hasAccountDiscScope(disc, accountId),
    )
    return (
      beforeDiscsValid &&
      afterDiscsValid &&
      scannerImportFactsHash(recovery.before) === recovery.beforeHash &&
      scannerImportFactsHash(recovery.after) === recovery.afterHash
    )
  } catch {
    return false
  }
}

export async function readScannerImportFacts(
  accountId: string,
  db: SodaDatabase,
): Promise<ScannerImportAccountFacts> {
  const [discs, roster] = await Promise.all([
    db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
    db.accountRosters.get(accountId),
  ])
  return { discs, roster: roster ?? null }
}

async function assertScannerImportScope(accountId: string, db: SodaDatabase) {
  accountIdSchema.parse(accountId)
  const account = await db.accounts.get(accountId)
  if (!account || account.status !== 'active') throw new Error('扫描恢复目标账户已不存在或已归档。')
  await assertActiveAccountScope(accountId, db)
}

function recoveryKeyFor(accountId: string, batchId: string, createdAt: string) {
  return `${scannerImportRecoveryPrefix}${sha256(
    JSON.stringify({ accountId, batchId, createdAt, nonce: crypto.randomUUID() }),
  )}`
}

export async function saveScannerImportRecovery(
  accountId: string,
  batchId: string,
  mode: ScannerImportRecovery['mode'],
  before: ScannerImportAccountFacts,
  createdAt: string,
  db: SodaDatabase,
) {
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('扫描导入时间无效，恢复副本未写入。')
  const [after, batch, items] = await Promise.all([
    readScannerImportFacts(accountId, db),
    db.accountScanImportBatches.where('[accountId+id]').equals([accountId, batchId]).first(),
    db.accountScanImportItems.where('[accountId+batchId]').equals([accountId, batchId]).toArray(),
  ])
  if (!batch) throw new Error('扫描导入批次在事务内消失，恢复副本未写入。')
  if (contentHash(before.roster ?? null) !== contentHash(after.roster ?? null))
    throw new Error('扫描导入不应修改账户 roster，事务已回滚。')
  if (
    before.discs.some((disc) => !hasAccountDiscScope(disc, accountId)) ||
    after.discs.some((disc) => !hasAccountDiscScope(disc, accountId))
  )
    throw new Error('扫描导入恢复副本账户范围不一致，事务已回滚。')

  const recoveryKey = recoveryKeyFor(accountId, batchId, createdAt)
  const recovery: ScannerImportRecovery = {
    format: 'soda-scanner-import-recovery',
    schemaVersion: 1,
    accountId,
    batchId,
    mode,
    createdAt,
    before: {
      discs: sortedDiscs(before.discs),
      roster: before.roster,
    },
    after: {
      discs: sortedDiscs(after.discs),
      roster: after.roster,
    },
    beforeHash: scannerImportFactsHash(before),
    afterHash: scannerImportFactsHash(after),
    batchHash: scannerImportBatchHash(batch),
    itemsHash: scannerImportItemsHash(items),
  }
  if (!validScannerImportRecovery(recovery, accountId))
    throw new Error('扫描导入恢复副本自校验失败，事务已回滚。')
  await db.accountPreferences.add({
    scopedId: getScopedId(accountId, recoveryKey),
    accountId,
    key: recoveryKey,
    value: recovery,
    updatedAt: createdAt,
  })
  return recoveryKey
}

async function scannerImportRecoveryUnavailableReason(
  accountId: string,
  recovery: ScannerImportRecovery,
  db: SodaDatabase,
) {
  if (recovery.restoredAt) return '这次扫描导入已恢复，恢复副本继续保留。'

  const current = await readScannerImportFacts(accountId, db)
  const currentHash = scannerImportFactsHash(current)
  if (currentHash !== recovery.afterHash)
    return currentHash === recovery.beforeHash
      ? '当前仓库已处于这次扫描导入前的状态，导入完成证明无法继续撤销。'
      : '扫描导入后账户已有其他修改，恢复副本保留，不能直接覆盖。'

  const [batch, items] = await Promise.all([
    db.accountScanImportBatches
      .where('[accountId+id]')
      .equals([accountId, recovery.batchId])
      .first(),
    db.accountScanImportItems
      .where('[accountId+batchId]')
      .equals([accountId, recovery.batchId])
      .toArray(),
  ])
  if (
    !batch ||
    scannerImportBatchHash(batch) !== recovery.batchHash ||
    scannerImportItemsHash(items) !== recovery.itemsHash ||
    items.some((item) => item.state !== 'imported') ||
    (batch.importHistory ?? []).filter((event) => event.action === 'imported').at(-1)?.at !==
      (items
        .map((item) => item.updatedAt)
        .sort()
        .at(-1) ?? '')
  )
    return '该扫描批次的导入记录已变化，恢复副本保留，不能直接撤销。'

  const previousById = new Map(recovery.before.discs.map((disc) => [disc.id, disc]))
  const affectedIds = new Set(
    current.discs
      .filter((disc) => {
        const previous = previousById.get(disc.id)
        return !previous || driveDiscFactIdentity(previous) !== driveDiscFactIdentity(disc)
      })
      .map((disc) => disc.id),
  )
  if (!affectedIds.size) return

  const equippedIds = new Set(
    current.roster?.roster.agents.flatMap((agent) => agent.equippedDiscIds ?? []) ?? [],
  )
  if ([...affectedIds].some((id) => equippedIds.has(id)))
    return '本次扫描导入的驱动盘已被代理人装备。请先调整当前装备，再尝试恢复；当前资产和恢复副本均保留。'

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

/** Discovery and validation are read-only; only restoreScannerImport may write. */
export function readLatestScannerImportRecovery(
  accountId: string,
  db: SodaDatabase = database,
): Promise<ScannerImportRecoverySummary | null> {
  return db.transaction(
    'r',
    [
      db.accounts,
      db.settings,
      db.accountDriveDiscs,
      db.accountRosters,
      db.accountPreferences,
      db.accountPlanningDrafts,
      db.accountScanImportBatches,
      db.accountScanImportItems,
    ],
    async () => {
      await assertScannerImportScope(accountId, db)
      const saved = (await db.accountPreferences.where('accountId').equals(accountId).toArray())
        .filter(
          (row) =>
            scannerImportRecoveryKeyPattern.test(row.key) &&
            row.scopedId === getScopedId(accountId, row.key) &&
            validScannerImportRecovery(row.value, accountId),
        )
        .sort(
          (left, right) =>
            Date.parse((right.value as ScannerImportRecovery).createdAt) -
              Date.parse((left.value as ScannerImportRecovery).createdAt) ||
            right.key.localeCompare(left.key),
        )[0]
      if (!saved) return null
      const recovery = saved.value as ScannerImportRecovery
      const unavailableReason = await scannerImportRecoveryUnavailableReason(
        accountId,
        recovery,
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

export function restoreScannerImport(
  accountId: string,
  recoveryKey: string,
  confirmation: 'undo_scanner_import',
  db: SodaDatabase = database,
): Promise<{ accountId: string; restoredDiscs: number }> {
  if (confirmation !== 'undo_scanner_import') throw new Error('必须先明确确认撤销这次扫描导入。')
  if (!scannerImportRecoveryKeyPattern.test(recoveryKey))
    throw new Error('扫描导入恢复副本标识无效。')
  return db.transaction(
    'rw',
    [
      db.accounts,
      db.settings,
      db.accountDriveDiscs,
      db.accountRosters,
      db.accountPreferences,
      db.accountPlanningDrafts,
      db.accountScanImportBatches,
      db.accountScanImportItems,
    ],
    async () => {
      await assertScannerImportScope(accountId, db)
      const stored = await db.accountPreferences.get(getScopedId(accountId, recoveryKey))
      if (
        !stored ||
        stored.accountId !== accountId ||
        stored.key !== recoveryKey ||
        !validScannerImportRecovery(stored.value, accountId)
      )
        throw new Error('这次扫描导入的恢复副本不可用，未修改账户。')
      const recovery = stored.value
      const unavailableReason = await scannerImportRecoveryUnavailableReason(
        accountId,
        recovery,
        db,
      )
      if (unavailableReason) throw new Error(unavailableReason)

      const [batch, importedItems] = await Promise.all([
        db.accountScanImportBatches
          .where('[accountId+id]')
          .equals([accountId, recovery.batchId])
          .first(),
        db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, recovery.batchId])
          .toArray(),
      ])
      if (!batch) throw new Error('扫描导入批次已不可用，未修改账户。')
      const manifest = resolveScanBatchManifest(batch, importedItems, { allowLegacy343: true })
      const summary = summarizeScanImportItems(importedItems)
      if (summary.imported !== manifest.manifest.expectedTotal)
        throw new Error('扫描导入批次完成证明不一致，未修改账户。')

      const restoredAt = new Date().toISOString()
      await db.accountDriveDiscs.where('accountId').equals(accountId).delete()
      await db.accountDriveDiscs.bulkAdd(recovery.before.discs)

      const restoredItems = importedItems.map((item) => ({
        ...item,
        state: 'ready' as const,
        updatedAt: restoredAt,
      }))
      await db.accountScanImportItems.bulkPut(restoredItems)
      await db.accountScanImportBatches.put({
        ...batch,
        manifest:
          batch.manifest?.schemaVersion === 2
            ? refreshScanBatchManifestPayloadHash(batch, restoredItems)
            : batch.manifest,
        updatedAt: restoredAt,
        importHistory: [
          ...(batch.importHistory ?? []),
          {
            action: 'rolled_back',
            at: restoredAt,
            importedCount: manifest.manifest.expectedTotal,
            skippedCount: 0,
          },
        ],
        reviewState: {
          revision: batch.reviewState.revision + 1,
          preflight: 'stale',
          preflightRevision: null,
          armedRevision: null,
        },
      })
      if (
        scannerImportFactsHash(await readScannerImportFacts(accountId, db)) !== recovery.beforeHash
      )
        throw new Error('扫描导入恢复守恒校验失败，事务已回滚。')
      await db.accountPreferences.put({
        ...stored,
        value: { ...recovery, restoredAt },
        updatedAt: restoredAt,
      })
      return { accountId, restoredDiscs: recovery.before.discs.length }
    },
  )
}
