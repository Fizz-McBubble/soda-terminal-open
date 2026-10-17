import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import {
  createImportReviewDiagnostic,
  summarizeImportReview,
} from '../scanner/importReviewDiagnostic'
import { saveLastScanDiagnostic } from '../scanner/scanFeedback'
import {
  readImportReviewDiagnosticId,
  saveImportReviewDiagnosticId,
} from '../scanner/importReviewDiagnosticIdentity'
import { ScannerDiagnosticFeedback } from './ScannerDiagnosticFeedback'
import { ScannerCalibrationDialog } from './ScannerCalibrationDialog'
import type { LoadedFormalImportCurrent } from './formalDiscImportCurrent'

export function ScannerImportReviewFeedback({
  current,
  snapshot,
  secondaryAction,
}: {
  current: LoadedFormalImportCurrent
  snapshot?: ScannerAssistantSnapshot
  secondaryAction?: ReactNode
}) {
  const calibrationTriggerRef = useRef<HTMLButtonElement>(null)
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const { items, resultFileHandle } = current
  const matchedSnapshot =
    resultFileHandle && resultFileHandle === snapshot?.summary?.resultFileHandle
      ? snapshot
      : undefined
  const sourceKey = JSON.stringify([current.account.id, current.batch?.id ?? null])
  const reportId = useMemo(
    () => readImportReviewDiagnosticId(sourceKey) ?? crypto.randomUUID(),
    [sourceKey],
  )
  const review = useMemo(() => summarizeImportReview(items), [items])
  const report = useMemo(
    () => createImportReviewDiagnostic(items, reportId, matchedSnapshot),
    [items, reportId, matchedSnapshot],
  )
  useEffect(() => {
    saveImportReviewDiagnosticId(sourceKey, report.reportId)
    saveLastScanDiagnostic(report)
  }, [report, sourceKey])
  return (
    <div className="scanner-inline-import scanner-import-review">
      <p className="scanner-import-review__summary" role="alert">
        还有 {review.counts.reviewRequired} 张需要校准，完成后可确认导入。
      </p>
      {review.categories.length ? (
        <ul className="scanner-import-review__reasons" aria-label="未通过检查的原因">
          {review.categories.map(({ key, label, count }) => (
            <li key={key}>
              {label}：{count} 张
            </li>
          ))}
        </ul>
      ) : null}
      <ScannerCalibrationDialog
        open={calibrationOpen}
        current={current}
        triggerRef={calibrationTriggerRef}
        onClose={() => setCalibrationOpen(false)}
      />
      <div className="scanner-import-review__footer scanner-import-review__actions">
        <button
          ref={calibrationTriggerRef}
          className="button button--primary scanner-import-review__calibration"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={calibrationOpen}
          onClick={() => setCalibrationOpen(true)}
        >
          校准后确认导入
        </button>
        {secondaryAction}
        <ScannerDiagnosticFeedback report={report} compact inline />
      </div>
    </div>
  )
}
