import { AlertTriangle, ShieldCheck } from 'lucide-react'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import { getAverageScannerRate } from './scannerAssistantPresentation'

export function ScannerCompletedSummary({
  snapshot,
  completedImportCount,
}: {
  snapshot: ScannerAssistantSnapshot
  completedImportCount: number | null
}) {
  if (snapshot.state !== 'completed') return null
  const averageRate = getAverageScannerRate(snapshot)
  return (
    <div className="scanner-web__summary" aria-label="驱动盘导入摘要">
      <article>
        <AlertTriangle aria-hidden="true" size={20} />
        <span>本次结果{averageRate == null ? '' : ` · 平均 ${averageRate} 张/分钟`}</span>
        <strong>{snapshot.summary?.uniqueRecords ?? 0} 张</strong>
        <small>可直接导入 {snapshot.summary?.reliable ?? 0} 张</small>
      </article>
      <article>
        <ShieldCheck aria-hidden="true" size={20} />
        <span>待校准</span>
        <strong>{snapshot.summary?.needsReview ?? 0} 张</strong>
        <small>确认导入前不会改动账户</small>
      </article>
      {completedImportCount !== null && (
        <article>
          <span>已导入</span>
          <strong>{completedImportCount} 张</strong>
          <small>当前账户已更新</small>
        </article>
      )}
    </div>
  )
}
