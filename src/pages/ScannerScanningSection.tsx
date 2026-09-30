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
          本次扫描目标：{targetBinding.displayName} · 替换前 {targetBinding.baselineDiscCount} 张
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
        <p>
          <strong>扫描期间请不要操作游戏</strong>
          <span>不要使用鼠标键盘、切换游戏页面或最小化窗口。</span>
        </p>
      </div>
      <ScannerProgress snapshot={snapshot} />
      <div className="scanner-web__scan-actions">
        <button className="button button--quiet" type="button" onClick={onSafeStop}>
          <CircleStop aria-hidden="true" size={17} />
          停止本次扫描
        </button>
        <small>停止后不会生成或导入结果；你可以回到准备步骤重新开始。</small>
      </div>
    </>
  )
}
