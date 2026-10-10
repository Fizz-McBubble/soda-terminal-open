import { Link } from 'react-router-dom'
import type { Dispatch, KeyboardEvent, ReactNode, RefObject, SetStateAction } from 'react'
import type { LoadedFormalImportCurrent } from './formalDiscImportCurrent'
export function FormalImportFileDropzone({
  current,
  dropActive,
  setDropActive,
  fileInputRef,
  busy,
  chooseFile,
}: {
  current: LoadedFormalImportCurrent
  dropActive: boolean
  setDropActive: Dispatch<SetStateAction<boolean>>
  fileInputRef: RefObject<HTMLInputElement | null>
  busy: boolean
  chooseFile: (file: File | undefined) => void
}) {
  return (
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
          选择画面扫描导出的结果文件（.json）；载入后仍需检查并确认更新。
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
  )
}
export function FormalImportHandoff({
  current,
  readyForPreflight,
  readyForConfirmation,
  busy,
  embedded,
  secondaryAction,
  confirmationTriggerRef,
  onRunPreflight,
  onOpenConfirmation,
}: {
  current: LoadedFormalImportCurrent
  readyForPreflight: boolean
  readyForConfirmation: boolean
  busy: boolean
  embedded: boolean
  secondaryAction?: ReactNode
  confirmationTriggerRef: RefObject<HTMLButtonElement | null>
  onRunPreflight: () => void
  onOpenConfirmation: () => void
}) {
  const runPreflight = onRunPreflight,
    openConfirmation = onOpenConfirmation
  if (!current.batch) return null
  return (
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
  )
}
export function FormalImportConfirmationDialog({
  current,
  dialogRef,
  cancelRef,
  busy,
  onClose,
  onConfirm,
  onKeyDown,
}: {
  current: LoadedFormalImportCurrent
  dialogRef: RefObject<HTMLElement | null>
  cancelRef: RefObject<HTMLButtonElement | null>
  busy: boolean
  onClose: () => void
  onConfirm: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}) {
  const closeConfirmation = onClose,
    confirmImport = onConfirm,
    containDialogFocus = onKeyDown
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="panel modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-discs-heading"
        onKeyDown={containDialogFocus}
      >
        <h2 id="replace-discs-heading">是否覆盖“{current.account.displayName}”的驱动盘信息？</h2>
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
  )
}
