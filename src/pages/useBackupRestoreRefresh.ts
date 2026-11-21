import { useEffect, useRef, useState } from 'react'
import { getActiveAccount } from '../accounts/repository'
import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'

export const backupRestoreRefreshFailure = '备份已恢复。配装建议暂未更新，请返回首页重新分析。'
export const backupRestoreRefreshSuccess = '备份已恢复，当前账户资料已重新读取。'

/** A restore commits before the provider's live query adopts the selected account. */
export function useBackupRestoreRefresh(
  world: AccountDecisionWorldContextValue | null,
  report: (message: string) => void,
) {
  const [request, setRequest] = useState<{ accountId: string } | null>(null)
  const completed = useRef<typeof request>(null)
  const liveAccountId = world?.liveInput?.warehouse.accountId
  const refresh = world?.refresh

  useEffect(() => {
    if (!request || completed.current === request) return
    let active = true
    void (async () => {
      try {
        const account = await getActiveAccount()
        if (!active) return
        if (account?.id !== request.accountId) {
          completed.current = request
          return
        }
        // Never call the refresh closure belonging to the pre-restore account.
        if (refresh && liveAccountId !== request.accountId) return
        const run = refresh
          ? await Promise.resolve()
              .then(refresh)
              .catch(() => null)
          : null
        const current = await getActiveAccount()
        if (!active || current?.id !== request.accountId) return
        completed.current = request
        report(
          !refresh || run?.input.warehouse.accountId === request.accountId
            ? backupRestoreRefreshSuccess
            : backupRestoreRefreshFailure,
        )
      } catch {
        if (!active) return
        completed.current = request
        report(backupRestoreRefreshFailure)
      }
    })()
    return () => {
      active = false
    }
  }, [request, liveAccountId, refresh, report])

  return setRequest
}
