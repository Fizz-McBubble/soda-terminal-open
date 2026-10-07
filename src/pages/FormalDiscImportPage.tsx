import { FormalImportSuccess } from './FormalImportSuccess'
import {
  FormalImportFileDropzone,
  FormalImportHandoff,
  FormalImportConfirmationDialog,
} from './formalDiscImportSections'
import { loadFormalImportCurrent } from './formalDiscImportCurrent'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { flushSync } from 'react-dom'
import { Link, Navigate } from 'react-router-dom'
import { FormalDiscImportPageSuccess } from './FormalDiscImportPageSuccess'
import './formal-disc-import.css'
import {
  publicScannerDriveDiscData,
  publicScannerSetIdentities,
} from '../application/publicScannerCatalog'
import {
  armAccountScanReviewImport,
  preflightAccountScanReviewBatch,
  replaceReadyAccountScanStaging,
  stageAccountPaddleScanImport,
} from '../db/accountScanImport'
import { database } from '../db/databaseCore'
import { isLegacyScanImportBatch } from '../domain/scanImportStaging'
import { clearScannerTargetAccountBinding } from '../scanner/targetAccountBinding'
import { beginUsageOperation } from '../usageStatistics/client'

type ImportState = { mode: 'idle' | 'success' | 'error'; message: string }

