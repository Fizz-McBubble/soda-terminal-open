import { database, type SodaDatabase } from './databaseCore'
import { assertActiveAccountScope, assertReadyScanReview } from './accountScanImportScope'
import { warehouseFactHash } from './discReplacementFacts'
import { isScanCalibrationField, validateScanReviewPatch } from '../domain/scanManualCalibration'
import {
  confirmScanImportItem,
  isLegacyScanImportBatch,
  reassessSavedScanImportItem,
  refreshScanBatchManifestPayloadHash,
  resolveScanBatchManifest,
  summarizeScanImportItems,
  type ScanImportAssessmentContext,
  type ScanImportReviewPatch,
} from '../domain/scanImportStaging'
import {
  getScopedId,
  type AccountScanImportBatch,
  type AccountScanImportItem,
} from '../accounts/types'

/**
 * A failed legacy handoff must never be silently overwritten. This bounded
 * recovery is intentionally limited to exactly one un-imported batch whose
 * manifest no longer validates; the caller must obtain an explicit player
 * confirmation before invoking it.
 */
export async function discardInvalidAccountScanStaging(
  accountId: string,
  db: SodaDatabase = database,
) {
  return db.transaction(
    'rw',
    [db.settings, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const batches = await db.accountScanImportBatches
        .where('accountId')
        .equals(accountId)
        .toArray()
      const invalid = [] as Array<{ id: string; itemCount: number }>
      for (const batch of batches) {
        const items = await db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batch.id])
          .toArray()
        let valid = true
        try {
          resolveScanBatchManifest(batch, items, { allowLegacy343: true })
        } catch {
          valid = false
        }
        if (!valid) {
          if (items.some((item) => item.state === 'imported') || batch.replacedDiscs?.length)
            throw new Error('不完整扫描草稿包含已导入记录，已拒绝清除。')
          invalid.push({ id: batch.id, itemCount: items.length })
        }
      }
      if (invalid.length !== 1)
        throw new Error(`只允许清除唯一的不完整扫描草稿；当前检测到 ${invalid.length} 份。`)
      const target = invalid[0]!
      await db.accountScanImportItems
        .where('[accountId+batchId]')
        .equals([accountId, target.id])
        .delete()
      await db.accountScanImportBatches.delete(getScopedId(accountId, target.id))
      return { batchId: target.id, itemCount: target.itemCount }
    },
  )
}

/**
 * Imports intentionally change every item's lifecycle state from ready to imported.
 * Older writes did not refresh the v2 payload hash afterwards, so an otherwise
 * complete imported batch can look corrupt on the next handoff. Repair only that
 * exact, fully-audited transition and preserve both the items and import history.
 */
export async function repairCompletedAccountScanStaging(
  accountId: string,
  db: SodaDatabase = database,
) {
  return db.transaction(
    'rw',
    [db.settings, db.accountDriveDiscs, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const [batches, formalCount] = await Promise.all([
        db.accountScanImportBatches.where('accountId').equals(accountId).toArray(),
        db.accountDriveDiscs.where('accountId').equals(accountId).count(),
      ])
      const repairable: Array<{
        batch: AccountScanImportBatch
        items: AccountScanImportItem[]
      }> = []
      for (const batch of batches) {
        if (batch.manifest?.schemaVersion !== 2) continue
        const items = await db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batch.id])
          .toArray()
        try {
          resolveScanBatchManifest(batch, items)
          continue
        } catch {
          // Continue only when the old hash validates after reversing the one
          // lifecycle-only mutation made by a successful formal import.
        }
        const expectedTotal = batch.manifest.expectedTotal
        const importedAudit = batch.importHistory
          .filter((event) => event.action === 'imported')
          .at(-1)
        if (
          items.length !== expectedTotal ||
          formalCount !== expectedTotal ||
          items.some((item) => item.state !== 'imported') ||
          importedAudit?.importedCount !== expectedTotal ||
          importedAudit?.skippedCount !== 0
        )
          continue
        try {
          resolveScanBatchManifest(
            batch,
            items.map((item) => ({ ...item, state: 'ready' as const })),
          )
        } catch {
          continue
        }
        repairable.push({ batch, items })
      }
      if (repairable.length !== 1)
        throw new Error(`只允许修复唯一的已完成扫描批次；当前检测到 ${repairable.length} 份。`)
      const target = repairable[0]!
      const repaired = {
        ...target.batch,
        manifest: refreshScanBatchManifestPayloadHash(target.batch, target.items),
      }
      await db.accountScanImportBatches.put(repaired)
      return {
        batchId: repaired.id,
        imported: target.items.length,
        formalCount,
      }
    },
  )
}

