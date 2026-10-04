import type { RefObject, ReactNode } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { TeamPlanHeaderIdentity } from './TeamPlanHeaderIdentity'

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
      <TeamPlanHeaderIdentity
        title={name}
        headingRef={heading}
        backButtonRef={backButton}
        teamRatingLabel={teamRatingLabel}
        onBack={() => navigate(back)}
      />
      <div className="optimizer-plan__team-actions">
        <span className="optimizer-plan__stale-state">已保存配装</span>
        {deleteAction}
      </div>
    </header>
  )
}
