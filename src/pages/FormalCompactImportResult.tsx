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
    <section className="scanner-inline-import scanner-dialog-import" aria-label="扫描结果与导入">
      <div className="scanner-dialog-import__impact">
        <div>
          <span>目标账户</span>
          <strong>{accountName}</strong>
        </div>
        <b>{count} 张 S 级驱动盘</b>
      </div>
      <p>
        仓库 {baselineCount} → {count} 张；匹配的旧盘保留标签和方案引用，其他账户与代理人资料不变。
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
        {secondaryAction}
      </div>
    </section>
  )
}
