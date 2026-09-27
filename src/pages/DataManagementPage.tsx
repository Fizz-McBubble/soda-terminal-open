import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'
import { Download, ShieldAlert, Upload } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppHealth } from '../appHealthContext'
import {
  database,
  getLatestScanImportRollbackPreview,
  importDriveDiscsFromJson,
  importReadyScanStaging,
  armScanReviewImport,
  listScanImportBatches,
  migrateScanImportConfirmations,
  persistScanImportStaging,
  reassessScanImportBatch,
  preflightScanReviewBatch,
  reviewScanImportGroup,
  reviewScanImportItem,
  rollbackScanImportBatch,
  type ScanConfirmationMigrationResult,
} from '../db/database'
import {
  createBackup,
  getBackupFilename,
  preflightBackup,
  restoreBackup,
  type BackupPreflight,
} from '../domain/backup'
import { preflightDriveDiscImport, type DriveDiscImportPreflight } from '../domain/discImport'
import {
  summarizeScanImportItems,
  type ScanImportBatchMatch,
  type ScanImportItem,
} from '../domain/scanImportStaging'
import type { DriveDiscSet, StatKey } from '../domain/schemas'
import { driveDiscData } from '../data/gameData'
import { releaseInfo } from '../releaseInfo'
import { AccountMigrationPreflightPanel } from '../components/AccountMigrationPreflightPanel'
import { DataCenterPage } from '../components/DataCenterPage'
import {
  loadLegacyRecoveryFixture,
  type LegacyRecoveryFixture,
} from '@soda/legacy-recovery-fixture'
import { currentN4DataManagementGate } from '../validation/currentN4DataManagementGate'
import {
  type RecoveryGroups,
  type ScanBatchComparison,
  emptyRecoveryGroups,
  scanLifecycleLabels,
  statOptions,
} from './dataManagementPresentation'

const selectedScanBatchStorageKey = 'soda-terminal:selected-scan-batch:v1'
const DevPlayerAccountAuditState = import.meta.env.DEV
  ? lazy(() => import('../testing/PlayerAccountAuditState'))
  : null
const s4RecoveryBatch = {
  id: 's4-rescan-2026-06-29-102433',
  total: 298,
  sourcePath: '测试夹具：仅开发环境显式加载',
}
const s4LegacyBatchId = 's3-full-inventory-2026-06-28'
const s4RecoveredBatchId = 's4-recovery-2026-07-02'

