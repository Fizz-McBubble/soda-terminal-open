import { ShieldAlert, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { scanLifecycleLabels } from '../dataManagementPresentation'
import { RecoveryGroupReview } from './RecoveryGroupReview'
import { ScanReviewEditor } from './ScanReviewEditor'
import { s4RecoveredBatchId, s4RecoveryBatch } from './scanStagingUtils'
import type { useScanStagingManagement } from './useScanStagingManagement'

export function ScanStagingPanel({
  staging,
}: {
  staging: ReturnType<typeof useScanStagingManagement>
}) {
  const {
    ReadonlyReviewFixturePanel,
    fixtureReviewFilter,
    fixtureReviewSequence,
    updateReadonlyFixtureUrl,
    loadingScanStaging,
    stagingContext,
    inspectScanStagingFile,
    scanBatchCatalog,
    activeScanBatchId,
    selectScanBatch,
    hasExpectedRecoveryBatch,
    applyingRecovery,
    recoveryFixture,
    applyScanRecovery,
    scanStaging,
    scanSummary,
    activeCanEnterImportFlow,
    activeIsExpectedRecoveryBatch,
    migratedConfirmationCount,
    scanMigrationReport,
    pendingRecoveryGroups,
    data,
    confirmRecoveryGroup,
    reviewFieldCount,
    scanReviewItems,
    reviewReasonCounts,
    filteredReviewItems,
    activeReviewItem,
    openReview,
    saveScanReview,
    refreshScanReviewPreflight,
    armCurrentScanImport,
    importingScanReady,
    confirmReadyScanImport,
    scanRollbackPreview,
    rollingBackScanImport,
    confirmScanImportRollback,
  } = staging

  return (
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
                      {entry.batch.id} · 共 {entry.summary.total} 条 · 可导入 {entry.summary.ready}{' '}
                      条
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
                <strong>{scanSummary.total}</strong> · 数据 {scanStaging.batch.dataVersion} · 识别{' '}
                {scanStaging.batch.recognitionVersion}
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
              {scanStaging.batch.id === s4RecoveredBatchId && pendingRecoveryGroups.length > 0 && (
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
                {scanSummary.ready} 可预检 · {scanSummary.needsReview} 条待复核 · {reviewFieldCount}{' '}
                个字段待确认 · {scanSummary.invalid} 无效 / {scanSummary.duplicate} 重名 /{' '}
                {scanSummary.lockUnknown} 锁定未知 · source report {scanStaging.batch.sourceReport}{' '}
                · 未导入
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
                    ['missing_main_stat', `缺主词条（${reviewReasonCounts.missing_main_stat}）`],
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
                      第 {item.sequence} 条 · {item.issues.map((issue) => issue.code).join('、')}
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
  )
}
