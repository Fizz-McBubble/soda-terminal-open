import { getActiveAccount } from '../accounts/repository'

export async function acceptCommittedPlanEditorSave({
  accountId,
  originatingPathname,
  originatingSearch,
  isCurrentSave,
  setMessage,
  commitDraft,
}: {
  accountId: string | null
  originatingPathname: string
  originatingSearch: string
  isCurrentSave: () => boolean
  setMessage: (message: string) => void
  commitDraft: () => boolean
}) {
  const activeAccount = await getActiveAccount().catch(() => null)
  const committed = commitDraft()
  if (
    !isCurrentSave() ||
    window.location.pathname !== originatingPathname ||
    window.location.search !== originatingSearch
  )
    return false
  if (!activeAccount) {
    setMessage('方案已保存，当前账户暂时无法确认。')
    return false
  }
  if (activeAccount.id !== accountId) return false
  if (!committed) setMessage('已保存提交时的方案，后续修改仍未保存。')
  return committed
}
