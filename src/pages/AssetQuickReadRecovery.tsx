import { useEffect, useId, useRef } from 'react'

export function AssetQuickReadRecovery({
  mode,
  restoreLabel,
  notice,
  targetAccountName,
  hasRecovery,
  disabled,
  armed,
  restoring,
  failureMessage,
  onArm,
  onCancel,
  onRestore,
}: {
  mode: 'legacy' | 'current'
  restoreLabel: '撤销本次导入' | '撤销上次导入'
  notice: string
  targetAccountName?: string
  hasRecovery: boolean
  disabled: boolean
  armed: boolean
  restoring: boolean
  failureMessage?: string
  onArm: () => void
  onCancel: () => void
  onRestore: () => Promise<void>
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!armed) return
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    cancelRef.current?.focus({ preventScroll: true })
    const trigger = triggerRef.current
    return () => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [armed])

  const actions = hasRecovery ? (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="button button--quiet asset-quick-read__recovery-trigger"
        aria-label={restoreLabel}
        title={notice || restoreLabel}
        disabled={disabled}
        onClick={onArm}
      >
        {restoreLabel}
      </button>
      {armed && (
        <dialog
          ref={dialogRef}
          className="scanner-task__confirmation"
          aria-labelledby={titleId}
          onCancel={(event) => {
            event.preventDefault()
            if (!restoring) onCancel()
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return
            const buttons =
              dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
            if (!buttons?.length) return
            const first = buttons[0]!,
              last = buttons[buttons.length - 1]!
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }}
        >
          <h3 id={titleId}>撤销这次资产快读导入？</h3>
          {notice && <p className="scanner-task__confirmation-notice">{notice}</p>}
          {targetAccountName && (
            <p className="scanner-task__confirmation-target">
              目标账户：<strong>{targetAccountName}</strong>
            </p>
          )}
          <p role={failureMessage ? 'alert' : undefined}>
            {failureMessage ||
              '撤销后恢复到这次导入前的代理人和盘库。资产已有后续修改，或保存方案引用将移除或回滚的盘时，会停止撤销并保留原数据。'}
          </p>
          <div className="scanner-task__confirmation-actions">
            <button
              ref={cancelRef}
              type="button"
              className="button button--quiet"
              disabled={restoring}
              onClick={onCancel}
            >
              取消撤销
            </button>
            <button
              type="button"
              className="button"
              disabled={disabled}
              onClick={() => void onRestore()}
            >
              {restoring ? '正在撤销…' : '确认撤销导入'}
            </button>
          </div>
        </dialog>
      )}
    </>
  ) : null
  if (mode === 'current') return actions
  return (
    <div className="asset-quick-read__recovery">
      <p>{notice}</p>
      {actions}
    </div>
  )
}
