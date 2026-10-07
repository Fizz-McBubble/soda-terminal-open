import { useState, type RefObject } from 'react'
import type { AssetGoldenProps } from './types'
import './asset-dialog.css'

export function DiscBulkDeleteDialog({
  dialogRef,
  open,
  pending,
  onNativeClose,
  onClose,
  onDelete,
  onDeleted,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  open: boolean
  pending: Array<{ stableId: string; revision: string }>
  onNativeClose: () => void
  onClose: () => void
  onDelete: AssetGoldenProps['onDeleteDiscs']
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [confirmation, setConfirmation] = useState({ pending, value: '' })
  const value = confirmation.pending === pending ? confirmation.value : ''
  return (
    <dialog
      className="soda-asset-dialog"
      ref={dialogRef}
      open={open || undefined}
      aria-labelledby="bulk-delete-title"
      onCancel={(event) => {
        if (deleting) event.preventDefault()
      }}
      onClose={onNativeClose}
    >
      <form>
        <header>
          <div>
            <small>删除确认</small>
            <h2 id="bulk-delete-title">删除 {pending.length} 张驱动盘？</h2>
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
        <p>
          将从当前账户移除这 {pending.length}{' '}
          张驱动盘。关联鉴定记录会一并删除，当前装备和候选方案不再引用已删条目。
        </p>
        <p>页面内不能撤销；如需回退，请使用删除前导出的账户备份。</p>
        <label className="field">
          删除确认
          <input
            aria-label="删除确认"
            value={value}
            placeholder={`输入“删除 ${pending.length} 张”`}
            onChange={(event) => setConfirmation({ pending, value: event.target.value })}
          />
        </label>
        <footer>
          <button type="button" className="quiet" disabled={deleting} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="danger"
            disabled={deleting || value !== `删除 ${pending.length} 张`}
            onClick={() => {
              setDeleting(true)
              void onDelete(
                pending.map((disc) => disc.stableId),
                Object.fromEntries(pending.map((disc) => [disc.stableId, disc.revision])),
              )
                .then((deleted) => {
                  if (deleted) {
                    onDeleted()
                    onClose()
                  }
                })
                .finally(() => setDeleting(false))
            }}
          >
            确认删除 {pending.length} 张驱动盘
          </button>
        </footer>
      </form>
    </dialog>
  )
}
