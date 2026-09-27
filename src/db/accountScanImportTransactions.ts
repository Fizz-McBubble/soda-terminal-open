import { database, type SodaDatabase } from './databaseCore'
import { assertActiveAccountScope, assertReadyScanReview } from './accountScanImportScope'
import { warehouseFactHash, reconcileAccountReplacementDiscs } from './discReplacementFacts'
import { preflightDriveDiscImport } from '../domain/discImport'
import {
  createStandardImportFromStaging,
  refreshScanBatchManifestPayloadHash,
  resolveScanBatchManifest,
  scanImportStagingBatchSchema,
  summarizeScanImportItems,
  type ScanImportAssessmentContext,
} from '../domain/scanImportStaging'
import { driveDiscSchema } from '../domain/schemas'
import { getScopedId } from '../accounts/types'

export async function stageAccountPaddleScanImport(
  accountId: string,
  input: unknown,
  db: SodaDatabase = database,
) {
  const parsed = scanImportStagingBatchSchema.parse(input)
  const summary = summarizeScanImportItems(parsed.items)
  if (!/paddle/i.test(parsed.batch.recognitionVersion))
    throw new Error('正式识别结果必须由 PaddleOCR 生成。')
  const resolved = resolveScanBatchManifest(parsed.batch, parsed.items, { allowLegacy343: true })
  const normalizedBatch = { ...parsed.batch, manifest: resolved.manifest }
  return db.transaction(
    'rw',
    [db.settings, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const existing = await db.accountScanImportBatches
        .where('[accountId+id]')
        .equals([accountId, parsed.batch.id])
        .first()
      const existingItems = await db.accountScanImportItems
        .where('[accountId+batchId]')
        .equals([accountId, parsed.batch.id])
        .toArray()
      if (
        existing &&
        (() => {
          try {
            resolveScanBatchManifest(existing, existingItems, { allowLegacy343: true })
            return true
          } catch {
            return false
          }
        })()
      )
        return { staged: false, batch: existing, summary: summarizeScanImportItems(existingItems) }
      if (existing || existingItems.length)
        throw new Error('当前账户已有不完整的同源识别结果，未覆盖。')
      const now = new Date().toISOString()
      const scope = (id: string) => ({
        scopedId: getScopedId(accountId, id),
        accountId,
        sourceLegacyId: null,
        migratedAt: null,
      })
      const batch = {
        ...normalizedBatch,
        updatedAt: now,
        reviewState: {
          revision: 0,
          preflight: 'stale' as const,
          preflightRevision: null,
          armedRevision: null,
        },
        ...scope(parsed.batch.id),
      }
      await db.accountScanImportBatches.add(batch)
      await db.accountScanImportItems.bulkAdd(
        parsed.items.map((item) => ({ ...item, ...scope(item.id) })),
      )
      return { staged: true, batch, summary }
    },
  )
}

export async function importReadyAccountScanStaging(
  accountId: string,
  batchId: string,
  context: ScanImportAssessmentContext & { gameDataVersion: string; now?: string },
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  return db.transaction(
    'rw',
    [db.settings, db.accountDriveDiscs, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const [batch, items, existingDiscs] = await Promise.all([
        db.accountScanImportBatches.where('[accountId+id]').equals([accountId, batchId]).first(),
        db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batchId])
          .toArray(),
        db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
      ])
      if (!batch) throw new Error('当前账号中不存在该复核批次。')
      if (existingDiscs.length !== 0)
        throw new Error('目标账号正式驱动盘仓库不是空的，未执行导入。')
      const manifest = assertReadyScanReview(batch, items, {
        requireArmed: true,
        errorMessage: () => '扫描复核尚未完成独立重新预检与导入确认。',
      })

      const standardInput = createStandardImportFromStaging(batch, items)
      const preflight = preflightDriveDiscImport(standardInput, {
        driveDiscSets: context.driveDiscSets,
        driveDiscSetIdentities: context.driveDiscSetIdentities,
        driveDiscRules: context.rules,
        gameDataVersion: context.gameDataVersion,
        existingDiscs,
        now: context.now,
        batchId,
      })
      if (
        preflight.summary.ready !== manifest.expectedTotal ||
        preflight.summary.skipped ||
        preflight.summary.failed ||
        preflight.readyDiscs.length !== manifest.expectedTotal
      )
        throw new Error(
          `账号范围的正式导入复检未达到 ${manifest.expectedTotal} 条可导入，事务未写入。`,
        )

      await db.accountDriveDiscs.bulkAdd(
        preflight.readyDiscs.map((disc) => ({
          ...disc,
          scopedId: getScopedId(accountId, disc.id),
          accountId,
          sourceLegacyId: null,
          migratedAt: null,
        })),
      )
      const importedAt = context.now ?? new Date().toISOString()
      const importedItems = items.map((item) => ({
        ...item,
        state: 'imported' as const,
        updatedAt: importedAt,
      }))
      await db.accountScanImportItems.bulkPut(importedItems)
      await db.accountScanImportBatches.put({
        ...batch,
        manifest:
          batch.manifest?.schemaVersion === 2
            ? refreshScanBatchManifestPayloadHash(batch, importedItems)
            : batch.manifest,
        updatedAt: importedAt,
        importHistory: [
          ...(batch.importHistory ?? []),
          {
            action: 'imported',
            at: importedAt,
            importedCount: manifest.expectedTotal,
            skippedCount: 0,
          },
        ],
      })
      const finalCount = await db.accountDriveDiscs.where('accountId').equals(accountId).count()
      if (finalCount !== manifest.expectedTotal)
        throw new Error('账号正式仓库数量校验失败，事务已回滚。')
      beforeCommit?.()
      return {
        accountId,
        batchId,
        total: finalCount,
        imported: manifest.expectedTotal,
        skipped: 0,
      }
    },
  )
}

