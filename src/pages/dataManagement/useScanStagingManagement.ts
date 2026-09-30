import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { useAppHealth } from '../../appHealthContext'
import { driveDiscData } from '../../data/gameData'
import {
  database,
  getLatestScanImportRollbackPreview,
  importReadyScanStaging,
  armScanReviewImport,
  listScanImportBatches,
  migrateScanImportConfirmations,
  persistScanImportStaging,
  reassessScanImportBatch,
  preflightScanReviewBatch,
  rollbackScanImportBatch,
  type ScanConfirmationMigrationResult,
} from '../../db/database'
import { summarizeScanImportItems } from '../../domain/scanImportStaging'
import {
  s4LegacyBatchId,
  s4RecoveredBatchId,
  s4RecoveryBatch,
  selectedScanBatchStorageKey,
} from './scanStagingUtils'
import { useScanRecoveryFixture } from './useScanRecoveryFixture'
import { useScanReviewQueue } from './useScanReviewQueue'

export function useScanStagingManagement({
  setMessage,
}: {
  setMessage: (message: string) => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data } = useAppHealth()
  const [scanRevision, setScanRevision] = useState(0)
  const [selectedScanBatchId, setSelectedScanBatchId] = useState<string | null>(
    () => searchParams.get('scanBatch') ?? localStorage.getItem(selectedScanBatchStorageKey),
  )

  const scanBatchCatalog = useLiveQuery(() => listScanImportBatches(), [scanRevision])
  const newestScanBatchId = scanBatchCatalog?.[0]?.batch.id ?? null
  const activeScanBatchId = scanBatchCatalog?.some(
    (entry) => entry.batch.id === selectedScanBatchId,
  )
    ? selectedScanBatchId
    : newestScanBatchId

  const scanStaging = useLiveQuery(async () => {
    if (!activeScanBatchId) return null
    const batch = await database.scanImportBatches.get(activeScanBatchId)
    if (!batch) return null
    const items = await database.scanImportItems
      .where('batchId')
      .equals(batch.id)
      .sortBy('sequence')
    return { batch, items }
  }, [activeScanBatchId, scanRevision])

  const scanRollbackPreview = useLiveQuery(
    () => getLatestScanImportRollbackPreview(),
    [scanRevision],
  )

  const [loadingScanStaging, setLoadingScanStaging] = useState(false)
  const [importingScanReady, setImportingScanReady] = useState(false)
  const [rollingBackScanImport, setRollingBackScanImport] = useState(false)
  const [scanMigrationReport, setScanMigrationReport] =
    useState<ScanConfirmationMigrationResult | null>(null)

  function selectScanBatch(batchId: string) {
    setSelectedScanBatchId(batchId)
    localStorage.setItem(selectedScanBatchStorageKey, batchId)
    const next = new URLSearchParams(searchParams)
    next.set('scanBatch', batchId)
    next.set('review', 'needs_review')
    next.set('sequence', '0')
    setSearchParams(next)
  }

  const stagingContext =
    data && driveDiscData
      ? {
          driveDiscSets: data.driveDiscSets,
          rules: driveDiscData.rules,
          dataVersion: driveDiscData.dataVersion,
        }
      : null

  const recoveryFixtureState = useScanRecoveryFixture({
    searchParams,
    setSearchParams,
    stagingContext,
    scanStagingBatchId: scanStaging?.batch.id,
    selectScanBatch,
    setScanRevision,
    setMessage,
  })

  const reviewQueueState = useScanReviewQueue({
    scanStaging: scanStaging ?? null,
    stagingContext,
    searchParams,
    setSearchParams,
    activeScanBatchId,
    setScanRevision,
    setMessage,
  })

  const scanSummary = scanStaging ? summarizeScanImportItems(scanStaging.items) : null

  const activeIsExpectedRecoveryBatch = Boolean(
    scanStaging &&
    [s4RecoveryBatch.id, s4RecoveredBatchId].includes(scanStaging.batch.id) &&
    scanStaging.batch.total === s4RecoveryBatch.total,
  )
  const activeIsRealReviewBatch = scanStaging?.batch.total === 343
  const activeCanEnterImportFlow = activeIsExpectedRecoveryBatch || activeIsRealReviewBatch
  const hasExpectedRecoveryBatch = scanBatchCatalog?.some(
    (entry) => entry.batch.id === s4RecoveryBatch.id && entry.batch.total === s4RecoveryBatch.total,
  )
  const migratedConfirmationCount =
    scanStaging?.items.filter((item) =>
      item.confirmations.some((confirmation) => confirmation.source === 'cross_batch_migration'),
    ).length ?? 0
  const activeReviewSequences = new Set(
    reviewQueueState.scanReviewItems.map((item) => item.sequence),
  )
  const pendingRecoveryGroups =
    scanStaging?.batch.id === s4RecoveredBatchId
      ? recoveryFixtureState.scanRecoveryGroups.groups.filter((group) =>
          group.sequences.some((sequence) => activeReviewSequences.has(sequence)),
        )
      : []

  useEffect(() => {
    const batchId = scanStaging?.batch.id
    if (!batchId || !data || !driveDiscData) return
    let active = true
    const context = {
      driveDiscSets: data.driveDiscSets,
      rules: driveDiscData.rules,
      dataVersion: driveDiscData.dataVersion,
    }
    void (async () => {
      const canMigrate =
        batchId === s4RecoveryBatch.id &&
        scanBatchCatalog?.some((entry) => entry.batch.id === s4LegacyBatchId)
      const migration = canMigrate
        ? await migrateScanImportConfirmations(
            s4LegacyBatchId,
            s4RecoveryBatch.id,
            recoveryFixtureState.s4ConfirmationMatches,
            context,
          )
        : null
      const result = await reassessScanImportBatch(batchId, context)
      return { migration, result }
    })()
      .then(({ migration, result }) => {
        if (active && migration)
          setScanMigrationReport((current) =>
            migration.migrated > 0 || migration.rejections.length > 0 || !current
              ? migration
              : current,
          )
        const changed = result.updated + (migration?.migrated ?? 0)
        if (active && changed > 0)
          setMessage(
            `批次 ${batchId} 已重算：迁移 ${migration?.migrated ?? 0} 条人工确认，拒绝 ${migration?.rejections.length ?? 0} 条，${result.ready} 条可导入，${result.needsReview} 条待复核。`,
          )
        if (active && changed > 0) setScanRevision((current) => current + 1)
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : '暂存重算失败。')
      })
    return () => {
      active = false
    }
  }, [
    scanStaging?.batch.id,
    scanBatchCatalog,
    data,
    recoveryFixtureState.s4ConfirmationMatches,
    setMessage,
  ])

  async function inspectScanStagingFile(file: File | undefined) {
    setMessage('')
    if (!file || !stagingContext) return
    setLoadingScanStaging(true)
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const staging = await persistScanImportStaging(parsed, stagingContext)
      const reassessed = await reassessScanImportBatch(staging.batch.id, stagingContext)
      selectScanBatch(staging.batch.id)
      setScanRevision((current) => current + 1)
      setMessage(
        `扫描批次已进入暂存：${staging.items.length} 条原始证据；重算后 ${reassessed.ready} 条可导入、${reassessed.needsReview} 条待复核，尚未写入正式仓库。`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? `暂存失败：${error.message}` : '暂存失败。')
    } finally {
      setLoadingScanStaging(false)
    }
  }

  async function confirmReadyScanImport() {
    if (
      !scanStaging ||
      !stagingContext ||
      !scanSummary?.ready ||
      !activeCanEnterImportFlow ||
      scanSummary.needsReview > 0 ||
      importingScanReady
    )
      return
    setImportingScanReady(true)
    try {
      const result = await importReadyScanStaging(scanStaging.batch.id, {
        ...stagingContext,
        gameDataVersion: data?.gameVersion ?? driveDiscData?.gameVersion ?? 'unknown',
      })
      setScanRevision((current) => current + 1)
      setMessage(
        `暂存导入完成：新增 ${result.summary.ready} 张，重复跳过 ${result.summary.skipped} 张；待复核项未写入。`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `暂存导入失败，原仓库已保留：${error.message}`
          : '暂存导入失败，原仓库已保留。',
      )
    } finally {
      setImportingScanReady(false)
    }
  }

  async function refreshScanReviewPreflight() {
    if (!scanStaging || !stagingContext) return
    try {
      const result = await preflightScanReviewBatch(scanStaging.batch.id, stagingContext)
      setScanRevision((value) => value + 1)
      setMessage(
        result.complete
          ? '343 条复核预检完成；请单独确认导入。'
          : '重新预检未通过，继续复核；尚未导入。',
      )
    } catch (error) {
      setMessage(error instanceof Error ? `重新预检失败：${error.message}` : '重新预检失败。')
    }
  }

  async function armCurrentScanImport() {
    if (!scanStaging) return
    try {
      await armScanReviewImport(scanStaging.batch.id)
      setScanRevision((value) => value + 1)
      setMessage('已确认导入资格；仍需单独点击最终导入。')
    } catch (error) {
      setMessage(error instanceof Error ? `导入确认失败：${error.message}` : '导入确认失败。')
    }
  }

  async function confirmScanImportRollback() {
    if (!scanRollbackPreview?.canRollback || rollingBackScanImport) return
    const confirmed = window.confirm(
      `确认撤销扫描批次 ${scanRollbackPreview.batchId}？\n\n将删除该批次新增的 ${scanRollbackPreview.driveDiscCount} 张正式档案和 ${scanRollbackPreview.evaluationCount} 条关联评价，并把对应暂存记录恢复为可导入。其他 ${scanRollbackPreview.unaffectedWarehouseCount} 张仓库档案不会受影响。此操作不可恢复。`,
    )
    if (!confirmed) return
    setRollingBackScanImport(true)
    try {
      const result = await rollbackScanImportBatch(scanRollbackPreview.batchId)
      setScanRevision((current) => current + 1)
      setMessage(
        `已撤销批次 ${result.batchId}：删除 ${result.driveDiscCount} 张正式档案和 ${result.evaluationCount} 条关联评价，${result.restoredStagingItemCount} 条暂存记录已恢复为可导入。`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `批次撤销失败，现有数据未改变：${error.message}`
          : '批次撤销失败，现有数据未改变。',
      )
    } finally {
      setRollingBackScanImport(false)
    }
  }

  return {
    data,
    stagingContext,
    scanBatchCatalog,
    activeScanBatchId,
    scanStaging,
    scanSummary,
    scanRollbackPreview,
    loadingScanStaging,
    importingScanReady,
    rollingBackScanImport,
    scanMigrationReport,
    ...recoveryFixtureState,
    ...reviewQueueState,
    activeCanEnterImportFlow,
    activeIsExpectedRecoveryBatch,
    hasExpectedRecoveryBatch,
    migratedConfirmationCount,
    pendingRecoveryGroups,
    selectScanBatch,
    inspectScanStagingFile,
    confirmReadyScanImport,
    refreshScanReviewPreflight,
    armCurrentScanImport,
    confirmScanImportRollback,
  }
}
