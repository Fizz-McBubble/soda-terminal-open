import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { readPendingAssetResult, type PendingAssetResult } from '../assetQuickRead/pendingResult'

export function AssetQuickReadPendingResult({
  accountId,
  disabled,
  onContinue,
  onAvailableChange,
}: {
  accountId: string
  disabled: boolean
  onContinue: (value: PendingAssetResult) => void
  onAvailableChange: (available: boolean) => void
}) {
  const loaded = useLiveQuery(async () => {
    try {
      return { result: await readPendingAssetResult(accountId) }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : '暂时无法读取上次结果，请重新进入本页再试。',
      }
    }
  }, [accountId])
  useEffect(() => {
    if (loaded !== undefined) onAvailableChange(Boolean(loaded.result))
  }, [loaded, onAvailableChange])
  if (loaded?.error)
    return (
      <span role="alert" title={loaded.error} aria-label={loaded.error}>
        上次结果暂不可用，请重新读取。
      </span>
    )
  return loaded?.result ? (
    <button
      className="button button--primary"
      type="button"
      disabled={disabled}
      title={`保存在本机：${new Date(loaded.result.savedAt).toLocaleString('zh-CN')}，尚未导入`}
      onClick={() => onContinue(loaded.result!)}
    >
      继续上次读取
    </button>
  ) : null
}
