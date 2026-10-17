import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  readLatestScannerImportRecovery,
  restoreScannerImport,
} from '../db/accountScanImportRecovery'
import './scanner-import-history.css'

export function ScannerUndoImportAction({
  accountId,
  onOpen,
}: {
  accountId: string
  onOpen: () => void
}) {
  const recovery = useLiveQuery(
    () => readLatestScannerImportRecovery(accountId).catch(() => null),
    [accountId],
  )
  return recovery ? (
    <button className="button button--quiet" type="button" onClick={onOpen}>
      撤销本次导入
    </button>
  ) : null
}

export function ScannerImportHistory({
  accountId,
  accountName,
  open,
  confirmScanner,
  disabled,
  quickHistory,
  onClose,
  onScannerRestored,
}: {
  accountId: string
  accountName: string
  open: boolean
  confirmScanner: boolean
  disabled: boolean
  quickHistory?: ReactNode
  onClose: () => void
  onScannerRestored: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [confirming, setConfirming] = useState(confirmScanner)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState(false)
  const [retry, setRetry] = useState(0)
  const request = useRef({ generation: 0 })
  const loaded = useLiveQuery(async () => {
    if (!open || !accountId) return { recovery: null }
    try {
      return { recovery: await readLatestScannerImportRecovery(accountId) }
    } catch {
      return { recovery: null, error: '暂时无法读取扫描导入记录；不能据此判断没有记录。' }
    }
  }, [accountId, open, retry])
  const recovery = loaded?.recovery
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    const previousFocus = document.activeElement
    const lifecycle = request.current
    try {
      dialog.showModal?.()
    } catch {
      /* Unsupported host uses the open fallback. */
    }
    if (!dialog.open) dialog.setAttribute('open', '')
    cancelRef.current?.focus({ preventScroll: true })
    return () => {
      lifecycle.generation++
      if (dialog.open) dialog.close?.()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  async function undoScanner() {
    if (busy || disabled || !recovery?.canRestore) return
    const identity = ++request.current.generation
    setBusy(true)
    setMessage('')
    try {
      await restoreScannerImport(accountId, recovery.recoveryKey, 'undo_scanner_import')
      if (identity !== request.current.generation) return
      setFailure(false)
      setMessage('已撤销这次扫描导入，盘库已恢复到导入前。原始结果和恢复副本保留。')
      setConfirming(false)
      onScannerRestored()
    } catch (error) {
      if (identity !== request.current.generation) return
      setFailure(true)
      setMessage(error instanceof Error ? error.message : '撤销未完成，账户未修改，请重试。')
    } finally {
      if (identity === request.current.generation) setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="scanner-import-history"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header>
        <h3 id={titleId}>{confirming ? '撤销这次扫描导入？' : '导入记录'}</h3>
        <button
          ref={cancelRef}
          className="button button--quiet"
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          关闭
        </button>
      </header>
      <p className="scanner-import-history__target">
        目标账户：<strong>{accountName}</strong>
      </p>
      {!confirming && <p>这里显示两种方式最近一次导入；撤销只在账户和引用仍满足安全条件时开放。</p>}
      {message && <p role={failure ? 'alert' : 'status'}>{message}</p>}
      <section aria-label="画面扫描导入记录">
        <h4>画面扫描</h4>
        {loaded?.error ? (
          <>
            <p role="alert">{loaded.error}</p>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setRetry(retry + 1)}
            >
              重新读取记录
            </button>
          </>
        ) : recovery === undefined ? (
          <p role="status">正在读取导入记录…</p>
        ) : recovery ? (
          <>
            <p>{new Date(recovery.createdAt).toLocaleString('zh-CN')}</p>
            {recovery.unavailableReason && <p>{recovery.unavailableReason}</p>}
            {confirming ? (
              <>
                <p>
                  撤销后恢复到这次导入前的驱动盘仓库。不会重新扫描或改变代理人养成；后续资产或方案已发生关联变化时，将阻止撤销。
                </p>
                <div className="scanner-import-history__actions">
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(false)}
                  >
                    取消撤销
                  </button>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy || disabled || !recovery.canRestore}
                    onClick={() => void undoScanner()}
                  >
                    {busy ? '正在撤销…' : '确认撤销导入'}
                  </button>
                </div>
              </>
            ) : (
              <button
                className="button button--quiet"
                type="button"
                disabled={disabled || !recovery.canRestore}
                onClick={() => setConfirming(true)}
              >
                撤销上次扫描导入
              </button>
            )}
          </>
        ) : (
          <p>暂无带完整恢复副本的扫描导入记录。旧批次不能据此撤销。</p>
        )}
      </section>
      {!confirming && (
        <section aria-label="资产快读导入记录">
          <h4>资产快读</h4>
          {quickHistory || <p>暂无可撤销的资产快读导入记录。</p>}
        </section>
      )}
    </dialog>
  )
}
