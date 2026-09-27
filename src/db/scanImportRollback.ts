import type { SodaDatabase } from './database'

export type ScanImportRollbackPreview = {
  batchId: string
  importedAt: string | null
  driveDiscCount: number
  evaluationCount: number
  importedStagingItemCount: number
  duplicateSkippedCount: number
  warehouseTotal: number
  unaffectedWarehouseCount: number
  canRollback: boolean
  blockingReason: string | null
}

export type ScanImportRollbackResult = ScanImportRollbackPreview & {
  restoredStagingItemCount: number
}

export async function buildScanImportRollbackPreview(batchId: string, db: SodaDatabase) {
  const [batch, batchItems, warehouseTotal] = await Promise.all([
    db.scanImportBatches.get(batchId),
    db.scanImportItems.where('batchId').equals(batchId).toArray(),
    db.driveDiscs.count(),
  ])
  if (!batch) throw new Error('扫描暂存批次不存在。')

  const importedItems = batchItems.filter((item) => item.state === 'imported')
  const importedDiscs = (await db.driveDiscs.toArray()).filter(
    (disc) =>
      disc.importBatchId === batchId && disc.importSource?.adapter === 'soda-terminal-scan-staging',
  )
  const importedSources = new Set(importedItems.map((item) => item.sourceIdentity))
  const discSources = new Set(importedDiscs.map((disc) => disc.importSource?.sourceId))
  const sourcesMatch =
    importedItems.length === importedDiscs.length &&
    importedSources.size === importedItems.length &&
    discSources.size === importedDiscs.length &&
    [...importedSources].every((sourceIdentity) => discSources.has(sourceIdentity))
  const targetIds = importedDiscs.map((disc) => disc.id)
  const evaluationCount = targetIds.length
    ? await db.discEvaluations.where('discId').anyOf(targetIds).count()
    : 0
  const importedAt =
    importedItems
      .map((item) => item.updatedAt)
      .sort((left, right) => right.localeCompare(left))[0] ?? null
  let blockingReason: string | null = null
  if (!importedItems.length || !importedDiscs.length)
    blockingReason = '该批次没有可撤销的正式导入记录。'
  else if (!sourcesMatch) blockingReason = '正式档案与暂存原始证据无法一一对应，已安全阻止撤销。'

  return {
    batchId,
    importedAt,
    driveDiscCount: importedDiscs.length,
    evaluationCount,
    importedStagingItemCount: importedItems.length,
    duplicateSkippedCount: batchItems.filter((item) => item.duplicate).length,
    warehouseTotal,
    unaffectedWarehouseCount: warehouseTotal - importedDiscs.length,
    canRollback: blockingReason === null,
    blockingReason,
  } satisfies ScanImportRollbackPreview
}
