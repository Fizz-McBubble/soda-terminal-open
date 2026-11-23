import type { RefObject } from 'react'
import type { BackupPreview } from './types'
import { AccountRestorePreview } from './AccountRestorePreview'

export function AccountRestoreDialog({
  dialogRef,
  open,
  restoring,
  restorePendingRef,
  preview,
  operationError,
  restoreCancelRef,
  onClose,
  onNativeClose,
  onPreviewChange,
  onConfirmRestore,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  open: boolean
  restoring: boolean
  restorePendingRef: RefObject<boolean>
  preview: BackupPreview | null
  operationError: string | null
  restoreCancelRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onNativeClose: () => void
  onPreviewChange: (preview: BackupPreview | null) => void
  onConfirmRestore: () => void
}) {
  return (
    <dialog
      className="soda-asset-dialog"
      ref={dialogRef}
      open={open || undefined}
      aria-labelledby="restore-title"
      aria-describedby={preview ? 'restore-summary' : undefined}
      aria-busy={restoring || undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!restorePendingRef.current) onClose()
      }}
      onClose={onNativeClose}
    >
      <form>
        <header>
          <div>
            <small>恢复确认</small>
            <h2 id="restore-title">用所选备份恢复账户？</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            disabled={restoring}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {preview && (
          <AccountRestorePreview
            preview={preview}
            restoring={restoring}
            onChange={onPreviewChange}
          />
        )}
        {operationError && preview ? <p role="alert">{operationError}</p> : null}
        <footer>
          <button
            ref={restoreCancelRef}
            type="button"
            className="quiet"
            disabled={restoring}
            onClick={onClose}
          >
            取消
          </button>
          <button type="button" className="danger" disabled={restoring} onClick={onConfirmRestore}>
            {restoring
              ? '正在恢复…'
              : preview?.identity === 'same_name_different_id'
                ? '作为独立账户恢复'
                : '恢复这份备份'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
