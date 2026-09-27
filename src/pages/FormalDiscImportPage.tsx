import { useEffect, useRef, useState, type RefObject, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { flushSync } from 'react-dom'
import { Link, Navigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import './formal-disc-import.css'
import { getPublicFormalImportActiveAccount } from '../application/publicFormalImportAccount'
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
import {
  isLegacyScanImportBatch,
  resolveScanBatchManifest,
  summarizeScanImportItems,
} from '../domain/scanImportStaging'
import {
  clearScannerTargetAccountBinding,
  createScannerTargetAccountBinding,
  readScannerTargetAccountBinding,
  validateScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import { activeScannerResultBatchSettingKey } from '../scanner/resultHandoff'
import { hasCompletedFormalImportProof } from './formalDiscImportProof'

type ImportState = { mode: 'idle' | 'success' | 'error'; message: string }

export function FormalDiscImportPage({
  embedded = false,
  compact = false,
  onImportSuccess,
  secondaryAction,
}: {
  embedded?: boolean
  compact?: boolean
  onImportSuccess?: (imported: number) => void
  secondaryAction?: ReactNode
} = {}) {
  const searchParams = new URLSearchParams(window.location.search)
  const successSampleMode = import.meta.env.DEV && searchParams.get('successSample') === '400'
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<ImportState>({ mode: 'idle', message: '' })
  const [busy, setBusy] = useState(false)
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
  const current = useLiveQuery(async () => {
    if (successSampleMode) return null
    const bindingResult = readScannerTargetAccountBinding()
    if (!bindingResult.valid && bindingResult.code !== 'binding_missing')
      return { bindingError: bindingResult.message }
    const activeAccount = await getPublicFormalImportActiveAccount(database)
    const account = bindingResult.valid
      ? await database.accounts.get(bindingResult.binding.accountId)
      : activeAccount
    const discs = account
      ? await database.accountDriveDiscs.where('accountId').equals(account.id).count()
      : 0
    if (bindingResult.valid) {
      const bindingValidation = validateScannerTargetAccountBinding({
        binding: bindingResult.binding,
        targetAccount: account ?? null,
        activeAccount: activeAccount ?? null,
        currentDiscCount: discs,
      })
      if (!bindingValidation.valid) return { bindingError: bindingValidation.message }
    }
    if (!account) return { bindingError: '扫描目标账户已不存在，请返回扫描页重新确认。' }
    const batches = await database.accountScanImportBatches
      .where('accountId')
      .equals(account.id)
      .toArray()
    const eligibleBatches = batches
      .filter(
        (entry) =>
          /paddle/i.test(entry.recognitionVersion) &&
          Boolean(entry.manifest || isLegacyScanImportBatch(entry)),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const activeResultSetting = await database.settings.get(
      activeScannerResultBatchSettingKey(account.id),
    )
    const activeBatchId =
      typeof activeResultSetting?.value === 'string' ? activeResultSetting.value : null
    const batch = activeBatchId
      ? (eligibleBatches.find((entry) => entry.id === activeBatchId) ?? null)
      : (eligibleBatches[0] ?? null)
    if (activeBatchId && !batch)
      return { bindingError: '这次扫描结果已不可用，请返回扫描页重新读取。' }
    const items = batch
      ? await database.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([account.id, batch.id])
          .toArray()
      : []
    if (batch?.manifest?.schemaVersion === 1)
      return { bindingError: '这份扫描结果来自旧版扫描器，请返回扫描页重新扫描。' }
    if (batch?.manifest?.schemaVersion === 2) {
      try {
        resolveScanBatchManifest(batch, items)
      } catch {
        return { bindingError: '这份扫描结果不完整，无法继续导入，请重新扫描。' }
      }
    }
    const summary = summarizeScanImportItems(items)
    if (!bindingResult.valid) {
      const expectedTotal =
        batch?.manifest?.expectedTotal ??
        (batch && isLegacyScanImportBatch(batch) ? batch.total : null)
      const importedAudit = (batch?.importHistory ?? [])
        .filter((event) => event.action === 'imported')
        .at(-1)
      if (
        !hasCompletedFormalImportProof({
          expectedTotal,
          itemCount: items.length,
          importedCount: summary.imported,
          formalDiscCount: discs,
          auditImportedCount: importedAudit?.importedCount,
          auditSkippedCount: importedAudit?.skippedCount,
        })
      )
        return { bindingError: bindingResult.message }
    }
    return {
      account,
      binding: bindingResult.valid
        ? bindingResult.binding
        : createScannerTargetAccountBinding({ account, baselineDiscCount: discs }),
      discs,
      batch: batch ?? null,
      items,
      summary,
    }
  }, [revision, successSampleMode])

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
      onImportSuccessRef.current?.(completedImportedTotal)
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
      setState({
        mode: result.complete ? 'success' : 'error',
        message: result.complete
          ? `重新检查通过：${expectedTotal} 条可导入；尚未导入。`
          : `检查未通过：${result.needsReview} 条待处理，暂不能更新仓库。`,
      })
      setRevision((value) => value + 1)
    } catch (error) {
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
    if (!current || 'bindingError' in current || !current.batch || !publicScannerDriveDiscData)
      return
    setBusy(true)
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
      clearScannerTargetAccountBinding()
      closeConfirmation()
      setState({
        mode: 'success',
        message: `已更新 ${result.imported} 张驱动盘；未影响其他账户、代理人、邦布、音擎或备份。`,
      })
      onImportSuccess?.(result.imported)
      setRevision((value) => value + 1)
    } catch (error) {
      closeConfirmation()
      setState({
        mode: 'error',
        message: error instanceof Error ? error.message : '更新失败，账户仓库未改动，请重试。',
      })
    } finally {
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
      <section className="formal-import-success scanner-inline-import__success" role="status">
        <div className="formal-import-success__mark" aria-hidden="true">
          <CheckCircle2 />
        </div>
        <div className="formal-import-success__copy">
          <h2 ref={successHeadingRef} tabIndex={-1}>
            {state.message.split('；')[0]}
          </h2>
          <p>{state.message.split('；').slice(1).join('；')}</p>
        </div>
      </section>
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
      <section className="formal-import-success scanner-inline-import__success" role="status">
        <div className="formal-import-success__mark" aria-hidden="true">
          <CheckCircle2 />
        </div>
        <div className="formal-import-success__copy">
          <h2>已更新 {completedImportedTotal} 张驱动盘</h2>
          <p>未影响其他账户、代理人、邦布、音擎或备份。</p>
        </div>
      </section>
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
        <section className="panel" aria-labelledby="formal-source-heading">
          <h2 id="formal-source-heading">选择识别结果</h2>
          <p>
            目标账户：{current.account.displayName}。替换前仓库：
            {current.binding.baselineDiscCount} 张。
          </p>
          <div
            className={`file-dropzone${dropActive ? ' file-dropzone--active' : ''}`}
            role="button"
            tabIndex={0}
            aria-describedby="formal-dropzone-note"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              setDropActive(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDropActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDropActive(false)
              chooseFile(event.dataTransfer.files?.[0])
            }}
          >
            <strong>{dropActive ? '松开以载入 JSON' : '拖拽 JSON 到这里，或点击选择文件'}</strong>
            <span id="formal-dropzone-note" aria-live="polite">
              选择扫描器导出的结果文件（.json）；载入后仍需检查并确认更新。
            </span>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </div>
        </section>
      ) : (
        <section className="formal-import-handoff" aria-labelledby="formal-source-heading">
          <header className="formal-import-handoff__summary">
            <div className="formal-import-handoff__title">
              <h2 id="formal-source-heading">
                {readyForPreflight ? '识别结果已通过' : '识别结果仍需处理'}
              </h2>
              <p>
                {readyForPreflight
                  ? `${current.summary.ready} 张驱动盘均已可靠识别，没有待处理或无效记录。`
                  : '当前结果还不能更新仓库；未通过的记录不会被跳过。'}
              </p>
            </div>
            <dl className="formal-import-handoff__metrics" aria-label="识别结果总览">
              <div>
                <dt>本次识别</dt>
                <dd>{current.items.length}</dd>
              </div>
              <div>
                <dt>已可靠识别</dt>
                <dd>{current.summary.ready}</dd>
              </div>
              <div>
                <dt>待处理</dt>
                <dd>{current.summary.needsReview}</dd>
              </div>
              <div>
                <dt>无效</dt>
                <dd>{current.summary.invalid}</dd>
              </div>
            </dl>
            <div className="formal-import-handoff__impact" aria-label="账户影响">
              <span>确认后的账户影响</span>
              <strong>{current.account.displayName}</strong>
              <b>
                {current.binding.baselineDiscCount} → {current.items.length} 张
              </b>
              <small>完整替换，不与现有仓库合并</small>
            </div>
          </header>
          <div className="formal-import-handoff__action">
            <div>
              <strong>尚未更新账户</strong>
              <p>
                {readyForConfirmation
                  ? '检查已通过。下一步会先打开最终确认，不会自动导入。'
                  : readyForPreflight
                    ? `下一步只重新检查这 ${current.items.length} 张记录；通过后仍需你最终确认。`
                    : '请先返回扫描页修正结果；当前账户仍保持原样。'}
              </p>
            </div>
            {readyForPreflight && current.batch.reviewState.preflight !== 'complete' && (
              <button
                className="button button--primary"
                type="button"
                disabled={busy}
                onClick={() => void runPreflight()}
              >
                重新检查并继续
              </button>
            )}
            {readyForConfirmation && (
              <button
                ref={confirmationTriggerRef}
                className="button button--primary"
                type="button"
                disabled={busy}
                onClick={() => void openConfirmation()}
              >
                {embedded ? '确认导入驱动盘' : '查看更新确认'}
              </button>
            )}
            {!readyForPreflight &&
              (embedded && secondaryAction ? (
                secondaryAction
              ) : (
                <Link className="button button--primary" to="/system/scanner">
                  返回扫描页处理
                </Link>
              ))}
          </div>
        </section>
      )}
      {dialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            ref={dialogRef}
            className="panel modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-discs-heading"
            onKeyDown={containDialogFocus}
          >
            <h2 id="replace-discs-heading">
              是否覆盖“{current.account.displayName}”的驱动盘信息？
            </h2>
            <p>此操作只替换该账户的驱动盘，不会覆盖代理人、邦布、音擎、备份或其他账户。</p>
            <p>
              替换前驱动盘：{current.binding.baselineDiscCount}；捕获：
              {current.items.length}；唯一：
              {new Set(current.items.map((item) => item.sourceIdentity)).size}；可导入：
              {current.summary.ready}。
            </p>
            <p className="danger-note">
              确认后将完整替换该账户的驱动盘仓库，不会进行合并；稳定匹配的驱动盘会保留本地标记与方案引用。
            </p>
            <p className="muted-note">即使存在同名账户，本操作也不会切换、读取或改动其他账户。</p>
            <div className="management-actions">
              <button
                ref={cancelRef}
                className="button button--quiet"
                type="button"
                onClick={closeConfirmation}
              >
                取消
              </button>
              <button
                className="button button--danger"
                type="button"
                disabled={busy}
                onClick={() => void confirmImport()}
              >
                确认更新仓库
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function FormalImportSuccess({
  headingRef,
  message,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>
  message: string
}) {
  return (
    <div
      className="page-stack data-center-page"
      data-import-state="success"
      aria-labelledby="formal-success-heading"
    >
      <section
        className="formal-import-success"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="formal-import-success__mark" aria-hidden="true">
          <CheckCircle2 />
        </div>
        <div className="formal-import-success__copy">
          <h1 ref={headingRef} id="formal-success-heading" tabIndex={-1}>
            {message.split('；')[0]}
          </h1>
          <p className="formal-import-success__lead">仓库已按本次扫描结果更新。</p>
          <p className="formal-import-success__scope">未影响其他账户、代理人、邦布、音擎或备份。</p>
        </div>
        <div className="formal-import-success__actions" aria-label="导入完成后的操作">
          <Link
            className="button button--primary formal-import-success__primary"
            to="/assets/discs"
          >
            查看我的驱动盘
          </Link>
          <Link
            className="button button--quiet formal-import-success__secondary"
            to="/system/scanner"
          >
            再次扫描
          </Link>
        </div>
      </section>
    </div>
  )
}
