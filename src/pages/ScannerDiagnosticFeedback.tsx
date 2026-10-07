import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  diagnosticJson,
  sanitizeScanDiagnostic,
  type ScanDiagnosticReport,
} from '../scanner/diagnostics'
import { ScanFeedbackSubmissionError, submitScanFeedback } from '../scanner/scanFeedback'
import './scanner-diagnostic-feedback.css'

type FeedbackState = { reportId: string; pending?: boolean; message: string; receivedAt?: string }
const stageLabels: Record<string, string> = {
  connection: '连接助手',
  permission: '确认权限',
  preflight: '检查游戏画面',
  capture: '读取盘面',
  scroll: '翻动仓库',
  ocr: '识别文字',
  result: '整理结果',
  import: '检查与导入',
  unknown: '尚未确定',
}
export function ScannerDiagnosticFeedback({ report }: { report: ScanDiagnosticReport | null }) {
  const safe = useMemo(() => sanitizeScanDiagnostic(report), [report])
  const [state, setState] = useState<FeedbackState | null>(null)
  const [localMessage, setLocalMessage] = useState<{ reportId: string; text: string } | null>(null)
  const currentId = useRef<string | null>(null)
  const pendingId = useRef<string | null>(null)
  useLayoutEffect(() => {
    currentId.current = safe?.reportId ?? null
  }, [safe?.reportId])
  if (!safe) return null
  const currentState = state?.reportId === safe.reportId ? state : null
  const text = diagnosticJson(safe)

  async function submit() {
    if (!safe || pendingId.current === safe.reportId || currentState?.receivedAt) return
    const reportId = safe.reportId
    pendingId.current = reportId
    setState({ reportId, pending: true, message: '正在发送反馈…' })
    try {
      const receipt = await submitScanFeedback(safe)
      if (currentId.current === reportId)
        setState({ reportId, message: '反馈已收到，谢谢。', receivedAt: receipt.receivedAt })
    } catch (error) {
      if (currentId.current === reportId)
        setState({
          reportId,
          message:
            error instanceof ScanFeedbackSubmissionError && error.reason === 'unavailable'
              ? '反馈暂时无法发送，请稍后再试。'
              : error instanceof ScanFeedbackSubmissionError && error.reason === 'release_changed'
                ? '这份反馈已更新，请重新尝试。'
                : '发送失败，请再试一次。',
        })
    } finally {
      if (pendingId.current === reportId) pendingId.current = null
    }
  }
  async function copy() {
    if (!safe) return
    const reportId = safe.reportId
    try {
      await navigator.clipboard.writeText(text)
      if (currentId.current === reportId) setLocalMessage({ reportId, text: '诊断已复制。' })
    } catch {
      if (currentId.current === reportId)
        setLocalMessage({ reportId, text: '复制失败，可选择下方诊断文字或下载。' })
    }
  }
  function download() {
    if (!safe) return
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `soda-scan-diagnostic-${safe.reportId}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setLocalMessage({ reportId: safe.reportId, text: '诊断下载已开始。' })
    } catch {
      setLocalMessage({ reportId: safe.reportId, text: '下载失败，可复制诊断或选择下方文字。' })
    }
  }
  return (
    <section className="scanner-diagnostic-feedback" aria-label="扫描问题反馈">
      <div className="scanner-diagnostic-feedback__main">
        <button
          className="button button--secondary"
          type="button"
          disabled={Boolean(currentState?.pending || currentState?.receivedAt)}
          onClick={() => void submit()}
        >
          {currentState?.pending ? '发送中…' : currentState?.receivedAt ? '已反馈' : '反馈此问题'}
        </button>
        <p>仅在点击时发送，不含账户和驱动盘资料。</p>
      </div>
      {currentState?.message ? <p role="status">{currentState.message}</p> : null}
      <details className="scanner-diagnostic-feedback__details">
        <summary>查看诊断信息</summary>
        <p>
          Cloudflare 仅接收下方诊断信息并保存 30 天。不包含账户、游戏
          UID、驱动盘内容、截图或联系方式。
        </p>
        <p>
          问题阶段：{stageLabels[safe.stage]} · 已处理：{safe.counts.processed ?? '未知'} /{' '}
          {safe.counts.total ?? '总数未知'} · 耗时：
          {safe.durationMs === null ? '未知' : `${(safe.durationMs / 1000).toFixed(1)} 秒`}
        </p>
        <p>错误码：{safe.code}</p>
        <div className="scanner-diagnostic-feedback__actions">
          <button className="button button--quiet" type="button" onClick={() => void copy()}>
            复制诊断
          </button>
          <button className="button button--quiet" type="button" onClick={download}>
            下载诊断
          </button>
        </div>
        {localMessage?.reportId === safe.reportId ? (
          <p aria-live="polite">{localMessage.text}</p>
        ) : null}
        <pre tabIndex={0} aria-label="扫描技术诊断内容">
          {text}
        </pre>
      </details>
    </section>
  )
}
