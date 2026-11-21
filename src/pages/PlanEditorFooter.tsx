import { useRef, type RefObject } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { usePageOperationScope } from '../components/usePageOperationScope'
import { PlanningDialog } from './TeamSolverWorkspaceParts'

export function PlanEditorFooter({
  deleteAction,
  kind,
  generated,
  saved,
  save,
  saving,
  savingRef,
  scopeIdentity,
  readOnly,
  message,
  confirmLeave,
  setConfirmLeave,
  discard,
  backButton,
  navigate,
  back,
}: {
  deleteAction?: import('react').ReactNode
  kind: 'team' | 'agent'
  generated: boolean
  saved: boolean
  save: () => Promise<boolean>
  saving: boolean
  savingRef: RefObject<boolean>
  scopeIdentity: string
  readOnly: boolean
  message: string
  confirmLeave: boolean
  setConfirmLeave: (value: boolean) => void
  discard: () => void
  backButton: RefObject<HTMLButtonElement | null>
  navigate: NavigateFunction
  back: string
}) {
  const leaveIntent = useRef(0)
  const captureLeaveScope = usePageOperationScope(scopeIdentity)
  return (
    <>
      <div className="button-row">
        {deleteAction}
        {kind !== 'team' && (generated || kind === 'agent') ? (
          <button className="primary-action" onClick={save} disabled={readOnly || saving}>
            保存角色方案
          </button>
        ) : null}
        {!saved && kind !== 'team' ? (
          <span className="muted-note">保存后可与同范围方案比较。</span>
        ) : null}
      </div>
      {message ? <p role={message.startsWith('已保存') ? 'status' : 'alert'}>{message}</p> : null}
      {confirmLeave ? (
        <PlanningDialog
          title="尚未保存调整"
          description="离开会放弃本次方案调整，不影响资产、仓库或已保存方案。"
          onCancel={() => {
            leaveIntent.current += 1
            setConfirmLeave(false)
            window.setTimeout(() => backButton.current?.focus(), 0)
          }}
        >
          <div className="button-row">
            <button
              autoFocus
              onClick={() => {
                leaveIntent.current += 1
                setConfirmLeave(false)
                window.setTimeout(() => backButton.current?.focus(), 0)
              }}
            >
              留在此页
            </button>
            <button
              disabled={saving}
              onClick={async () => {
                if (savingRef.current) return
                const intent = ++leaveIntent.current
                const isCurrentLeave = captureLeaveScope()
                if ((await save()) && isCurrentLeave() && leaveIntent.current === intent)
                  navigate(back)
              }}
            >
              保存并继续
            </button>
            <button
              disabled={saving}
              onClick={() => {
                if (savingRef.current) return
                discard()
                navigate(back)
              }}
            >
              放弃更改
            </button>
          </div>
        </PlanningDialog>
      ) : null}
    </>
  )
}
