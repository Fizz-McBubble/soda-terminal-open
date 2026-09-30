import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import {
  loadLegacyRecoveryFixture,
  type LegacyRecoveryFixture,
} from '@soda/legacy-recovery-fixture'
import {
  persistScanImportStaging,
  reassessScanImportBatch,
  reviewScanImportGroup,
} from '../../db/database'
import type { ScanImportBatchMatch } from '../../domain/scanImportStaging'
import type { ScanImportAssessmentContext } from '../../domain/scanImportStaging'
import {
  type RecoveryGroups,
  type ScanBatchComparison,
  emptyRecoveryGroups,
} from '../dataManagementPresentation'
import { readonlyFixtureBatchId, s4RecoveredBatchId } from './scanStagingUtils'

export function useScanRecoveryFixture({
  searchParams,
  setSearchParams,
  stagingContext,
  scanStagingBatchId,
  selectScanBatch,
  setScanRevision,
  setMessage,
}: {
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  stagingContext: ScanImportAssessmentContext | null
  scanStagingBatchId: string | undefined
  selectScanBatch: (batchId: string) => void
  setScanRevision: React.Dispatch<React.SetStateAction<number>>
  setMessage: (message: string) => void
}) {
  const [applyingRecovery, setApplyingRecovery] = useState(false)
  const [recoveryFixture, setRecoveryFixture] = useState<LegacyRecoveryFixture | null>(null)
  const [ReadonlyReviewFixturePanel, setReadonlyReviewFixturePanel] = useState<ComponentType<{
    filter: string
    sequence: number
    onChange: (filter: string, sequence: number) => void
  }> | null>(null)

  const fixtureReviewRequested =
    import.meta.env.DEV && searchParams.get('scanBatch') === readonlyFixtureBatchId
  const fixtureReviewFilter = searchParams.get('review') ?? 'needs_review'
  const fixtureReviewSequence = Number(searchParams.get('sequence') ?? 0)

  const updateReadonlyFixtureUrl = useCallback(
    (filter: string, sequence: number) => {
      const next = new URLSearchParams(searchParams)
      next.set('scanBatch', readonlyFixtureBatchId)
      next.set('review', filter)
      next.set('sequence', String(sequence))
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    let active = true
    void loadLegacyRecoveryFixture().then((fixture) => {
      if (active) setRecoveryFixture(fixture)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!fixtureReviewRequested) return
    let active = true
    void import('../../testing/ReadonlyReviewFixturePanel').then(({ default: Panel }) => {
      if (active) setReadonlyReviewFixturePanel(() => Panel)
    })
    return () => {
      active = false
    }
  }, [fixtureReviewRequested])

  const scanRecoveryStaging = recoveryFixture?.stagingInput ?? null
  const scanRecoveryGroups =
    (recoveryFixture?.groupsInput as RecoveryGroups | undefined) ?? emptyRecoveryGroups
  const scanBatchComparison = recoveryFixture?.comparisonInput as ScanBatchComparison | undefined

  const s4ConfirmationMatches: ScanImportBatchMatch[] = useMemo(
    () =>
      (scanBatchComparison?.matches ?? []).map((match) => ({
        sourceSequence: match.oldSequence,
        targetSequence: match.newSequence,
        matchMethod: match.matchMethod,
        matchConfidence: match.matchConfidence,
        ambiguousEntity: match.ambiguousEntity,
      })),
    [scanBatchComparison],
  )

  async function applyScanRecovery() {
    if (!stagingContext || !recoveryFixture || applyingRecovery) return
    setApplyingRecovery(true)
    try {
      const staging = await persistScanImportStaging(scanRecoveryStaging, stagingContext)
      const result = await reassessScanImportBatch(staging.batch.id, stagingContext)
      selectScanBatch(staging.batch.id)
      setScanRevision((current) => current + 1)
      setMessage(
        `恢复结果已载入：自动恢复 3 条，${result.ready} 条可导入，${result.needsReview} 条压缩为 14 个视觉组待确认；尚未写入正式仓库。`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? `恢复结果载入失败：${error.message}` : '恢复结果载入失败。',
      )
    } finally {
      setApplyingRecovery(false)
    }
  }

  async function confirmRecoveryGroup(
    group: (typeof scanRecoveryGroups.groups)[number],
    setId: string,
  ) {
    if (!stagingContext || scanStagingBatchId !== s4RecoveredBatchId) return
    try {
      const result = await reviewScanImportGroup(
        s4RecoveredBatchId,
        group.sequences,
        setId,
        stagingContext,
      )
      setScanRevision((current) => current + 1)
      setMessage(
        `${group.groupId} 已确认 ${result.updated} 条，其中 ${result.ready} 条通过；无需逐条编辑。`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '视觉组确认失败。')
    }
  }

  return {
    applyingRecovery,
    recoveryFixture,
    ReadonlyReviewFixturePanel,
    fixtureReviewFilter,
    fixtureReviewSequence,
    updateReadonlyFixtureUrl,
    scanRecoveryGroups,
    s4ConfirmationMatches,
    applyScanRecovery,
    confirmRecoveryGroup,
  }
}
