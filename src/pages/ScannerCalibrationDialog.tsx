import { useEffect, useId, useRef, type RefObject } from 'react'
import type { LoadedFormalImportCurrent } from './formalDiscImportCurrent'
import { ScannerManualCalibration } from './ScannerManualCalibration'

export function ScannerCalibrationDialog({
  open,
  current,
  triggerRef,
  onClose,
}: {
  open: boolean
  current: LoadedFormalImportCurrent
  triggerRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const openedAsModal = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.hasAttribute('open')) {
        try {
          if (typeof dialog.showModal === 'function') {
            dialog.showModal()
            openedAsModal.current = true
          } else {
            dialog.setAttribute('open', '')
            openedAsModal.current = false
          }
        } catch {
          dialog.setAttribute('open', '')
          openedAsModal.current = false
        }
      }
      closeButtonRef.current?.focus({ preventScroll: true })
      return
    }
    if (!openedAsModal.current && !dialog.hasAttribute('open')) return
    if (dialog.hasAttribute('open')) {
      const canClose = openedAsModal.current && typeof dialog.close === 'function'
      if (canClose) {
        try {
          dialog.close()
        } catch {
          dialog.removeAttribute('open')
        }
      } else {
        dialog.removeAttribute('open')
      }
    }
    openedAsModal.current = false
    triggerRef.current?.focus({ preventScroll: true })
  }, [open, triggerRef])

  return (
    <dialog
      ref={dialogRef}
      className="scanner-task__confirmation scanner-calibration-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        onClose()
      }}
    >
      <header className="scanner-calibration-dialog__header">
        <h3 id={titleId}>校准后确认导入</h3>
        <button
          ref={closeButtonRef}
          className="button button--quiet scanner-calibration-dialog__close"
          type="button"
          aria-label="关闭校准后确认导入"
          onClick={onClose}
        >
          关闭
        </button>
      </header>
      <div className="scanner-calibration-dialog__body">
        <ScannerManualCalibration current={current} />
      </div>
    </dialog>
  )
}
