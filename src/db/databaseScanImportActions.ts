import { database, type SodaDatabase } from './databaseCore'
import {
  buildScanImportRollbackPreview,
  type ScanImportRollbackPreview,
  type ScanImportRollbackResult,
} from './scanImportRollback'
import { preflightDriveDiscImport } from '../domain/discImport'
import {
  assessScanImportItem,
  confirmScanImportItem,
  createStandardImportFromStaging,
  isLegacyScanImportBatch,
  legacyScanImportExpectedTotal,
  reassessSavedScanImportItem,
  refreshScanBatchManifestPayloadHash,
  resolveScanBatchManifest,
  type ScanImportAssessmentContext,
} from '../domain/scanImportStaging'

export async function preflightScanReviewBatch(
  batchId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    let batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('扫描暂存批次不存在。')
    const result = await reassessScanImportBatch(batchId, context, db)
    batch = (await db.scanImportBatches.get(batchId)) ?? batch
    const items = await db.scanImportItems.where('batchId').equals(batchId).toArray()
    let expectedTotal: number | null
    try {
      expectedTotal = resolveScanBatchManifest(batch, items, {
        allowLegacy343: true,
      }).manifest.expectedTotal
    } catch {
      // A partial legacy declaration remains reviewable but can never complete preflight.
      expectedTotal = null
    }
    const complete =
      expectedTotal !== null &&
      items.length === expectedTotal &&
      new Set(items.map((i) => i.sourceIdentity)).size === expectedTotal &&
      result.ready === expectedTotal &&
      !result.needsReview &&
      !result.invalid &&
      !items.some((i) => i.duplicate || !i.evidence.detailPath || !i.evidence.visualDetailHash)
    await db.scanImportBatches.put({
      ...batch,
      updatedAt: new Date().toISOString(),
      reviewState: {
        ...batch.reviewState,
        preflight: complete ? 'complete' : 'stale',
        preflightRevision: complete ? batch.reviewState.revision : null,
        armedRevision: null,
      },
    })
    return { ...result, complete }
  })
}

export async function armScanReviewImport(batchId: string, db: SodaDatabase = database) {
  const batch = await db.scanImportBatches.get(batchId)
  const items = await db.scanImportItems.where('batchId').equals(batchId).toArray()
  if (!batch) throw new Error('扫描暂存批次不存在。')
  let expectedTotal: number
  try {
    expectedTotal = resolveScanBatchManifest(batch, items, {
      allowLegacy343: true,
    }).manifest.expectedTotal
  } catch {
    if (batch.total === legacyScanImportExpectedTotal)
      throw new Error(`必须先完成当前草稿的 ${batch.total} 条重新预检。`)
    throw new Error('扫描批次 manifest 无效，不能进入导入确认。')
  }
  if (
    items.length !== expectedTotal ||
    items.some((item) => !item.evidence.detailPath || !item.evidence.visualDetailHash) ||
    batch.reviewState.preflight !== 'complete' ||
    batch.reviewState.preflightRevision !== batch.reviewState.revision
  )
    throw new Error(`必须先完成当前草稿的 ${expectedTotal} 条重新预检。`)
  await db.scanImportBatches.put({
    ...batch,
    reviewState: { ...batch.reviewState, armedRevision: batch.reviewState.revision },
    updatedAt: new Date().toISOString(),
  })
}

export async function reviewScanImportGroup(
  batchId: string,
  sequences: number[],
  setId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    const batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('恢复批次不存在。')
    const set = context.driveDiscSets.find((candidate) => candidate.id === setId)
    if (!set || set.evidenceOnly) throw new Error('请选择可核验的正式套装。')
    const sequenceSet = new Set(sequences)
    const items = (await db.scanImportItems.where('batchId').equals(batchId).toArray()).filter(
      (item) => sequenceSet.has(item.sequence),
    )
    if (items.length !== sequenceSet.size) throw new Error('恢复组记录不完整，未写入任何修改。')
    if (items.some((item) => item.state === 'imported'))
      throw new Error('恢复组包含已导入记录，不能修改。')
    const updates = items.map((item) =>
      confirmScanImportItem(
        item,
        {
          candidate: { ...item.candidate, setId: set.id, setName: set.name },
          lockState: item.lockState,
        },
        context,
      ),
    )
    await db.scanImportItems.bulkPut(updates)
    await db.scanImportBatches.put({ ...batch, updatedAt: new Date().toISOString() })
    return {
      updated: updates.length,
      ready: updates.filter((item) => item.state === 'ready').length,
      needsReview: updates.filter((item) => item.state === 'needs_review').length,
    }
  })
}

export async function reassessScanImportBatch(
  batchId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    const batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('扫描暂存批次不存在。')
    const items = await db.scanImportItems.where('batchId').equals(batchId).toArray()
    const nextItems = items.map((item) =>
      item.state === 'imported' ? item : reassessSavedScanImportItem(item, context),
    )
    const updates = nextItems.filter(
      (next, index) => JSON.stringify(next) !== JSON.stringify(items[index]),
    )
    if (updates.length) {
      let manifest = batch.manifest
      if (batch.manifest || isLegacyScanImportBatch(batch)) {
        const resolved = resolveScanBatchManifest(batch, items, { allowLegacy343: true })
        manifest = refreshScanBatchManifestPayloadHash(
          { ...batch, manifest: resolved.manifest },
          nextItems,
        )
      }
      await db.scanImportItems.bulkPut(updates)
      await db.scanImportBatches.put({
        ...batch,
        manifest,
        updatedAt: new Date().toISOString(),
      })
    }
    const currentItems = updates.length ? nextItems : items
    return {
      updated: updates.length,
      ready: currentItems.filter((item) => item.state === 'ready').length,
      needsReview: currentItems.filter((item) => item.state === 'needs_review').length,
      invalid: currentItems.filter((item) => item.state === 'invalid').length,
    }
  })
}