export async function reviewAccountScanImportItem(
  accountId: string,
  batchId: string,
  itemId: string,
  patch: ScanImportReviewPatch,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
  expectedRevision?: number,
  mode: 'issue_fields' | 'manual_calibration' = 'issue_fields',
) {
  return db.transaction(
    'rw',
    [db.settings, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const current = await db.accountScanImportItems.get(getScopedId(accountId, itemId))
      if (!current || current.batchId !== batchId) throw new Error('当前账号中不存在该复核记录。')
      if (current.state === 'imported') throw new Error('已导入记录不可再次修改。')
      if (mode === 'manual_calibration') {
        if (expectedRevision === undefined) throw new Error('人工校准必须提供当前复核版本。')
        if (current.state !== 'needs_review' && current.state !== 'invalid')
          throw new Error('人工校准仅适用于识别失败或待复核记录。')
        const activeBatch = await db.settings.get(`scanner-active-result-batch:${accountId}`)
        if (activeBatch && activeBatch.value !== batchId)
          throw new Error('当前扫描批次已变化，请重读后重新校准。')
        if (patch.lockState !== current.lockState) throw new Error('人工校准不可修改游戏锁定证据。')
      }
      const batch = await db.accountScanImportBatches
        .where('[accountId+id]')
        .equals([accountId, batchId])
        .first()
      if (!batch) throw new Error('当前账号中不存在该复核批次。')
      if (expectedRevision !== undefined && batch.reviewState.revision !== expectedRevision)
        throw new Error('复核草稿已被其他页面更新，请重读后重新确认。')
      if ((batch.manifest || isLegacyScanImportBatch(batch)) && !patch.fields?.length)
        throw new Error('完整复核批次必须明确记录本次确认的待复核字段。')
      const reviewableFields = new Set(
        current.issues.map((issue) =>
          issue.field === 'setId' ? 'setName' : issue.field.replace(/\.(stat|value|upgrades)$/, ''),
        ),
      )
      if (
        !patch.fields?.length ||
        patch.fields.some((field) =>
          mode === 'manual_calibration'
            ? !isScanCalibrationField(field, patch.candidate)
            : !reviewableFields.has(field),
        )
      )
        throw new Error('手动修正只能写入当前待复核字段。')
      validateScanReviewPatch(current, patch, true)
      const next = {
        ...confirmScanImportItem(current, patch, context, new Date().toISOString(), true),
        scopedId: current.scopedId,
        accountId: current.accountId,
        sourceLegacyId: current.sourceLegacyId,
        migratedAt: current.migratedAt,
      }
      let nextManifest = batch.manifest
      if (batch.manifest || isLegacyScanImportBatch(batch)) {
        const currentItems = await db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batchId])
          .toArray()
        const { manifest } = resolveScanBatchManifest(batch, currentItems, {
          allowLegacy343: true,
        })
        const nextItems = currentItems.map((item) => (item.id === next.id ? next : item))
        nextManifest = refreshScanBatchManifestPayloadHash({ ...batch, manifest }, nextItems)
      }
      await db.accountScanImportItems.put(next)
      await db.accountScanImportBatches.put({
        ...batch,
        manifest: nextManifest,
        updatedAt: new Date().toISOString(),
        reviewState: {
          revision: batch.reviewState.revision + 1,
          preflight: 'stale',
          preflightRevision: null,
          armedRevision: null,
        },
      })
      return next
    },
  )
}

export async function preflightAccountScanReviewBatch(
  accountId: string,
  batchId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
  expectedRevision?: number,
) {
  return db.transaction(
    'rw',
    [db.settings, db.accountDriveDiscs, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const batch = await db.accountScanImportBatches
        .where('[accountId+id]')
        .equals([accountId, batchId])
        .first()
      if (!batch) throw new Error('当前账号中不存在该复核批次。')
      if (expectedRevision !== undefined && batch.reviewState.revision !== expectedRevision)
        throw new Error('复核草稿已被其他页面更新，请重读后重新预检。')
      const items = await db.accountScanImportItems
        .where('[accountId+batchId]')
        .equals([accountId, batchId])
        .toArray()
      const { manifest: currentManifest } = resolveScanBatchManifest(batch, items, {
        allowLegacy343: true,
      })
      const updates = items.map((item) => ({
        ...reassessSavedScanImportItem(item, context),
        scopedId: item.scopedId,
        accountId: item.accountId,
        sourceLegacyId: item.sourceLegacyId,
        migratedAt: item.migratedAt,
      }))
      const manifest = refreshScanBatchManifestPayloadHash(
        { ...batch, manifest: currentManifest },
        updates,
      )
      const summary = summarizeScanImportItems(updates)
      const complete =
        updates.length === manifest.expectedTotal &&
        new Set(updates.map((item) => item.sourceIdentity)).size === manifest.expectedTotal &&
        summary.ready === manifest.expectedTotal &&
        !summary.needsReview &&
        !summary.invalid &&
        !summary.duplicate &&
        !updates.some((item) => !item.evidence.detailPath || !item.evidence.visualDetailHash)
      await db.accountScanImportItems.bulkPut(updates)
      await db.accountScanImportBatches.put({
        ...batch,
        manifest,
        updatedAt: new Date().toISOString(),
        reviewState: {
          ...batch.reviewState,
          preflight: complete ? 'complete' : 'stale',
          preflightRevision: complete ? batch.reviewState.revision : null,
          armedRevision: null,
          warehouseFactHash: complete
            ? warehouseFactHash(
                await db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
              )
            : undefined,
        },
      })
      return { ...summary, complete }
    },
  )
}

export async function armAccountScanReviewImport(
  accountId: string,
  batchId: string,
  db: SodaDatabase = database,
) {
  return db.transaction(
    'rw',
    [db.settings, db.accountDriveDiscs, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const [batch, items] = await Promise.all([
        db.accountScanImportBatches.where('[accountId+id]').equals([accountId, batchId]).first(),
        db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batchId])
          .toArray(),
      ])
      if (!batch) throw new Error('当前账号中不存在该复核批次。')
      assertReadyScanReview(batch, items, {
        requireArmed: false,
        errorMessage: (expectedTotal) => `必须先完成当前账号的 ${expectedTotal} 条重新预检。`,
      })
      const currentDiscs = await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()
      if (batch.reviewState.warehouseFactHash !== warehouseFactHash(currentDiscs))
        throw new Error('仓库已更新，请重新检查本次扫描结果。')
      await db.accountScanImportBatches.put({
        ...batch,
        updatedAt: new Date().toISOString(),
        reviewState: { ...batch.reviewState, armedRevision: batch.reviewState.revision },
      })
    },
  )
}

export {
  stageAccountPaddleScanImport,
  importReadyAccountScanStaging,
  replaceReadyAccountScanStaging,
} from './accountScanImportTransactions'