function ScanReviewEditor({
  item,
  sets,
  onSave,
  onKeep,
}: {
  item: ScanImportItem
  sets: DriveDiscSet[]
  onSave: (
    candidate: ScanImportItem['candidate'],
    lockState: ScanImportItem['lockState'],
    fields: string[],
  ) => void
  onKeep: () => void
}) {
  const [candidate, setCandidate] = useState(item.candidate)
  const [lockState, setLockState] = useState(item.lockState)
  const updateSubStat = (
    index: number,
    changes: Partial<ScanImportItem['candidate']['subStats'][number]>,
  ) =>
    setCandidate((current) => ({
      ...current,
      subStats: current.subStats.map((subStat, subIndex) =>
        subIndex === index ? { ...subStat, ...changes } : subStat,
      ),
    }))
  const reviewFields = Array.from(
    new Set(
      item.issues.map((issue) =>
        issue.field === 'setId' ? 'setName' : issue.field.replace(/\.(stat|value|upgrades)$/, ''),
      ),
    ),
  )
  const hasField = (field: string) => reviewFields.includes(field)
  const hasCandidate = reviewFields.every((field) => {
    if (field === 'setName') return Boolean(item.candidate.setId && item.candidate.setName)
    if (field === 'mainStat') return Boolean(item.candidate.mainStat)
    if (field === 'lockState') return item.lockState !== 'unknown'
    const subIndex = field.match(/^subStats\.(\d+)$/)?.[1]
    if (subIndex !== undefined) {
      const sub = item.candidate.subStats[Number(subIndex)]
      return Boolean(sub?.stat && sub.value !== null && sub.upgrades !== null)
    }
    return false
  })

  return (
    <article className="scan-review-item" aria-labelledby={`review-item-${item.sequence}`}>
      <h3 id={`review-item-${item.sequence}`}>第 {item.sequence} 条 / 343 · 待复核</h3>
      <div className="scan-review-evidence">
        <img alt={`第 ${item.sequence} 条详情原始截图`} src={item.evidence.detailPath} />
        <img alt={`第 ${item.sequence} 条卡面原始截图`} src={item.evidence.cardPath} />
      </div>
      <p className="muted-note">原始采集证据，只读 · source {item.sourceIdentity}</p>
      <p className="muted-note">原始套装文字：{item.fields.setName?.rawText || '未识别'}</p>
      {item.issues.map((issue) => (
        <p key={`${issue.field}-${issue.code}`} className="danger-note">
          {issue.message} · {item.fields[issue.field]?.source ?? '无来源'} ·{' '}
          {item.fields[issue.field]?.confidence ?? '低置信'} ·{' '}
          {item.fields[issue.field]?.rule ?? '未可靠识别'}
        </p>
      ))}
      <details className="scan-review-facts">
        <summary>查看字段事实、OCR 原文与规则</summary>
        {Object.entries(item.fields).map(([field, evidence]) => (
          <p key={field}>
            <strong>{field}</strong>：OCR「{evidence.rawText || '未可靠识别'}」 · 当前候选{' '}
            {evidence.normalizedValue === null
              ? '未可靠识别'
              : JSON.stringify(evidence.normalizedValue)}{' '}
            · 置信 {evidence.confidence} · 来源 {evidence.source} · 规则 {evidence.rule}
          </p>
        ))}
      </details>
      <div className="scan-review-fields">
        {hasField('setName') && (
          <label>
            套装
            <select
              value={candidate.setId ?? ''}
              onChange={(event) => {
                const set = sets.find((entry) => entry.id === event.target.value)
                setCandidate((current) => ({
                  ...current,
                  setId: set?.id ?? null,
                  setName: set?.name ?? null,
                }))
              }}
            >
              <option value="">请选择</option>
              {sets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasField('mainStat') && (
          <label>
            主词条
            <select
              value={candidate.mainStat ?? ''}
              onChange={(event) =>
                setCandidate((current) => ({
                  ...current,
                  mainStat: (event.target.value as StatKey) || null,
                }))
              }
            >
              <option value="">请选择</option>
              {statOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasField('lockState') && (
          <label>
            锁定状态
            <select
              value={String(lockState)}
              onChange={(event) =>
                setLockState(
                  event.target.value === 'unknown' ? 'unknown' : event.target.value === 'true',
                )
              }
            >
              <option value="true">已锁定</option>
              <option value="false">未锁定</option>
              <option value="unknown">待确认</option>
            </select>
          </label>
        )}
      </div>
      <div className="scan-substat-review">
        {candidate.subStats.map(
          (subStat, index) =>
            hasField(`subStats.${index}`) && (
              <div key={`${item.id}-sub-${index}`}>
                <span>副词条 {index + 1}</span>
                <select
                  aria-label={`第 ${item.sequence} 条副词条 ${index + 1}`}
                  value={subStat.stat ?? ''}
                  onChange={(event) =>
                    updateSubStat(index, { stat: (event.target.value as StatKey) || null })
                  }
                >
                  <option value="">请选择</option>
                  {statOptions.slice(0, 11).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`第 ${item.sequence} 条副词条 ${index + 1} 数值`}
                  min="0"
                  step="0.1"
                  type="number"
                  value={subStat.value ?? ''}
                  onChange={(event) =>
                    updateSubStat(index, {
                      value: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
                <input
                  aria-label={`第 ${item.sequence} 条副词条 ${index + 1} 强化次数`}
                  max="5"
                  min="0"
                  type="number"
                  value={subStat.upgrades ?? ''}
                  onChange={(event) =>
                    updateSubStat(index, {
                      upgrades: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </div>
            ),
        )}
      </div>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => onSave(candidate, lockState, reviewFields)}
      >
        手动修正并保存草稿
      </button>
      <button
        className="button button--secondary"
        type="button"
        disabled={!hasCandidate}
        onClick={() => onSave(item.candidate, item.lockState, reviewFields)}
      >
        确认当前候选
      </button>
      <button className="button button--secondary" type="button" onClick={onKeep}>
        保持待复核，下一条
      </button>
      <p className="muted-note">保存后预检会失效；请在队列完成后显式重新预检。</p>
    </article>
  )
}

function RecoveryGroupReview({
  group,
  sets,
  onConfirm,
}: {
  group: RecoveryGroups['groups'][number]
  sets: DriveDiscSet[]
  onConfirm: (setId: string) => Promise<void>
}) {
  const [setId, setSetId] = useState(group.candidateSetId)
  const [saving, setSaving] = useState(false)
  return (
    <article className="preflight-card">
      <img
        alt={`${group.candidateSetName} 视觉组代表卡片`}
        src={group.representativeDataUrl}
        width="124"
        height="126"
      />
      <p>
        <strong>{group.groupId}</strong> · 涉及序号 {group.sequences.join('、')}
      </p>
      <p className="muted-note">{group.reason}</p>
      <label>
        候选套装
        <select value={setId} onChange={(event) => setSetId(event.target.value)}>
          {sets
            .filter((set) => !set.evidenceOnly)
            .map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
        </select>
      </label>
      <button
        className="button button--secondary"
        disabled={saving}
        type="button"
        onClick={() => {
          setSaving(true)
          void onConfirm(setId).finally(() => setSaving(false))
        }}
      >
        {saving ? '正在确认…' : `确认该组为 ${sets.find((set) => set.id === setId)?.name ?? setId}`}
      </button>
    </article>
  )
}

function AdvancedDataManagement() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data } = useAppHealth()
  const [scanRevision, setScanRevision] = useState(0)
  const [selectedScanBatchId, setSelectedScanBatchId] = useState<string | null>(
    () => searchParams.get('scanBatch') ?? localStorage.getItem(selectedScanBatchStorageKey),
  )
  const localCounts = useLiveQuery(
    async () => ({
      driveDiscs: await database.driveDiscs.count(),
      discEvaluations: await database.discEvaluations.count(),
      buildProfiles: await database.buildProfiles.count(),
      settings: await database.settings.count(),
    }),
    [],
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
  const [preflight, setPreflight] = useState<BackupPreflight | null>(null)
  const [discImportInput, setDiscImportInput] = useState<unknown | null>(null)
  const [discImportPreflight, setDiscImportPreflight] = useState<DriveDiscImportPreflight | null>(
    null,
  )
  const [discImportResult, setDiscImportResult] = useState<DriveDiscImportPreflight | null>(null)
  const [message, setMessage] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [importingDiscs, setImportingDiscs] = useState(false)
  const [loadingScanStaging, setLoadingScanStaging] = useState(false)
  const [importingScanReady, setImportingScanReady] = useState(false)
  const [rollingBackScanImport, setRollingBackScanImport] = useState(false)
  const [applyingRecovery, setApplyingRecovery] = useState(false)
  const [scanMigrationReport, setScanMigrationReport] =
    useState<ScanConfirmationMigrationResult | null>(null)
  const [recoveryFixture, setRecoveryFixture] = useState<LegacyRecoveryFixture | null>(null)
  const [ReadonlyReviewFixturePanel, setReadonlyReviewFixturePanel] = useState<ComponentType<{
    filter: string
    sequence: number
    onChange: (filter: string, sequence: number) => void
  }> | null>(null)
  const readonlyFixtureBatchId = atob('Zml4dHVyZS1yZXZpZXc=')
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
    [readonlyFixtureBatchId, searchParams, setSearchParams],
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
    void import('../testing/ReadonlyReviewFixturePanel').then(({ default: Panel }) => {
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

  const stagingContext =
    data && driveDiscData
      ? {
          driveDiscSets: data.driveDiscSets,
          rules: driveDiscData.rules,
          dataVersion: driveDiscData.dataVersion,
        }
      : null
  const scanSummary = scanStaging ? summarizeScanImportItems(scanStaging.items) : null
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
    () =>
      scanReviewItems.filter((item) => {
        const codes = item.issues.map((issue) => issue.code)
        if (reviewFilter === 'missing_set') return codes.includes('missing_set')
        if (reviewFilter === 'missing_main_stat') return codes.includes('missing_main_stat')
        if (reviewFilter === 'missing_sub_stat') return codes.includes('missing_sub_stat')
        if (reviewFilter === 'multiple') return item.issues.length > 1
        return true
      }),
    [scanReviewItems, reviewFilter],
  )
  const activeReviewItem =
    filteredReviewItems.find((item) => item.sequence === selectedReviewSequence) ??
    filteredReviewItems[0]
  const reviewFieldCount = scanReviewItems.reduce((count, item) => count + item.issues.length, 0)
  const reviewReasonCounts = {
    missing_set: scanReviewItems.filter((item) =>
      item.issues.some((issue) => issue.code === 'missing_set'),
    ).length,
    missing_main_stat: scanReviewItems.filter((item) =>
      item.issues.some((issue) => issue.code === 'missing_main_stat'),
    ).length,
    missing_sub_stat: scanReviewItems.filter((item) =>
      item.issues.some((issue) => issue.code === 'missing_sub_stat'),
    ).length,
    multiple: scanReviewItems.filter((item) => item.issues.length > 1).length,
  }
  function openReview(sequence: number, filter = reviewFilter) {
    const next = new URLSearchParams(searchParams)
    if (activeScanBatchId) next.set('scanBatch', activeScanBatchId)
    next.set('review', filter)
    next.set('sequence', String(sequence))
    setSearchParams(next)
  }
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
  const activeReviewSequences = new Set(scanReviewItems.map((item) => item.sequence))
  const pendingRecoveryGroups =
    scanStaging?.batch.id === s4RecoveredBatchId
      ? scanRecoveryGroups.groups.filter((group) =>
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
            s4ConfirmationMatches,
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
  }, [scanStaging?.batch.id, scanBatchCatalog, data, s4ConfirmationMatches])

  function selectScanBatch(batchId: string) {
    setSelectedScanBatchId(batchId)
    localStorage.setItem(selectedScanBatchStorageKey, batchId)
    const next = new URLSearchParams(searchParams)
    next.set('scanBatch', batchId)
    next.set('review', 'needs_review')
    next.set('sequence', '0')
    setSearchParams(next)
  }

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
    if (!stagingContext || scanStaging?.batch.id !== s4RecoveredBatchId) return
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

  async function exportData() {
    try {
      const backup = await createBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = getBackupFilename()
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage('完整备份已通过 schema 自检并导出。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败。')
    }
  }

  async function inspectFile(file: File | undefined) {
    setMessage('')
    if (!file) return setPreflight(null)
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      setPreflight(preflightBackup(parsed))
    } catch {
      setPreflight({ success: false, errors: ['文件不是有效 JSON。'], risks: [] })
    }
  }

  async function inspectDiscImportFile(file: File | undefined) {
    setMessage('')
    setDiscImportResult(null)
    setDiscImportInput(null)
    if (!file) return setDiscImportPreflight(null)
    if (!data) {
      setDiscImportPreflight({
        format: 'soda-terminal-drive-disc-import',
        formatVersion: 1,
        batchId: 'unavailable',
        sourceAdapter: 'unknown',
        readyDiscs: [],
        items: [
          {
            index: 0,
            status: 'failed',
            issues: [{ index: 0, message: '游戏数据尚未加载，无法校验驱动盘套装。' }],
          },
        ],
        summary: { total: 0, ready: 0, skipped: 0, failed: 1 },
      })
      return
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const existingDiscs = await database.driveDiscs.toArray()
      const next = preflightDriveDiscImport(parsed, {
        driveDiscSets: data.driveDiscSets,
        driveDiscRules: driveDiscData?.rules,
        gameDataVersion: data.gameVersion,
        existingDiscs,
      })
      setDiscImportInput(parsed)
      setDiscImportPreflight(next)
    } catch {
      setDiscImportPreflight({
        format: 'soda-terminal-drive-disc-import',
        formatVersion: 1,
        batchId: 'unparsed',
        sourceAdapter: 'unknown',
        readyDiscs: [],
        items: [
          {
            index: 0,
            status: 'failed',
            issues: [{ index: 0, message: '文件不是有效 JSON。' }],
          },
        ],
        summary: { total: 0, ready: 0, skipped: 0, failed: 1 },
      })
    }
  }

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

  async function confirmRestore() {
    if (!preflight?.success || !preflight.backup) return
    setRestoring(true)
    try {
      const counts = await restoreBackup(preflight.backup)
      setMessage(
        `恢复完成：${counts.driveDiscs} 张档案、${counts.discEvaluations} 条评价、${counts.buildProfiles} 个模板。`,
      )
      setPreflight(null)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `恢复失败，原数据已保留：${error.message}`
          : '恢复失败，原数据已保留。',
      )
    } finally {
      setRestoring(false)
    }
  }

  async function confirmDiscImport() {
    if (!data || !discImportInput || !discImportPreflight?.summary.ready || importingDiscs) return
    setImportingDiscs(true)
    try {
      const result = await importDriveDiscsFromJson(discImportInput, {
        driveDiscSets: data.driveDiscSets,
        driveDiscRules: driveDiscData?.rules,
        gameDataVersion: data.gameVersion,
        batchId: discImportPreflight.batchId,
      })
      setDiscImportResult(result)
      setDiscImportPreflight(result)
      setMessage(
        `驱动盘导入完成：新增 ${result.summary.ready} 张，跳过 ${result.summary.skipped} 张，失败 ${result.summary.failed} 张。`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `驱动盘导入失败，原仓库已保留：${error.message}`
          : '驱动盘导入失败，原仓库已保留。',
      )
    } finally {
      setImportingDiscs(false)
    }
  }

  return (
    <div className="page-stack management-page">
      <header className="workflow-header">
        <div>
          <span className="eyebrow">账户与资料</span>
          <h1>数据管理</h1>
          <p>导入先做纯预检。只有明确确认后，才以备份完整替换本地业务数据。</p>
        </div>
      </header>
      <section className="panel data-foundation-status" aria-labelledby="data-foundation-title">
        <div className="panel__header">
          <div>
            <h2 id="data-foundation-title">数据基础状态</h2>
            <p>查看资料是否齐全、功能是否可靠，以及更新后能否安全恢复。</p>
          </div>
        </div>
        <div className="data-foundation-status__rows">
          {currentN4DataManagementGate.areas.map((area) => (
            <article key={area.id}>
              <div>
                <strong>{area.label}</strong>
                <span className={`data-foundation-status__state is-${area.state}`}>
                  {area.state === 'ready'
                    ? '已就绪'
                    : area.state === 'needs_attention'
                      ? '待补充'
                      : '未通过'}
                </span>
              </div>
              <p>{area.summary}</p>
              {area.blockers.length > 0 && (
                <details>
                  <summary>查看待处理项（{area.blockers.length}）</summary>
                  <ul>
                    {area.blockers.map((blocker, blockerIndex) => (
                      <li key={`${area.id}:${blockerIndex}`}>{blocker}</li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="data-management-grid">
        <AccountMigrationPreflightPanel />
        <article className="panel data-management-grid__wide">
          <div className="panel__header">
            <div>
              <span className="eyebrow">扫描结果</span>
              <h2>检查扫描结果</h2>
            </div>
          </div>
          <p>扫描证据先进入本地暂存。只有字段完整、组合合法且通过置信门槛的记录才可导入。</p>
          {ReadonlyReviewFixturePanel ? (
            <ReadonlyReviewFixturePanel
              filter={fixtureReviewFilter}
              sequence={fixtureReviewSequence}
              onChange={updateReadonlyFixtureUrl}
            />
          ) : (
            <>
              <label className="file-picker">
                <Upload size={20} />
                <span>{loadingScanStaging ? '正在载入…' : '选择扫描暂存 JSON'}</span>
                <input
                  accept="application/json,.json"
                  disabled={loadingScanStaging || !stagingContext}
                  type="file"
                  onChange={(event) => void inspectScanStagingFile(event.target.files?.[0])}
                />
              </label>
              {scanBatchCatalog && scanBatchCatalog.length > 0 && (
                <div className="preflight-card">
                  <h3>选择扫描批次</h3>
                  <label>
                    当前活动批次
                    <select
                      aria-label="当前活动扫描批次"
                      value={activeScanBatchId ?? ''}
                      onChange={(event) => selectScanBatch(event.target.value)}
                    >
                      {scanBatchCatalog.map((entry) => (
                        <option key={entry.batch.id} value={entry.batch.id}>
                          {entry.batch.id} · 共 {entry.summary.total} 条 · 可导入{' '}
                          {entry.summary.ready} 条
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="scan-review-list">
                    {scanBatchCatalog.map((entry) => (
                      <p key={entry.batch.id} className="muted-note">
                        <strong>{entry.batch.id}</strong> · 共 {entry.summary.total} 条 · 可导入{' '}
                        {entry.summary.ready} 条 · 待确认 {entry.summary.needsReview} 条 ·{' '}
                        {new Date(entry.batch.createdAt).toLocaleString()} ·{' '}
                        {scanLifecycleLabels[entry.lifecycle]}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {!hasExpectedRecoveryBatch && (
                <div className="preflight-card preflight-card--error">
                  <h3>请选择要检查的扫描结果</h3>
                  <p>
                    请在上方选择一次文件：<code>{s4RecoveryBatch.sourcePath}</code>
                  </p>
                  <p className="muted-note">载入只写入扫描暂存，不会导入正式仓库。</p>
                </div>
              )}
              <div className="preflight-card preflight-card--ready">
                <h3>载入已修复的扫描结果</h3>
                <p>已冻结原始证据；自动恢复 3 条，其余 50 条整理为 14 个视觉组。</p>
                <p className="muted-note">仅载入独立恢复暂存，不会写入正式仓库或覆盖原批次。</p>
                <button
                  className="button button--primary"
                  disabled={applyingRecovery || !stagingContext || !recoveryFixture}
                  type="button"
                  onClick={() => void applyScanRecovery()}
                >
                  {applyingRecovery
                    ? '正在载入恢复结果…'
                    : '载入恢复结果（3 条自动恢复 / 14 组待确认）'}
                </button>
              </div>
              {scanStaging && scanSummary && (
                <div className="scan-staging-panel">
                  <p>
                    当前活动批次 <strong>{scanStaging.batch.id}</strong> · 总数{' '}
                    <strong>{scanSummary.total}</strong> · 数据 {scanStaging.batch.dataVersion} ·
                    识别 {scanStaging.batch.recognitionVersion}
                  </p>
                  {!activeCanEnterImportFlow && (
                    <p className="danger-note">
                      <ShieldAlert size={17} />
                      当前不是已确认的新 298 条批次，导入已禁用。请切换或载入 {s4RecoveryBatch.id}。
                    </p>
                  )}
                  {activeIsExpectedRecoveryBatch && scanSummary.needsReview > 0 && (
                    <p className="danger-note">
                      <ShieldAlert size={17} />
                      该批次仍有 {scanSummary.needsReview}{' '}
                      条待复核，暂不允许部分导入；已完成的人工确认会自动迁移并重算。
                    </p>
                  )}
                  {activeIsExpectedRecoveryBatch && (
                    <div className="preflight-card">
                      <h3>旧批次人工确认迁移</h3>
                      <p>
                        已保留并迁移 <strong>{migratedConfirmationCount}</strong> 条；本次拒绝{' '}
                        <strong>{scanMigrationReport?.rejections.length ?? 0}</strong> 条。
                      </p>
                      {scanMigrationReport?.rejections.map((rejection) => (
                        <p
                          key={`${rejection.sourceSequence}-${rejection.targetSequence}-${rejection.reason}`}
                          className="muted-note"
                        >
                          旧第 {rejection.sourceSequence} 条 → 新第 {rejection.targetSequence} 条：
                          {rejection.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  {scanStaging.batch.id === s4RecoveredBatchId &&
                    pendingRecoveryGroups.length > 0 && (
                      <div className="scan-review-list">
                        <h3>按视觉组确认剩余记录</h3>
                        <p className="muted-note">
                          当前剩余 {scanSummary.needsReview} 条，共 {pendingRecoveryGroups.length}{' '}
                          组；每组只需确认一次，代表图已避开号位、头像、锁图标与选中框。
                        </p>
                        {pendingRecoveryGroups.map((group) => (
                          <RecoveryGroupReview
                            key={group.groupId}
                            group={group}
                            sets={data?.driveDiscSets ?? []}
                            onConfirm={(setId) => confirmRecoveryGroup(group, setId)}
                          />
                        ))}
                      </div>
                    )}
                  <dl className="count-comparison scan-staging-summary">
                    <div>
                      <dt>总数</dt>
                      <dd>{scanSummary.total}</dd>
                    </div>
                    <div>
                      <dt>可导入</dt>
                      <dd>{scanSummary.ready}</dd>
                    </div>
                    <div>
                      <dt>待复核</dt>
                      <dd>{scanSummary.needsReview}</dd>
                    </div>
                    <div>
                      <dt>无效</dt>
                      <dd>{scanSummary.invalid}</dd>
                    </div>
                    <div>
                      <dt>重复</dt>
                      <dd>{scanSummary.duplicate}</dd>
                    </div>
                    <div>
                      <dt>锁定未知</dt>
                      <dd>{scanSummary.lockUnknown}</dd>
                    </div>
                  </dl>
                  <p role="status" aria-live="polite" className="muted-note">
                    {scanStaging.items.length} / {scanStaging.batch.total} 原始条目已保留 ·{' '}
                    {scanSummary.ready} 可预检 · {scanSummary.needsReview} 条待复核 ·{' '}
                    {reviewFieldCount} 个字段待确认 · {scanSummary.invalid} 无效 /{' '}
                    {scanSummary.duplicate} 重名 / {scanSummary.lockUnknown} 锁定未知 · source
                    report {scanStaging.batch.sourceReport} · 未导入
                  </p>
                  <p className="muted-note">
                    待复核项按影响排列。草稿保存不会导入；完成后需由你显式重新预检。
                  </p>
                  <div className="scan-review-workspace">
                    <nav
                      aria-label="待复核条目"
                      className="scan-review-queue"
                      onKeyDown={(event) => {
                        const buttons = Array.from(
                          event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
                        )
                        const current = buttons.indexOf(event.target as HTMLButtonElement)
                        if (current < 0) return
                        const nextIndex =
                          event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? buttons.length - 1
                              : event.key === 'ArrowDown'
                                ? Math.min(buttons.length - 1, current + 1)
                                : event.key === 'ArrowUp'
                                  ? Math.max(0, current - 1)
                                  : current
                        if (nextIndex !== current) {
                          event.preventDefault()
                          buttons[nextIndex]?.focus()
                        }
                      }}
                    >
                      {[
                        ['needs_review', `全部待复核（${scanReviewItems.length}）`],
                        ['missing_set', `缺套装（${reviewReasonCounts.missing_set}）`],
                        [
                          'missing_main_stat',
                          `缺主词条（${reviewReasonCounts.missing_main_stat}）`,
                        ],
                        ['missing_sub_stat', `缺副词条（${reviewReasonCounts.missing_sub_stat}）`],
                        ['multiple', `涉及多字段（${reviewReasonCounts.multiple}）`],
                      ].map(([filter, label]) => (
                        <button
                          key={filter}
                          type="button"
                          className="button button--secondary"
                          onClick={() => {
                            const first = scanReviewItems.find((item) => {
                              const codes = item.issues.map((issue) => issue.code)
                              if (filter === 'missing_set') return codes.includes('missing_set')
                              if (filter === 'missing_main_stat')
                                return codes.includes('missing_main_stat')
                              if (filter === 'missing_sub_stat')
                                return codes.includes('missing_sub_stat')
                              if (filter === 'multiple') return item.issues.length > 1
                              return true
                            })
                            openReview(first?.sequence ?? 0, filter)
                          }}
                        >
                          {label}
                        </button>
                      ))}
                      {filteredReviewItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-current={activeReviewItem?.id === item.id ? 'page' : undefined}
                          onClick={() => openReview(item.sequence)}
                        >
                          第 {item.sequence} 条 ·{' '}
                          {item.issues.map((issue) => issue.code).join('、')}
                        </button>
                      ))}
                    </nav>
                    {activeReviewItem && (
                      <ScanReviewEditor
                        key={`${activeReviewItem.id}-${activeReviewItem.updatedAt}`}
                        item={activeReviewItem}
                        sets={data?.driveDiscSets ?? []}
                        onSave={(candidate, lockState, fields) =>
                          void saveScanReview(activeReviewItem, candidate, lockState, fields)
                        }
                        onKeep={() => {
                          const index = filteredReviewItems.findIndex(
                            (item) => item.id === activeReviewItem.id,
                          )
                          openReview(
                            filteredReviewItems[index + 1]?.sequence ?? activeReviewItem.sequence,
                          )
                        }}
                      />
                    )}
                  </div>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void refreshScanReviewPreflight()}
                  >
                    显式重新预检
                  </button>
                  {scanStaging.batch.reviewState.preflight === 'complete' &&
                    scanStaging.batch.reviewState.armedRevision !==
                      scanStaging.batch.reviewState.revision && (
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => void armCurrentScanImport()}
                      >
                        确认导入 343 条驱动盘
                      </button>
                    )}
                  {scanStaging.batch.reviewState.armedRevision ===
                    scanStaging.batch.reviewState.revision && (
                    <button
                      className="button button--primary"
                      disabled={
                        !scanSummary.ready ||
                        importingScanReady ||
                        !activeCanEnterImportFlow ||
                        scanSummary.needsReview > 0
                      }
                      type="button"
                      onClick={() => void confirmReadyScanImport()}
                    >
                      {importingScanReady
                        ? `正在导入批次 ${scanStaging.batch.id}…`
                        : `确认导入 ${scanSummary.total} 条驱动盘`}
                    </button>
                  )}
                  {scanSummary.imported > 0 && (
                    <Link
                      className="button button--secondary"
                      to={`/assets/discs?importBatch=${encodeURIComponent(scanStaging.batch.id)}`}
                    >
                      去仓库查看本批次
                    </Link>
                  )}
                  {scanRollbackPreview && (
                    <div
                      className={
                        scanRollbackPreview.canRollback
                          ? 'preflight-card preflight-card--error'
                          : 'preflight-card'
                      }
                    >
                      <h3>撤销最近一次扫描批次导入</h3>
                      <p>
                        批次 <strong>{scanRollbackPreview.batchId}</strong>
                        {scanRollbackPreview.importedAt
                          ? ` · 导入时间 ${new Date(scanRollbackPreview.importedAt).toLocaleString()}`
                          : ''}
                      </p>
                      <dl className="count-comparison">
                        <div>
                          <dt>将删除档案</dt>
                          <dd>{scanRollbackPreview.driveDiscCount}</dd>
                        </div>
                        <div>
                          <dt>将删除评价历史</dt>
                          <dd>{scanRollbackPreview.evaluationCount}</dd>
                        </div>
                        <div>
                          <dt>恢复暂存记录</dt>
                          <dd>{scanRollbackPreview.importedStagingItemCount}</dd>
                        </div>
                        <div>
                          <dt>导入时重复跳过</dt>
                          <dd>{scanRollbackPreview.duplicateSkippedCount}</dd>
                        </div>
                        <div>
                          <dt>不受影响的仓库档案</dt>
                          <dd>{scanRollbackPreview.unaffectedWarehouseCount}</dd>
                        </div>
                      </dl>
                      <p className="danger-note">
                        <ShieldAlert size={17} />
                        只按批次、扫描来源和原始证据身份精确撤销；不会清空仓库，也不会影响其他批次或手工档案。
                      </p>
                      {scanRollbackPreview.blockingReason ? (
                        <p className="muted-note">
                          已安全阻止操作：{scanRollbackPreview.blockingReason}
                        </p>
                      ) : (
                        <button
                          className="button button--danger"
                          disabled={rollingBackScanImport}
                          type="button"
                          onClick={() => void confirmScanImportRollback()}
                        >
                          {rollingBackScanImport ? '正在事务撤销…' : '撤销本批次导入'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </article>
        <article className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">导入</span>
              <h2>导入驱动盘仓库</h2>
            </div>
          </div>
          <p>
            支持 Soda Terminal 标准导入 JSON 和 ZZZ-Scanner 风格
            <code>scan_data.json</code>。导入前只做预检，不会立即写入仓库。
          </p>
          <label className="file-picker">
            <Upload size={20} />
            <span>选择驱动盘 JSON</span>
            <input
              accept="application/json,.json"
              type="file"
              onChange={(event) => void inspectDiscImportFile(event.target.files?.[0])}
            />
          </label>
          {discImportPreflight && (
            <div
              className={
                discImportPreflight.summary.failed > 0
                  ? 'preflight-card preflight-card--error'
                  : 'preflight-card preflight-card--ready'
              }
            >
              <h3>
                {discImportResult
                  ? '导入完成'
                  : discImportPreflight.summary.ready > 0
                    ? '预检通过，尚未写入'
                    : '预检未通过'}
              </h3>
              <p>
                来源 {discImportPreflight.sourceAdapter} · 批次 {discImportPreflight.batchId}
              </p>
              {!discImportResult && discImportPreflight.summary.failed > 0 && (
                <p className="muted-note">预检阶段不会写入仓库；当前失败不会改变原仓库。</p>
              )}
              <dl className="count-comparison">
                <div>
                  <dt>项目</dt>
                  <dd>数量</dd>
                </div>
                <div>
                  <dt>总数</dt>
                  <dd>{discImportPreflight.summary.total}</dd>
                </div>
                <div>
                  <dt>可导入</dt>
                  <dd>{discImportPreflight.summary.ready}</dd>
                </div>
                <div>
                  <dt>重复跳过</dt>
                  <dd>{discImportPreflight.summary.skipped}</dd>
                </div>
                <div>
                  <dt>失败</dt>
                  <dd>{discImportPreflight.summary.failed}</dd>
                </div>
              </dl>
              <p className="danger-note">
                <ShieldAlert size={17} />
                去重基于盘面指纹；完全同盘面但实际不同实体的驱动盘可能会被视为重复。
              </p>
              {discImportPreflight.items.some((item) => item.issues.length > 0) && (
                <ul className="preflight-errors">
                  {discImportPreflight.items
                    .filter((item) => item.issues.length > 0)
                    .slice(0, 4)
                    .map((item) => (
                      <li key={`${item.index}-${item.status}`}>
                        第 {item.index + 1} 条：{item.issues[0]?.message}
                      </li>
                    ))}
                </ul>
              )}
              {!discImportResult && discImportPreflight.summary.ready > 0 && (
                <button
                  className="button button--primary"
                  disabled={importingDiscs}
                  type="button"
                  onClick={confirmDiscImport}
                >
                  {importingDiscs ? '正在导入…' : '确认导入可用驱动盘'}
                </button>
              )}
              {discImportResult && (
                <Link
                  className="button button--primary"
                  to={`/assets/discs?importBatch=${encodeURIComponent(discImportResult.batchId)}`}
                >
                  去仓库查看本次导入
                </Link>
              )}
            </div>
          )}
        </article>
        <article className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">备份</span>
              <h2>导出完整备份</h2>
            </div>
          </div>
          <p>包含档案、评价历史、模板与必要设置，不包含临时草稿或设备信息。</p>
          <p className="muted-note">{releaseInfo.privacy}</p>
          <button className="button button--primary" type="button" onClick={exportData}>
            <Download size={17} /> 导出 JSON
          </button>
        </article>
        <article className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">恢复</span>
              <h2>预检备份文件</h2>
            </div>
          </div>
          <label className="file-picker">
            <Upload size={20} />
            <span>选择 soda-terminal-backup JSON</span>
            <input
              accept="application/json,.json"
              type="file"
              onChange={(event) => inspectFile(event.target.files?.[0])}
            />
          </label>
          {preflight && (
            <div
              className={
                preflight.success
                  ? 'preflight-card preflight-card--ready'
                  : 'preflight-card preflight-card--error'
              }
            >
              <h3>{preflight.success ? '预检通过，尚未写入' : '预检未通过'}</h3>
              {preflight.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
              {preflight.backup && (
                <>
                  <p>
                    格式 v{preflight.backup.formatVersion} · 数据库 schema v
                    {preflight.backup.databaseSchemaVersion} · 游戏数据{' '}
                    {preflight.backup.gameDataVersion}
                  </p>
                  <dl className="count-comparison">
                    <div>
                      <dt>项目</dt>
                      <dd>当前 / 备份</dd>
                    </div>
                    <div>
                      <dt>驱动盘</dt>
                      <dd>
                        {localCounts?.driveDiscs ?? 0} / {preflight.backup.counts.driveDiscs}
                      </dd>
                    </div>
                    <div>
                      <dt>评价</dt>
                      <dd>
                        {localCounts?.discEvaluations ?? 0} /{' '}
                        {preflight.backup.counts.discEvaluations}
                      </dd>
                    </div>
                    <div>
                      <dt>模板</dt>
                      <dd>
                        {localCounts?.buildProfiles ?? 0} / {preflight.backup.counts.buildProfiles}
                      </dd>
                    </div>
                  </dl>
                  <p className="danger-note">
                    <ShieldAlert size={17} /> 完整恢复不可合并：现有本地数据将以备份为准被替换。
                  </p>
                  <button
                    className="button button--danger"
                    disabled={restoring}
                    type="button"
                    onClick={confirmRestore}
                  >
                    {restoring ? '正在恢复…' : '确认以备份完整替换本地数据'}
                  </button>
                </>
              )}
            </div>
          )}
        </article>
      </section>
      {message && (
        <p
          className="form-message"
          role={/失败|不可|未保存/.test(message) ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  )
}

export function DataManagementPage() {
  return <DataCenterPage />
}

export function DevDataManagementPage() {
  return <AdvancedDataManagement />
}

export function DevPlayerAccountAuditPage() {
  if (!import.meta.env.DEV || !DevPlayerAccountAuditState) return null
  return (
    <Suspense
      fallback={
        <section className="panel">
          <p>正在载入只读审计状态…</p>
        </section>
      }
    >
      <DevPlayerAccountAuditState />
    </Suspense>
  )
}