export async function importReadyScanStaging(
  batchId: string,
  context: ScanImportAssessmentContext & { gameDataVersion: string; now?: string },
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  return db.transaction('rw', db.driveDiscs, db.scanImportBatches, db.scanImportItems, async () => {
    const batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('扫描暂存批次不存在。')
    if (
      batch.total === legacyScanImportExpectedTotal &&
      (batch.reviewState.preflight !== 'complete' ||
        batch.reviewState.preflightRevision !== batch.reviewState.revision ||
        batch.reviewState.armedRevision !== batch.reviewState.revision)
    )
      throw new Error('扫描复核尚未完成独立重新预检与导入确认。')
    const readyItems = await db.scanImportItems
      .where('[batchId+state]')
      .equals([batchId, 'ready'])
      .sortBy('sequence')
    if (!readyItems.length) throw new Error('当前没有可直接导入的记录。')
    const standardInput = createStandardImportFromStaging(batch, readyItems)
    const preflight = preflightDriveDiscImport(standardInput, {
      driveDiscSets: context.driveDiscSets,
      driveDiscSetIdentities: context.driveDiscSetIdentities,
      driveDiscRules: context.rules,
      gameDataVersion: context.gameDataVersion,
      existingDiscs: await db.driveDiscs.toArray(),
      now: context.now,
      batchId,
    })
    if (preflight.summary.failed) throw new Error('ready 集合复检失败，事务已回滚。')
    if (preflight.readyDiscs.length) await db.driveDiscs.bulkAdd(preflight.readyDiscs)

    for (const result of preflight.items) {
      const source = readyItems[result.index]
      if (!source) continue
      if (result.status === 'ready') {
        await db.scanImportItems.put({
          ...source,
          state: 'imported',
          updatedAt: new Date().toISOString(),
        })
      } else if (result.status === 'skipped') {
        await db.scanImportItems.put(
          assessScanImportItem(
            {
              ...source,
              duplicate: true,
              updatedAt: new Date().toISOString(),
            },
            context,
          ),
        )
      }
    }
    const importedAt = new Date().toISOString()
    await db.scanImportBatches.put({
      ...batch,
      updatedAt: importedAt,
      importHistory: [
        ...(batch.importHistory ?? []),
        {
          action: 'imported',
          at: importedAt,
          importedCount: preflight.summary.ready,
          skippedCount: preflight.summary.skipped,
        },
      ],
    })
    beforeCommit?.()
    return preflight
  })
}

export type { ScanImportRollbackPreview, ScanImportRollbackResult } from './scanImportRollback'

export async function previewScanImportRollback(
  batchId: string,
  db: SodaDatabase = database,
): Promise<ScanImportRollbackPreview> {
  return db.transaction(
    'r',
    db.driveDiscs,
    db.discEvaluations,
    db.scanImportBatches,
    db.scanImportItems,
    () => buildScanImportRollbackPreview(batchId, db),
  )
}

export async function getLatestScanImportRollbackPreview(
  db: SodaDatabase = database,
): Promise<ScanImportRollbackPreview | null> {
  return db.transaction(
    'r',
    db.driveDiscs,
    db.discEvaluations,
    db.scanImportBatches,
    db.scanImportItems,
    async () => {
      const importedItems = await db.scanImportItems
        .where('state')
        .equals('imported')
        .sortBy('updatedAt')
      const candidateBatchIds = [...new Set(importedItems.reverse().map((item) => item.batchId))]
      for (const batchId of candidateBatchIds)
        if (await db.scanImportBatches.get(batchId))
          return buildScanImportRollbackPreview(batchId, db)
      return null
    },
  )
}

export async function rollbackScanImportBatch(
  batchId: string,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
): Promise<ScanImportRollbackResult> {
  return db.transaction(
    'rw',
    db.driveDiscs,
    db.discEvaluations,
    db.scanImportBatches,
    db.scanImportItems,
    async () => {
      const preview = await buildScanImportRollbackPreview(batchId, db)
      if (!preview.canRollback) throw new Error(preview.blockingReason ?? '该批次不可撤销。')
      const targetDiscs = (await db.driveDiscs.toArray()).filter(
        (disc) =>
          disc.importBatchId === batchId &&
          disc.importSource?.adapter === 'soda-terminal-scan-staging',
      )
      const targetIds = targetDiscs.map((disc) => disc.id)
      const targetSources = new Set(targetDiscs.map((disc) => disc.importSource?.sourceId))
      const importedItems = await db.scanImportItems
        .where('[batchId+state]')
        .equals([batchId, 'imported'])
        .toArray()
      if (importedItems.some((item) => !targetSources.has(item.sourceIdentity)))
        throw new Error('撤销前身份复核失败，事务已回滚。')
      if (targetIds.length) {
        await db.discEvaluations.where('discId').anyOf(targetIds).delete()
        await db.driveDiscs.bulkDelete(targetIds)
      }
      const updatedAt = new Date().toISOString()
      await db.scanImportItems.bulkPut(
        importedItems.map((item) => ({ ...item, state: 'ready' as const, updatedAt })),
      )
      const batch = await db.scanImportBatches.get(batchId)
      if (!batch) throw new Error('撤销过程中批次消失，事务已回滚。')
      await db.scanImportBatches.put({
        ...batch,
        updatedAt,
        importHistory: [
          ...(batch.importHistory ?? []),
          {
            action: 'rolled_back',
            at: updatedAt,
            importedCount: importedItems.length,
            skippedCount: preview.duplicateSkippedCount,
          },
        ],
      })
      beforeCommit?.()
      return { ...preview, restoredStagingItemCount: importedItems.length }
    },
  )
}
