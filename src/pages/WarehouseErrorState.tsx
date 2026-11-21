import { Archive } from 'lucide-react'
import type { useAccountDecisionWorld } from '../application/accountDecisionWorld'

export function WarehouseErrorState({
  decisionWorld,
  repairingApplicationData,
  retryingRead,
  readRetryError,
  onRepairApplicationData,
  onRetryWarehouseRead,
}: {
  decisionWorld: Extract<ReturnType<typeof useAccountDecisionWorld>, { status: 'error' }>
  repairingApplicationData: boolean
  retryingRead: boolean
  readRetryError: string | null
  onRepairApplicationData: () => void
  onRetryWarehouseRead: () => void
}) {
  return (
    <section className="warehouse-empty" aria-live="polite">
      <Archive size={28} />
      <h1>驱动盘分析</h1>
      <p>{decisionWorld.message}</p>
      {decisionWorld.canRepairApplicationData ? (
        <div className="warehouse-empty__actions app-recovery-actions">
          <p>仅修复应用资料，不修改账户资产。</p>
          <button
            className="button button--primary"
            type="button"
            disabled={repairingApplicationData}
            onClick={onRepairApplicationData}
          >
            {repairingApplicationData ? '正在恢复…' : '恢复应用自带资料'}
          </button>
        </div>
      ) : (
        <div className="warehouse-empty__actions app-recovery-actions">
          <button
            className="button button--primary"
            type="button"
            disabled={retryingRead}
            onClick={onRetryWarehouseRead}
          >
            {retryingRead ? '正在重新读取…' : '重新读取仓库'}
          </button>
          {readRetryError ? <p role="alert">{readRetryError}</p> : null}
        </div>
      )}
    </section>
  )
}
