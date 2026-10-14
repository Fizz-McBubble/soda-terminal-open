import type { RefObject } from 'react'

export function AccountRenameDialog({
  dialogRef,
  open,
  pendingRef,
  value,
  renaming,
  error,
  onClose,
  onChangeValue,
  onSave,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  open: boolean
  pendingRef: RefObject<boolean>
  value: string
  renaming: boolean
  error: string | null
  onClose: () => void
  onChangeValue: (val: string) => void
  onSave: () => void
}) {
  return (
    <dialog
      className="soda-asset-dialog account-rename-dialog"
      ref={dialogRef}
      open={open || undefined}
      aria-labelledby="rename-account-title"
      onCancel={(event) => {
        if (pendingRef.current) event.preventDefault()
        else onClose()
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <header>
          <h2 id="rename-account-title">重命名账户</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            disabled={renaming}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <label htmlFor="rename-account-name">账户名称</label>
        <input
          id="rename-account-name"
          autoFocus
          maxLength={40}
          value={value}
          disabled={renaming}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'rename-account-error' : undefined}
          onChange={(event) => onChangeValue(event.target.value)}
        />
        {error ? (
          <p id="rename-account-error" role="alert">
            {error}
          </p>
        ) : null}
        <footer>
          <button type="button" className="quiet" disabled={renaming} onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary" disabled={renaming}>
            {renaming ? '正在保存…' : '保存'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}

export function AccountDeleteDialog({
  dialogRef,
  open,
  deleting,
  deleteTarget,
  onClose,
  onConfirmDelete,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  open: boolean
  deleting: boolean
  deleteTarget: { id: string; displayName: string } | null
  onClose: () => void
  onConfirmDelete: () => void
}) {
  return (
    <dialog
      className="soda-asset-dialog"
      ref={dialogRef}
      open={open || undefined}
      aria-labelledby="delete-account-title"
      onCancel={(event) => {
        if (deleting) event.preventDefault()
      }}
      onClose={onClose}
    >
      <form>
        <header>
          <div>
            <small>永久删除</small>
            <h2 id="delete-account-title">删除“{deleteTarget?.displayName}”？</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            disabled={deleting}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p>该账户的代理人、音擎、邦布、驱动盘、扫描记录、偏好与已保存方案都会永久删除。</p>
        <p>页面内不能撤销；只有此前导出的备份可以恢复。</p>
        <footer>
          <button type="button" className="quiet" disabled={deleting} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="danger"
            disabled={deleting || !deleteTarget}
            onClick={onConfirmDelete}
          >
            {deleting ? '正在删除…' : '永久删除账户'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