export function FormalDiscImportPage({
  embedded = false,
  compact = false,
  onImportSuccess,
  onError,
  secondaryAction,
}: {
  embedded?: boolean
  compact?: boolean
  onImportSuccess?: (imported: number) => void
  onError?: (issueCode: 'scan_import_failed' | 'scan_file_invalid', message: string) => void
  secondaryAction?: ReactNode
} = {}) {
  const searchParams = new URLSearchParams(window.location.search)
  const successSampleMode = import.meta.env.DEV && searchParams.get('successSample') === '400'
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<ImportState>({ mode: 'idle', message: '' })
  const [busy, setBusy] = useState(false)
  const importPendingRef = useRef(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmationTriggerRef = useRef<HTMLButtonElement>(null)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const onImportSuccessRef = useRef(onImportSuccess)
  const reportedImportTotalRef = useRef<number | null>(null)
  useEffect(() => {
    onImportSuccessRef.current = onImportSuccess
  }, [onImportSuccess])
  const current = useLiveQuery(
    () => loadFormalImportCurrent(successSampleMode),
    [revision, successSampleMode],
  )

  const expectedTotal =
    current && !('bindingError' in current)
      ? (current.batch?.manifest?.expectedTotal ??
        (current.batch && isLegacyScanImportBatch(current.batch) ? current.batch.total : null))
      : null
  const readyForPreflight =
    current !== undefined &&
    current !== null &&
    !('bindingError' in current) &&
    expectedTotal !== null &&
    current.items.length === expectedTotal &&
    new Set(current.items.map((item) => item.sourceIdentity)).size === expectedTotal &&
    current.summary.needsReview === 0 &&
    !current.summary.invalid &&
    !current.summary.duplicate
  const readyForConfirmation =
    readyForPreflight &&
    current?.summary.ready === expectedTotal &&
    current.summary.needsReview === 0 &&
    current.batch?.reviewState.preflight === 'complete' &&
    current.batch.reviewState.preflightRevision === current.batch.reviewState.revision
  const completedImportedTotal = (() => {
    if (
      current === undefined ||
      current === null ||
      'bindingError' in current ||
      expectedTotal === null ||
      !current.batch
    )
      return null
    const importedAudit = (current.batch.importHistory ?? [])
      .filter((event) => event.action === 'imported')
      .at(-1)
    return current.items.length === expectedTotal &&
      current.summary.imported === expectedTotal &&
      current.discs === expectedTotal &&
      importedAudit?.importedCount === expectedTotal &&
      importedAudit?.skippedCount === 0
      ? expectedTotal
      : null
  })()

  useEffect(() => {
    if (dialogOpen) cancelRef.current?.focus()
  }, [dialogOpen])

  useEffect(() => {
    if (
      successSampleMode ||
      completedImportedTotal !== null ||
      (state.mode === 'success' && /^已更新 \d+/.test(state.message))
    )
      successHeadingRef.current?.focus()
  }, [completedImportedTotal, state.message, state.mode, successSampleMode])

  useEffect(() => {
    if (
      embedded &&
      completedImportedTotal !== null &&
      reportedImportTotalRef.current !== completedImportedTotal
    ) {
      reportedImportTotalRef.current = completedImportedTotal
      try {
        onImportSuccessRef.current?.(completedImportedTotal)
      } catch {
        // The persisted proof already establishes a successful import.
      }
    }
  }, [completedImportedTotal, embedded])

  function closeConfirmation() {
    flushSync(() => setDialogOpen(false))
    confirmationTriggerRef.current?.focus()
  }

  function containDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeConfirmation()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    )
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  async function loadStaging(file: File | undefined) {
    if (!file || !current || 'bindingError' in current) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      setState({ mode: 'error', message: '请选择 .json 格式的 扫描结果。' })
      onError?.('scan_file_invalid', '请选择 .json 格式的扫描结果。')
      return
    }
    setBusy(true)
    setState({ mode: 'idle', message: '' })
    try {
      const result = await stageAccountPaddleScanImport(
        current.account.id,
        JSON.parse(await file.text()),
      )
      setState({
        mode: 'success',
        message: result.staged
          ? `已载入 ${result.summary.total} 条扫描结果；尚未检查或导入。`
          : `当前账户已保留同源 ${result.summary.total} 条识别结果；未覆盖。`,
      })
      setRevision((value) => value + 1)
    } catch (error) {
      onError?.('scan_file_invalid', '无法载入这份扫描结果，请重新选择有效的 JSON 文件。')
      setState({
        mode: 'error',
        message: error instanceof Error ? error.message : '无法载入识别结果。',
      })
    } finally {
      setBusy(false)
    }
  }

  async function runPreflight() {
    if (!current || 'bindingError' in current || !current.batch || !publicScannerDriveDiscData)
      return
    setBusy(true)
    setState({ mode: 'idle', message: '' })
    try {
      const result = await preflightAccountScanReviewBatch(
        current.account.id,
        current.batch.id,
        {
          driveDiscSets: publicScannerDriveDiscData.driveDiscSets,
          driveDiscSetIdentities: publicScannerSetIdentities,
          rules: publicScannerDriveDiscData.rules,
          dataVersion: publicScannerDriveDiscData.dataVersion,
        },
        database,
        current.batch.reviewState.revision,
      )
      if (!result.complete)
        onError?.('scan_import_failed', '检查未通过，请返回准备步骤重新扫描；账户仓库尚未更新。')
      setState({
        mode: result.complete ? 'success' : 'error',
        message: result.complete
          ? `重新检查通过：${expectedTotal} 条可导入；尚未导入。`
          : `检查未通过：${result.needsReview} 条待处理，暂不能更新仓库。`,
      })
      setRevision((value) => value + 1)
    } catch (error) {
      onError?.('scan_import_failed', '重新检查失败，请重试；账户仓库尚未更新。')
      setState({
        mode: 'error',
        message: error instanceof Error ? error.message : '重新检查失败。',
      })
    } finally {
      setBusy(false)
    }
  }

  async function openConfirmation() {
    if (!readyForConfirmation) return
    setDialogOpen(true)
  }

  async function confirmImport() {
    if (
      importPendingRef.current ||
      !readyForConfirmation ||
      !current ||
      'bindingError' in current ||
      !current.batch ||
      !publicScannerDriveDiscData
    )
      return
    importPendingRef.current = true
    setBusy(true)
    const finishUsage = beginUsageOperation('disc_import')
    try {
      await armAccountScanReviewImport(current.account.id, current.batch.id, database)
      const result = await replaceReadyAccountScanStaging(
        current.account.id,
        current.batch.id,
        {
          driveDiscSets: publicScannerDriveDiscData.driveDiscSets,
          driveDiscSetIdentities: publicScannerSetIdentities,
          rules: publicScannerDriveDiscData.rules,
          dataVersion: publicScannerDriveDiscData.dataVersion,
          gameDataVersion: publicScannerDriveDiscData.dataVersion,
        },
        'replace_current_account_discs',
        database,
      )
      finishUsage('success')
      try {
        clearScannerTargetAccountBinding()
      } catch {
        // A browser storage failure cannot undo the committed transaction.
      }
      closeConfirmation()
      setState({
        mode: 'success',
        message: `已更新 ${result.imported} 张驱动盘；未影响其他账户、代理人、邦布、音擎或备份。`,
      })
      reportedImportTotalRef.current = result.imported
      try {
        onImportSuccess?.(result.imported)
      } catch {
        // Preserve the successful result if a parent presentation fails.
      }
      setRevision((value) => value + 1)
    } catch (error) {
      finishUsage('failure')
      onError?.('scan_import_failed', '更新失败，请重试或返回准备步骤；账户仓库未改动。')
      closeConfirmation()
      setState({
        mode: 'error',
        message: error instanceof Error ? error.message : '更新失败，账户仓库未改动，请重试。',
      })
    } finally {
      importPendingRef.current = false
      setBusy(false)
    }
  }

  function chooseFile(file: File | undefined) {
    void loadStaging(file)
  }

  if (successSampleMode)
    return (
      <FormalImportSuccess
        headingRef={successHeadingRef}
        message="已更新 400 张驱动盘；未影响其他账户、代理人、邦布、音擎或备份。"
      />
    )

  if (state.mode === 'success' && /^已更新 \d+/.test(state.message))
    return embedded ? (
      <FormalDiscImportPageSuccess headingRef={successHeadingRef} message={state.message} />
    ) : (
      <Navigate replace to="/assets/discs" />
    )

  if (current === undefined)
    return (
      <div className={embedded ? 'scanner-inline-import' : 'page-stack'}>
        <p role="status">正在读取当前玩家账户…</p>
      </div>
    )
  if (current === null)
    return (
      <div className={embedded ? 'scanner-inline-import' : 'page-stack data-center-page'}>
        {!embedded ? (
          <header className="workflow-header">
            <h1 id="formal-import-heading">导入驱动盘</h1>
          </header>
        ) : null}
        <p role="alert" className="danger-note">
          请先选择玩家账户；尚未读取或改动驱动盘资料。
        </p>
      </div>
    )
  if ('bindingError' in current)
    return (
      <div className={embedded ? 'scanner-inline-import' : 'page-stack data-center-page'}>
        {!embedded ? (
          <header className="workflow-header">
            <h1 id="formal-import-heading">导入驱动盘</h1>
          </header>
        ) : null}
        <p role="alert" className="danger-note">
          {current.bindingError}
        </p>
        {embedded && secondaryAction ? (
          secondaryAction
        ) : (
          <Link className="button button--primary" to="/system/scanner">
            返回扫描页重新确认
          </Link>
        )}
      </div>
    )

  if (completedImportedTotal !== null)
    return embedded ? (
      <FormalDiscImportPageSuccess
        headingRef={successHeadingRef}
        message={`已更新 ${completedImportedTotal} 张驱动盘；未影响其他账户、代理人、邦布、音擎或备份。`}
      />
    ) : (
      <Navigate replace to="/assets/discs" />
    )

  if (current.summary.needsReview > 0)
    return embedded ? (
      <div className="scanner-inline-import">
        <p className="danger-note" role="alert">
          本次识别仍有 {current.summary.needsReview} 条需要重新扫描；未检查、未导入。
        </p>
        {secondaryAction}
      </div>
    ) : (
      <Navigate
        replace
        to="/system/scanner"
        state={{
          scanImportBlocked: true,
          reason: `本次识别仍有 ${current.summary.needsReview} 条需要重新扫描；未检查、未导入。`,
        }}
      />
    )

  if (embedded && compact)
    return (
      <div className="scanner-inline-import scanner-dialog-import">
        {state.message && (
          <p
            className={state.mode === 'error' ? 'danger-note' : 'safe-note'}
            role={state.mode === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}
        <section className="scanner-dialog-import__ready" aria-label="确认更新驱动盘">
          <div className="scanner-dialog-import__impact">
            <div>
              <span>更新账户</span>
              <strong>{current.account.displayName}</strong>
            </div>
            <b>
              {current.binding.baselineDiscCount} → {current.items.length} 张
            </b>
          </div>
          <p>
            本次结果将替换这个账户的驱动盘仓库。匹配到的旧盘保留标签和方案引用；其他账户与代理人资料不变。
          </p>
          <div className="scanner-dialog-import__actions">
            <button
              className="button button--primary scanner-result-dialog__primary"
              type="button"
              disabled={!readyForConfirmation || busy}
              onClick={() => void confirmImport()}
            >
              {busy ? '正在更新账户' : '确认更新驱动盘'}
            </button>
            {secondaryAction}
          </div>
        </section>
      </div>
    )

  return (
    <div
      className={embedded ? 'scanner-inline-import' : 'page-stack data-center-page'}
      aria-labelledby={embedded ? 'formal-source-heading' : 'formal-import-heading'}
    >
      {!embedded ? (
        <header className="workflow-header">
          <h1 id="formal-import-heading">{current.batch ? '检查识别结果' : '导入驱动盘'}</h1>
          <p>
            {current.batch
              ? `账户“${current.account.displayName}” · 先确认识别结果与账户影响，再决定是否继续。`
              : '仅处理当前玩家账户的驱动盘；识别不通过时不会更新仓库。'}
          </p>
        </header>
      ) : null}
      {state.message && (
        <p
          className={state.mode === 'error' ? 'danger-note' : 'safe-note'}
          role={state.mode === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {state.message}
        </p>
      )}
      {!current.batch ? (
        <FormalImportFileDropzone
          current={current}
          dropActive={dropActive}
          setDropActive={setDropActive}
          fileInputRef={fileInputRef}
          busy={busy}
          chooseFile={chooseFile}
        />
      ) : (
        <FormalImportHandoff
          current={current}
          readyForPreflight={readyForPreflight}
          readyForConfirmation={readyForConfirmation}
          busy={busy}
          embedded={embedded}
          secondaryAction={secondaryAction}
          confirmationTriggerRef={confirmationTriggerRef}
          onRunPreflight={() => void runPreflight()}
          onOpenConfirmation={() => void openConfirmation()}
        />
      )}
      {dialogOpen && (
        <FormalImportConfirmationDialog
          current={current}
          dialogRef={dialogRef}
          cancelRef={cancelRef}
          busy={busy}
          onClose={closeConfirmation}
          onConfirm={() => void confirmImport()}
          onKeyDown={containDialogFocus}
        />
      )}
    </div>
  )
}
