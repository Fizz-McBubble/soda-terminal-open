import { useId, useRef } from 'react'
import './scanner-import-history.css'

export function AssetQuickReadIssueDetails({
  issues,
  label,
  title = '资产快读需核对的记录',
  description = '这些问题全部解决前不能导入。下方保留本次结果的逐项检查信息。',
}: {
  issues: string[]
  label?: string
  title?: string
  description?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const close = () => {
    dialog.current?.close()
    trigger.current?.focus({ preventScroll: true })
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="scanner-workbench__history-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        {label ?? `逐项核对（${issues.length} 项）`}
      </button>
      <dialog
        ref={dialog}
        className="scanner-import-history"
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
      >
        <header>
          <h3 id={titleId}>{title}</h3>
          <button className="button button--quiet" type="button" onClick={close}>
            关闭
          </button>
        </header>
        <p>{description}</p>
        <ul>
          {issues.map((issue, index) => (
            <li key={index}>{issue}</li>
          ))}
        </ul>
      </dialog>
    </>
  )
}
