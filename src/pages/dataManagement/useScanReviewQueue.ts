import { useMemo } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import { database, reviewScanImportItem } from '../../db/database'
import type { ScanImportAssessmentContext, ScanImportItem } from '../../domain/scanImportStaging'
import { filterScanReviewItems, getScanReviewReasonCounts } from './scanStagingUtils'

export function useScanReviewQueue({
  scanStaging,
  stagingContext,
  searchParams,
  setSearchParams,
  activeScanBatchId,
  setScanRevision,
  setMessage,
}: {
  scanStaging: {
    batch: { reviewState: { revision: number } }
    items: ScanImportItem[]
  } | null
  stagingContext: ScanImportAssessmentContext | null
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  activeScanBatchId: string | null
  setScanRevision: React.Dispatch<React.SetStateAction<number>>
  setMessage: (message: string) => void
}) {
  const scanReviewItems = useMemo(
    () =>
      scanStaging?.items.filter(
        (item) => item.state === 'needs_review' || item.state === 'invalid',
      ) ?? [],
    [scanStaging],
  )

  const reviewFilter = searchParams.get('review') ?? 'needs_review'
  const selectedReviewSequence = Number(searchParams.get('sequence') ?? 0)
  const filteredReviewItems = useMemo(
    () => filterScanReviewItems(scanReviewItems, reviewFilter),
    [scanReviewItems, reviewFilter],
  )

  const activeReviewItem =
    filteredReviewItems.find((item) => item.sequence === selectedReviewSequence) ??
    filteredReviewItems[0]
  const reviewFieldCount = scanReviewItems.reduce((count, item) => count + item.issues.length, 0)
  const reviewReasonCounts = getScanReviewReasonCounts(scanReviewItems)

  function openReview(sequence: number, filter = reviewFilter) {
    const next = new URLSearchParams(searchParams)
    if (activeScanBatchId) next.set('scanBatch', activeScanBatchId)
    next.set('review', filter)
    next.set('sequence', String(sequence))
    setSearchParams(next)
  }

  async function saveScanReview(
    item: ScanImportItem,
    candidate: ScanImportItem['candidate'],
    lockState: ScanImportItem['lockState'],
    fields: string[],
  ) {
    if (!stagingContext) return
    if (!item.evidence.detailPath || !item.evidence.cardPath) {
      setMessage('原始证据不可用，未保存、未导入。')
      return
    }
    try {
      const updated = await reviewScanImportItem(
        item.id,
        { candidate, lockState, fields },
        stagingContext,
        database,
        scanStaging?.batch.reviewState.revision,
      )
      setScanRevision((current) => current + 1)
      setMessage(
        updated.state === 'ready'
          ? `第 ${item.sequence} 条复核草稿已更新，尚未重新预检、尚未导入。`
          : `第 ${item.sequence} 条草稿已保存，仍有 ${updated.issues.length} 个问题；尚未导入。`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? `复核保存失败：${error.message}` : '复核保存失败。')
    }
  }

  return {
    scanReviewItems,
    reviewFilter,
    filteredReviewItems,
    activeReviewItem,
    reviewFieldCount,
    reviewReasonCounts,
    openReview,
    saveScanReview,
  }
}