/**
 * The explicit confirmation path for a prepared manifest-complete batch. This is kept
 * separate from the empty-account import so a caller cannot accidentally turn
 * an ordinary preflight into an account replacement.
 */
export async function replaceReadyAccountScanStaging(
  accountId: string,
  batchId: string,
  context: ScanImportAssessmentContext & { gameDataVersion: string; now?: string },
  confirmation: 'replace_current_account_discs',
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  if (confirmation !== 'replace_current_account_discs')
    throw new Error('必须先明确确认替换当前账户的正式驱动盘。')
  return db.transaction(
    'rw',
    [db.settings, db.accountDriveDiscs, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const [batch, items, existingDiscs] = await Promise.all([
        db.accountScanImportBatches.where('[accountId+id]').equals([accountId, batchId]).first(),
        db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batchId])
          .toArray(),
        db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
      ])
      if (!batch) throw new Error('当前账号中不存在该复核批次。')
      const manifest = assertReadyScanReview(batch, items, {
        requireArmed: true,
        errorMessage: () => '扫描复核尚未完成独立重新预检与导入确认。',
      })

      if (batch.reviewState.warehouseFactHash !== warehouseFactHash(existingDiscs))
        throw new Error('仓库已更新，请重新检查本次扫描结果。')

      const standardInput = createStandardImportFromStaging(batch, items)
      const preflight = preflightDriveDiscImport(standardInput, {
        driveDiscSets: context.driveDiscSets,
        driveDiscSetIdentities: context.driveDiscSetIdentities,
        driveDiscRules: context.rules,
        gameDataVersion: context.gameDataVersion,
        existingDiscs: [],
        now: context.now,
        batchId,
      })
      if (
        preflight.summary.ready !== manifest.expectedTotal ||
        preflight.summary.skipped ||
        preflight.summary.failed ||
        preflight.readyDiscs.length !== manifest.expectedTotal
      )
        throw new Error(`正式导入复检未达到 ${manifest.expectedTotal} 条可导入，事务未写入。`)

      const { discs: replacementDiscs, preservedMetadata } = reconcileAccountReplacementDiscs(
        preflight.readyDiscs,
        existingDiscs,
      )
      if (new Set(replacementDiscs.map((disc) => disc.id)).size !== manifest.expectedTotal)
        throw new Error('稳定身份回接产生重复驱动盘 ID，事务未写入。')

      const replacementIds = new Set(replacementDiscs.map((disc) => disc.id))
      const replacedDiscs = existingDiscs
        .filter((disc) => !replacementIds.has(disc.id))
        .map((disc) => driveDiscSchema.parse(disc))

      await db.accountDriveDiscs.where('accountId').equals(accountId).delete()
      await db.accountDriveDiscs.bulkAdd(
        replacementDiscs.map((disc) => ({
          ...disc,
          scopedId: getScopedId(accountId, disc.id),
          accountId,
          sourceLegacyId: null,
          migratedAt: null,
        })),
      )
      const importedAt = context.now ?? new Date().toISOString()
      const importedItems = items.map((item) => ({
        ...item,
        state: 'imported' as const,
        updatedAt: importedAt,
      }))
      await db.accountScanImportItems.bulkPut(importedItems)
      await db.accountScanImportBatches.put({
        ...batch,
        replacedDiscs: [...(batch.replacedDiscs ?? []), ...replacedDiscs],
        manifest:
          batch.manifest?.schemaVersion === 2
            ? refreshScanBatchManifestPayloadHash(batch, importedItems)
            : batch.manifest,
        updatedAt: importedAt,
        importHistory: [
          ...(batch.importHistory ?? []),
          {
            action: 'imported',
            at: importedAt,
            importedCount: manifest.expectedTotal,
            skippedCount: 0,
          },
        ],
      })
      const finalCount = await db.accountDriveDiscs.where('accountId').equals(accountId).count()
      if (finalCount !== manifest.expectedTotal)
        throw new Error('账号正式仓库数量校验失败，事务已回滚。')
      beforeCommit?.()
      return {
        accountId,
        batchId,
        previous: existingDiscs.length,
        total: finalCount,
        imported: manifest.expectedTotal,
        preservedMetadata,
      }
    },
  )
}
