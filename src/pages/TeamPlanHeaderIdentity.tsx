import type { RefObject } from 'react'
import { ArrowLeft } from 'lucide-react'
import { TeamRatingLine } from './TeamRatingLine'

export function TeamPlanHeaderIdentity({
  title,
  headingRef,
  backButtonRef,
  teamRatingLabel,
  onBack,
}: {
  title: string
  headingRef: RefObject<HTMLHeadingElement | null>
  backButtonRef: RefObject<HTMLButtonElement | null>
  teamRatingLabel?: string
  onBack: () => void
}) {
  return (
    <div className="optimizer-plan__team-identity">
      <button
        ref={backButtonRef}
        className="button button--secondary optimizer-plan__back-link"
        type="button"
        onClick={onBack}
      >
        <ArrowLeft size={16} aria-hidden="true" /> 返回选择队伍
      </button>
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <TeamRatingLine label={teamRatingLabel} />
    </div>
  )
}
