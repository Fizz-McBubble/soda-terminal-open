import type { PendingAssetResult } from '../assetQuickRead/pendingResult'
import type { PendingResultRead } from './usePendingAssetResult'

export function AssetQuickReadPendingResult({
  state,
  disabled,
  onContinue,
  onRetry,
}: {
  state: PendingResultRead
  disabled: boolean
  onContinue: (value: PendingAssetResult) => void
  onRetry: () => void
}) {
  if (state.status === 'loading') return <span role="status">正在核对上次读取结果。</span>
  if (state.status === 'error')
    return (
      <>
        <span role="alert">{state.message}</span>
        <button
          className="button button--quiet"
          type="button"
          disabled={disabled}
          onClick={onRetry}
        >
          重试核对
        </button>
      </>
    )
  return state.status === 'available' ? (
    <button
      className="button button--primary"
      type="button"
      disabled={disabled}
      title={`保存在本机：${new Date(state.result.savedAt).toLocaleString('zh-CN')}，尚未导入`}
      onClick={() => onContinue(state.result)}
    >
      继续上次读取
    </button>
  ) : null
}
