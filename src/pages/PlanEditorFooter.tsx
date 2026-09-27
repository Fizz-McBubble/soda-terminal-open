import type { RefObject } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { PlanningDialog } from './TeamSolverWorkspaceParts'

export function PlanEditorFooter({
  deleteAction,
  kind,
  generated,
  saved,
  save,
  readOnly,
  message,
  confirmLeave,
  setConfirmLeave,
  backButton,
  navigate,
  back,
}: {
  deleteAction?: import('react').ReactNode
  kind: 'team' | 'agent'
  generated: boolean
  saved: boolean
  save: () => Promise<boolean>
  readOnly: boolean
  message: string
  confirmLeave: boolean
  setConfirmLeave: (value: boolean) => void
  backButton: RefObject<HTMLButtonElement | null>
  navigate: NavigateFunction
  back: string
}) {
  return (
    <>
      <div className="button-row">
        {deleteAction}
        {kind !== 'team' && (generated || kind === 'agent') ? (
          <button className="primary-action" onClick={save} disabled={readOnly}>
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
            setConfirmLeave(false)
            window.setTimeout(() => backButton.current?.focus(), 0)
          }}
        >
          <div className="button-row">
            <button
              autoFocus
              onClick={() => {
                setConfirmLeave(false)
                window.setTimeout(() => backButton.current?.focus(), 0)
              }}
            >
              留在此页
            </button>
            <button
              onClick={async () => {
                if (await save()) navigate(back)
              }}
            >
              保存并继续
            </button>
            <button onClick={() => navigate(back)}>放弃更改</button>
          </div>
        </PlanningDialog>
      ) : null}
    </>
  )
}
