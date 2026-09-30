import { useEffect, useRef, type RefObject } from 'react'

export function ScannerDiscardDraftDialog({
  open,
  triggerRef,
  targetDisplayName,
  onCancel,
  onConfirm,
}: {
  open: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  targetDisplayName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal()
    else dialog?.setAttribute('open', '')
    cancelRef.current?.focus()
    const trigger = triggerRef.current
    return () => trigger?.focus()
  }, [open, triggerRef])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="scanner-task__confirmation"
      aria-labelledby="scanner-discard-draft-title"
      onCancel={onCancel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
        if (event.key !== 'Tab') return
        const buttons = dialogRef.current?.querySelectorAll('button')
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
      <h3 id="scanner-discard-draft-title">重新读取扫描结果？</h3>
      <p>
        将仅清除“
        {targetDisplayName}
        ”中未导入的不完整扫描结果，再读取本次结果。不会重新扫描游戏或修改账户仓库。
      </p>
      <div className="scanner-task__confirmation-actions">
        <button className="button button--quiet" type="button" ref={cancelRef} onClick={onCancel}>
          取消
        </button>
        <button className="button button--primary" type="button" onClick={onConfirm}>
          确认重新读取
        </button>
      </div>
    </dialog>
  )
}
