import type { ReactNode } from 'react'

export function FormalCompactImportResult({
  accountName,
  baselineCount,
  count,
  ready,
  complete,
  busy,
  error,
  message,
  secondaryAction,
  onImport,
  onRetry,
}: {
  accountName: string
  baselineCount: number
  count: number
  ready: boolean
  complete: boolean
  busy: boolean
  error: boolean
  message: string
  secondaryAction?: ReactNode
  onImport: () => void
  onRetry: () => void
}) {
  return (
    <section
      className="scanner-inline-import scanner-dialog-import"
      aria-label="扫描结果与导入"
      aria-busy={busy}
    >
      <div className="scanner-dialog-import__impact">
        <div>
          <span>目标账户</span>
          <strong>{accountName}</strong>
        </div>
        <b>{count} 张 S 级驱动盘</b>
      </div>
      <p>
        当前账户已记录 {baselineCount} 张驱动盘。本次结果包含 {count} 张 S
        级驱动盘；检查通过并确认后，只替换该账户已确认的 S 级记录，A/B
        级和品质未确认记录保留。匹配到的旧盘会保留本地标记和方案引用，其他账户与代理人资料不变。
      </p>
      {error ? (
        <p className="danger-note" role="alert">
          {message}
        </p>
      ) : !complete ? (
        <p className="danger-note" role="alert">
          扫描结果不完整，无法导入，请重新扫描。
        </p>
      ) : !ready ? (
        <p role="status">正在检查结果；尚未导入。</p>
      ) : null}
      <div className="scanner-dialog-import__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={!ready || busy}
          onClick={onImport}
        >
          {busy && ready ? '正在导入' : '导入'}
        </button>
        {error && !ready ? (
          <button className="button button--quiet" type="button" disabled={busy} onClick={onRetry}>
            重新检查
          </button>
        ) : null}
        <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, display: 'contents' }}>
          {secondaryAction}
        </fieldset>
      </div>
    </section>
  )
}
