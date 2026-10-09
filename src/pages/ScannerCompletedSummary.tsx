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
        <strong>{snapshot.summary?.uniqueRecords ?? 0}</strong>
        <small>
          可直接导入 {snapshot.summary?.reliable ?? 0} · 待检查 {snapshot.summary?.needsReview ?? 0}
        </small>
      </article>
      <article>
        <ShieldCheck aria-hidden="true" size={20} />
        <span>更新账户</span>
        <strong>{completedImportCount ?? 0}</strong>
        <small>{completedImportCount === null ? '确认导入前不会改动账户' : '当前账户已更新'}</small>
      </article>
    </div>
  )
}
