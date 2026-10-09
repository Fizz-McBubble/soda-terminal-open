import { Clock3, LoaderCircle } from 'lucide-react'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import { getAverageScannerRate } from './scannerAssistantPresentation'

export function ScannerProgress({ snapshot }: { snapshot: ScannerAssistantSnapshot }) {
  const processed = snapshot.progress?.processed ?? 0
  const total = snapshot.progress?.total
  const hasTotal = total != null && total > 0
  const progress = hasTotal ? Math.min(100, Math.round((processed / total) * 100)) : null
  const averageRate = getAverageScannerRate(snapshot)

  return (
    <div
      className="scanner-web__progress"
      aria-label={progress == null ? '扫描进度，总量待确认' : `扫描进度 ${progress}%`}
    >
      <div className="scanner-web__progress-heading">
        <div>
          <span>当前进度</span>
          <strong>
            {processed}
            <small>{hasTotal ? ` / ${total}` : ' 张已处理'}</small>
          </strong>
        </div>
        <b>{progress == null ? '总量待确认' : `${progress}%`}</b>
      </div>
      <progress
        aria-label={
          hasTotal ? `已处理 ${processed}，共 ${total}` : `已处理 ${processed}，总量待确认`
        }
        max={hasTotal ? total : undefined}
        value={hasTotal ? processed : undefined}
      >
        {progress == null ? '总量待确认' : `${progress}%`}
      </progress>
      <div className="scanner-web__progress-meta">
        <span>
          <LoaderCircle aria-hidden="true" size={16} />
          {snapshot.progress?.stageLabel}
        </span>
        {averageRate == null ? null : (
          <span>
            <Clock3 aria-hidden="true" size={16} />
            平均 {averageRate} 张/分钟
          </span>
        )}
      </div>
    </div>
  )
}
