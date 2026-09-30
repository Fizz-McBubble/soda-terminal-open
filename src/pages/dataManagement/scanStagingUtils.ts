import type { ScanImportItem, ScanImportBatchMatch } from '../../domain/scanImportStaging'
import type { ScanBatchComparison } from '../dataManagementPresentation'

export const selectedScanBatchStorageKey = 'soda-terminal:selected-scan-batch:v1'
export const s4RecoveryBatch = {
  id: 's4-rescan-2026-06-29-102433',
  total: 298,
  sourcePath: '测试夹具：仅开发环境显式加载',
}
export const s4LegacyBatchId = 's3-full-inventory-2026-06-28'
export const s4RecoveredBatchId = 's4-recovery-2026-07-02'
export const readonlyFixtureBatchId = atob('Zml4dHVyZS1yZXZpZXc=')

export function filterScanReviewItems(items: ScanImportItem[], filter: string): ScanImportItem[] {
  return items.filter((item) => {
    const codes = item.issues.map((issue) => issue.code)
    if (filter === 'missing_set') return codes.includes('missing_set')
    if (filter === 'missing_main_stat') return codes.includes('missing_main_stat')
    if (filter === 'missing_sub_stat') return codes.includes('missing_sub_stat')
    if (filter === 'multiple') return item.issues.length > 1
    return true
  })
}

export function getScanReviewReasonCounts(items: ScanImportItem[]) {
  return {
    missing_set: items.filter((item) => item.issues.some((issue) => issue.code === 'missing_set'))
      .length,
    missing_main_stat: items.filter((item) =>
      item.issues.some((issue) => issue.code === 'missing_main_stat'),
    ).length,
    missing_sub_stat: items.filter((item) =>
      item.issues.some((issue) => issue.code === 'missing_sub_stat'),
    ).length,
    multiple: items.filter((item) => item.issues.length > 1).length,
  }
}

export function toConfirmationMatches(
  comparison: ScanBatchComparison | undefined,
): ScanImportBatchMatch[] {
  return (comparison?.matches ?? []).map((match) => ({
    sourceSequence: match.oldSequence,
    targetSequence: match.newSequence,
    matchMethod: match.matchMethod,
    matchConfidence: match.matchConfidence,
    ambiguousEntity: match.ambiguousEntity,
  }))
}

export function getRollbackConfirmText(preview: {
  batchId: string
  driveDiscCount: number
  evaluationCount: number
  unaffectedWarehouseCount: number
}): string {
  return `确认撤销扫描批次 ${preview.batchId}？\n\n将删除该批次新增的 ${preview.driveDiscCount} 张正式档案和 ${preview.evaluationCount} 条关联评价，并把对应暂存记录恢复为可导入。其他 ${preview.unaffectedWarehouseCount} 张仓库档案不会受影响。此操作不可恢复。`
}
