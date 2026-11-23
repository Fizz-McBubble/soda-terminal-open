import { useEffect, useState } from 'react'
import { loadAssetAccountIdentity, loadAssetData } from './assetCenterData'

export const backupRestoreRefreshFailure = '备份已恢复。当前账户资料暂未更新，请重试读取。'
export const backupRestoreRefreshSuccess = '备份已恢复，当前账户资料已重新读取。'
export const backupRestoreRefreshAccountChanged =
  '备份已恢复。当前账户已切换，请在当前账户重新分析。'

/** Read committed account assets before reporting completion on the backup page. */
export function useBackupRestoreRefresh(report: (message: string) => void) {
  const [request, setRequest] = useState<{ accountId: string } | null>(null)

  useEffect(() => {
    if (!request) return
    let active = true
    void (async () => {
      try {
        const assets = await loadAssetData().catch(() => null)
        if (!active) return
        const accountId = await loadAssetAccountIdentity()
        if (!active) return
        if (accountId !== request.accountId) report(backupRestoreRefreshAccountChanged)
        else if (assets?.account?.id === accountId) report(backupRestoreRefreshSuccess)
        else report(backupRestoreRefreshFailure)
      } catch {
        if (active) report(backupRestoreRefreshFailure)
      }
    })()
    return () => {
      active = false
    }
  }, [request, report])

  return setRequest
}
