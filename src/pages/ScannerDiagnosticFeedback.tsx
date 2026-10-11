import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  diagnosticJson,
  sanitizeScanDiagnostic,
  diagnosticFromSnapshot,
  type ScanDiagnosticReport,
} from '../scanner/diagnostics'
import {
  readScanFeedbackReceipt,
  readLastScanDiagnostic,
  ScanFeedbackSubmissionError,
  submitScanFeedback,
} from '../scanner/scanFeedback'
import { DiagnosticEntry, DiagnosticPopover } from './DiagnosticFeedbackPresentation'
import { scannerDiagnosticGuidance } from './scannerDiagnosticGuidance'
import './scanner-diagnostic-feedback.css'
import './scanner-guide.css'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'

type FeedbackState = {
  reportId: string
  reportKey: string
  pending?: boolean
  message: string
  receivedAt?: string
  receivedReportId?: string
}
export function ScannerDiagnosticFeedback({
  report,
  secondaryAction,
  compact = false,
  snapshot,
}: {
  report: ScanDiagnosticReport | null
  secondaryAction?: ReactNode
  compact?: boolean
  snapshot?: ScannerAssistantSnapshot
}) {
  const [statusId] = useState(() => crypto.randomUUID())
  const safe = useMemo(() => {
    const active =
      snapshot &&
      ['checking', 'awaiting_elevation', 'scanning', 'paused', 'completed'].includes(snapshot.state)
    const saved = report ?? (compact && !active ? readLastScanDiagnostic() : null)
    if (saved) return sanitizeScanDiagnostic(saved)
    if (!snapshot) return null
    return sanitizeScanDiagnostic({
      ...diagnosticFromSnapshot(snapshot, statusId),
      outcome: snapshot.state === 'completed' ? 'completed' : 'unknown',
      code: 'none',
      evidence: { uiState: snapshot.state, diagnosticSource: 'browser_connection' },
      stage:
        snapshot.state === 'scanning'
          ? 'capture'
          : snapshot.state === 'completed'
            ? 'result'
            : 'connection',
    })
  }, [report, compact, snapshot, statusId])
  const reportKey = safe ? JSON.stringify(safe) : null
  const [state, setState] = useState<FeedbackState | null>(null)
  const [localMessage, setLocalMessage] = useState<{ reportKey: string; text: string } | null>(null)
  const currentId = useRef<string | null>(null)
  const pendingId = useRef<string | null>(null)
  useLayoutEffect(() => {
    currentId.current = reportKey
  }, [reportKey])
  if (!safe || !reportKey)
    return compact ? (
      <DiagnosticEntry title="扫描诊断" status="暂无扫描问题记录。">
        <DiagnosticPopover
          title="扫描诊断"
          problem="暂无扫描问题记录。"
          nextAction="遇到问题时，可在此查看诊断并反馈。"
        />
      </DiagnosticEntry>
    ) : null
  const savedReceipt = readScanFeedbackReceipt(safe)
  const currentState: FeedbackState | null =
    state?.reportKey === reportKey
      ? state
      : savedReceipt
        ? {
            reportId: safe.reportId,
            reportKey,
            message: '反馈已收到，谢谢。',
            receivedAt: savedReceipt.receivedAt,
            receivedReportId: savedReceipt.report.reportId,
          }
        : null
  const receivedReport = currentState?.receivedReportId
    ? { ...safe, reportId: currentState.receivedReportId }
    : safe
  const text = diagnosticJson(receivedReport)
  const isStatus = safe.code === 'none'
  const guidance = isStatus
    ? {
        problem:
          snapshot?.state === 'scanning' ? '扫描进行中，暂无问题记录。' : '暂无扫描问题记录。',
        nextAction: '若界面无反应，可反馈当前状态。',
      }
    : scannerDiagnosticGuidance(safe)

  async function submit() {
    if (!safe || !reportKey || pendingId.current === reportKey || currentState?.receivedAt) return
    const reportId = safe.reportId
    pendingId.current = reportKey
    setState({ reportId, reportKey, pending: true, message: '正在发送反馈…' })
    try {
      const receipt = await submitScanFeedback(safe)
      if (currentId.current === reportKey)
        setState({
          reportId,
          reportKey,
          message: '反馈已收到，谢谢。',
          receivedAt: receipt.receivedAt,
          receivedReportId: receipt.reportId,
        })
    } catch (error) {
      if (currentId.current === reportKey)
        setState({
          reportId,
          reportKey,
          message:
            error instanceof ScanFeedbackSubmissionError && error.reason === 'unavailable'
              ? '反馈暂时无法发送，请稍后再试。'
              : error instanceof ScanFeedbackSubmissionError && error.reason === 'release_changed'
                ? '这份反馈已更新，请重新尝试。'
                : '发送失败，请再试一次。',
        })
    } finally {
      if (pendingId.current === reportKey) pendingId.current = null
    }
  }
  async function copy() {
    if (!safe || !reportKey) return
    try {
      await navigator.clipboard.writeText(text)
      if (currentId.current === reportKey) setLocalMessage({ reportKey, text: '诊断已复制。' })
    } catch {
      if (currentId.current === reportKey)
        setLocalMessage({ reportKey, text: '复制失败，可下载诊断文件。' })
    }
  }
  function download() {
    if (!safe || !reportKey) return
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `soda-scan-diagnostic-${receivedReport.reportId}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setLocalMessage({ reportKey, text: '诊断下载已开始。' })
    } catch {
      setLocalMessage({ reportKey, text: '下载失败，可复制诊断或稍后重试。' })
    }
  }
  const sendAction = (
    <button
      className={compact ? 'button button--quiet' : 'button button--secondary'}
      type="button"
      disabled={Boolean(currentState?.pending || currentState?.receivedAt)}
      onClick={() => void submit()}
    >
      {currentState?.pending
        ? '发送中…'
        : currentState?.receivedAt
          ? '已反馈'
          : isStatus
            ? '反馈当前状态'
            : '反馈此问题'}
    </button>
  )
  const metadata: string[] = []
  if (typeof safe.counts.reviewRequired === 'number' && safe.counts.reviewRequired > 0)
    metadata.push(`需校准 ${safe.counts.reviewRequired} 张`)
  if (safe.counts.processed !== null)
    metadata.push(
      `已处理 ${safe.counts.processed}${safe.counts.total !== null ? ` / ${safe.counts.total}` : ''} 张`,
    )
  else if (safe.counts.total !== null) metadata.push(`共 ${safe.counts.total} 张`)
  if (safe.durationMs !== null) metadata.push(`耗时 ${(safe.durationMs / 1000).toFixed(1)} 秒`)
  if (safe.versions.installer) metadata.push(`画面扫描 v${safe.versions.installer}`)
  const details = (
    <DiagnosticPopover
      key={reportKey}
      title="扫描诊断"
      label={compact ? '查看诊断' : '查看诊断信息'}
      problem={guidance.problem}
      nextAction={guidance.nextAction}
      metadata={metadata}
      metadataLabel="本次扫描概况"
      receiptId={currentState?.receivedReportId}
      previous={compact && !report && !isStatus}
      message={compact ? currentState?.message : undefined}
      localMessage={localMessage?.reportKey === reportKey ? localMessage.text : undefined}
      actions={
        <>
          {compact ? sendAction : null}
          <button className="button button--quiet" type="button" onClick={() => void copy()}>
            复制诊断
          </button>
          <button className="button button--quiet" type="button" onClick={download}>
            下载诊断
          </button>
          {compact ? secondaryAction : null}
        </>
      }
    />
  )
  return compact ? (
    <DiagnosticEntry
      title="扫描诊断"
      status={
        currentState?.receivedAt
          ? '本次反馈已发送。'
          : compact && !report && !isStatus
            ? `上次：${guidance.problem}`
            : guidance.problem
      }
    >
      {details}
    </DiagnosticEntry>
  ) : (
    <section className="scanner-diagnostic-feedback" aria-label="扫描问题反馈">
      <div className="scanner-diagnostic-feedback__main">
        {sendAction}
        {secondaryAction}
        <p>仅在点击时发送，不含账户和驱动盘资料。</p>
        {details}
      </div>
      {currentState?.message ? <p role="status">{currentState.message}</p> : null}
    </section>
  )
}
