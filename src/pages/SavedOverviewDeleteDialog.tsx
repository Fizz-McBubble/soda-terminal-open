import { useRef, useState } from 'react'
import { deleteAccountPlanningDraft } from '../accounts/planningDrafts'
import { PlanningDialog } from './TeamSolverWorkspaceParts'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'

export function SavedOverviewDeleteDialog({
  accountId,
  item,
  onCancel,
  onDeleted,
}: {
  accountId: string | null | undefined
  item: Pick<TeamLoadoutOverviewItem, 'id' | 'title'>
  onCancel: () => void
  onDeleted: (title: string) => void | Promise<void>
}) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancel = () => {
    if (!pending.current) onCancel()
  }
  return (
    <PlanningDialog
      title="删除已保存方案？"
      description={`将删除 1 个已保存方案“${item.title}”。不会影响资产、仓库或游戏数据。`}
      onCancel={cancel}
    >
      {error ? <p role="alert">{error}</p> : null}
      <div className="button-row">
        <button autoFocus type="button" disabled={busy} onClick={cancel}>
          取消
        </button>
        <button
          className="button--danger"
          type="button"
          disabled={busy}
          onClick={async () => {
            if (pending.current) return
            if (!accountId) {
              setError('当前账户不可用，请关闭后重新选择账户。')
              return
            }
            pending.current = true
            setBusy(true)
            setError(null)
            try {
              await deleteAccountPlanningDraft(accountId, item.id.replace(/^saved:/, ''))
            } catch {
              pending.current = false
              setBusy(false)
              setError('删除失败，方案仍保留，请重试。')
              return
            }
            try {
              await onDeleted(item.title)
            } finally {
              pending.current = false
              setBusy(false)
            }
          }}
        >
          {busy ? '正在删除…' : '确认删除'}
        </button>
      </div>
    </PlanningDialog>
  )
}
