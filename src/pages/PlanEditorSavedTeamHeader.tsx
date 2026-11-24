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
  standardReferenceControl,
  onReviewSavedRating,
}: {
  backButton: RefObject<HTMLButtonElement | null>
  heading: RefObject<HTMLHeadingElement | null>
  navigate: NavigateFunction
  back: string
  name: string
  teamRatingLabel: string | undefined
  deleteAction: ReactNode
  onReviewSavedRating?: () => void
  standardReferenceControl?: ReactNode
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
        {standardReferenceControl}
        {onReviewSavedRating ? (
          <button type="button" className="button button--secondary" onClick={onReviewSavedRating}>
            读取当前评分
          </button>
        ) : (
          <span className="optimizer-plan__stale-state">已保存配装</span>
        )}
        {deleteAction}
      </div>
    </header>
  )
}
