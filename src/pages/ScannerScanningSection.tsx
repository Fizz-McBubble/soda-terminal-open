import { AlertTriangle, CircleStop } from 'lucide-react'
import { StatusBanner } from '../components/ui/StatusBanner'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import type { ScannerTargetAccountBinding } from '../scanner/targetAccountBinding'
import { ScannerProgress } from './ScannerProgress'

export function ScannerScanningSection({
  targetBinding,
  frozenTargetIssue,
  snapshot,
  onReturnToTargetSelection,
  onSafeStop,
}: {
  targetBinding: ScannerTargetAccountBinding | null
  frozenTargetIssue: { title: string; message: string } | null
  snapshot: ScannerAssistantSnapshot
  onReturnToTargetSelection: () => void
  onSafeStop: () => void
}) {
  return (
    <>
      {targetBinding ? (
        <p className="scanner-target-account__frozen" role="status">
          目标账户：{targetBinding.displayName}
        </p>
      ) : (
        <p className="danger-note" role="alert">
          本次扫描缺少目标账户绑定；结果不会进入正式导入。
        </p>
      )}
      {frozenTargetIssue ? (
        <StatusBanner
          className="scanner-target-mismatch"
          tone="error"
          title={frozenTargetIssue.title}
          action={
            <button
              className="button button--quiet"
              type="button"
              onClick={onReturnToTargetSelection}
            >
              返回准备步骤重新选择
            </button>
          }
        >
          <p>{frozenTargetIssue.message}</p>
        </StatusBanner>
      ) : null}
      <div className="scanner-web__interaction-lock" role="alert">
        <AlertTriangle aria-hidden="true" size={20} />
        <p>扫描期间请不要操作、切换或最小化游戏。</p>
      </div>
      <ScannerProgress snapshot={snapshot} />
      <div className="scanner-web__scan-actions">
        <button className="button button--quiet" type="button" onClick={onSafeStop}>
          <CircleStop aria-hidden="true" size={17} />
          停止本次扫描
        </button>
        <small>停止后不会导入，可重新扫描。</small>
      </div>
    </>
  )
}
