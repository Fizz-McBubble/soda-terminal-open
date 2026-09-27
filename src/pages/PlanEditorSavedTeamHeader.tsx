import type { RefObject, ReactNode } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { TeamRatingLine } from './TeamRatingLine'

export function PlanEditorSavedTeamHeader({
  backButton,
  heading,
  navigate,
  back,
  name,
  teamRatingLabel,
  deleteAction,
}: {
  backButton: RefObject<HTMLButtonElement | null>
  heading: RefObject<HTMLHeadingElement | null>
  navigate: NavigateFunction
  back: string
  name: string
  teamRatingLabel: string | undefined
  deleteAction: ReactNode
}) {
  return (
    <header className="optimizer-plan__team-heading">
      <div>
        <button
          ref={backButton}
          className="link-button optimizer-plan__back-link"
          type="button"
          onClick={() => navigate(back)}
        >
          ← 返回选择队伍
        </button>
        <h1 ref={heading} tabIndex={-1}>
          {name}
        </h1>
        <p>已保存队伍方案 · 原成员、邦布与驱动盘</p>
        <TeamRatingLine label={teamRatingLabel} />
      </div>
      <div className="optimizer-plan__team-actions">{deleteAction}</div>
    </header>
  )
}
