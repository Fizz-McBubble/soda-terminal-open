import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { ExplanationPopover } from '../components/ExplanationPopover'

export function DiagnosticEntry({
  title,
  status,
  statusRole,
  children,
  inline = false,
}: {
  title: string
  status: string
  statusRole?: 'alert' | 'status'
  children: ReactNode
  inline?: boolean
}) {
  if (inline) {
    return (
      <section
        className="scanner-diagnostic-entry scanner-diagnostic-entry--inline"
        aria-label={title}
      >
        <span className="scanner-diagnostic-entry__heading sr-only">
          <strong>{title}</strong>
        </span>
        {children}
        <span className="scanner-diagnostic-entry__status sr-only" role={statusRole}>
          {status}
        </span>
      </section>
    )
  }
  return (
    <section className="scanner-diagnostic-entry" aria-label={title}>
      <div className="scanner-diagnostic-entry__heading">
        <strong>
          <FileText size={18} aria-hidden="true" />
          {title}
        </strong>
        {children}
      </div>
      <p className="scanner-diagnostic-entry__status" title={status} role={statusRole}>
        {status}
      </p>
    </section>
  )
}

export function DiagnosticPopover({
  title,
  label = '查看诊断',
  problem,
  nextAction,
  metadata = [],
  metadataLabel = '本次诊断概况',
  receiptId,
  actions,
  message,
  localMessage,
  previous = false,
  variant = 'button',
  showIndicator = false,
}: {
  title: string
  label?: string
  problem: string
  nextAction: string
  metadata?: string[]
  metadataLabel?: string
  receiptId?: string
  actions?: ReactNode
  message?: string
  localMessage?: string
  previous?: boolean
  variant?: 'text' | 'button'
  showIndicator?: boolean
}) {
  return (
    <ExplanationPopover
      label={label}
      title={title}
      align="start"
      variant={variant}
      showIndicator={showIndicator}
      className="scanner-guide scanner-diagnostic-feedback__details"
    >
      {previous ? <p>上次扫描的问题记录</p> : null}
      <div className="scanner-diagnostic-feedback__guidance">
        <p>
          <strong>遇到的问题</strong>
          <span>{problem}</span>
        </p>
        <p>
          <strong>可以这样做</strong>
          <span>{nextAction}</span>
        </p>
      </div>
      <ul className="scanner-diagnostic-feedback__metadata" aria-label={metadataLabel}>
        {metadata.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {receiptId ? (
        <p className="scanner-diagnostic-feedback__receipt">
          <strong>回执编号</strong>
          <span>{receiptId}</span>
        </p>
      ) : null}
      <div className="scanner-diagnostic-feedback__footer">
        <p className="scanner-diagnostic-feedback__privacy">
          仅在点击时发送问题信息，保留 30 天。不含账户、路径、资产快照和原始流量。
        </p>
        {actions ? <div className="scanner-diagnostic-feedback__actions">{actions}</div> : null}
      </div>
      {localMessage ? <p aria-live="polite">{localMessage}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </ExplanationPopover>
  )
}
