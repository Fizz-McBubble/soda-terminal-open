import type { RefObject } from 'react'
import type { TeamExecutionPresentation } from './teamExecutionPresentation'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'
import { TeamPlanHeaderIdentity } from './TeamPlanHeaderIdentity'

type TeamPlanHeaderProps = {
  deleteAction?: import('react').ReactNode
  team: DecisionTeamViewModel
  executionPresentation: TeamExecutionPresentation | null
  headingRef: RefObject<HTMLHeadingElement | null>
  backButtonRef: RefObject<HTMLButtonElement | null>
  readOnly: boolean
  savedPlanState?: 'saved' | 'stale' | 'refreshing'
  usingRemainingBox?: boolean
  teamRatingLabel?: string
  onBack: () => void
  onReanalyze: () => void
  onSave: () => void
}

/**
 * The routed team workspace owns this header so the accepted Golden surface
 * stays independent of the legacy agent-plan editor below it.
 */
export function TeamPlanHeader({
  deleteAction,
  team,
  executionPresentation,
  headingRef,
  backButtonRef,
  readOnly,
  savedPlanState,
  usingRemainingBox = false,
  teamRatingLabel,
  onBack,
  onReanalyze,
  onSave,
}: TeamPlanHeaderProps) {
  return (
    <header className="optimizer-plan__team-heading">
      <TeamPlanHeaderIdentity
        title={team.title}
        headingRef={headingRef}
        backButtonRef={backButtonRef}
        teamRatingLabel={teamRatingLabel}
        onBack={onBack}
      />
      <div className="optimizer-plan__team-actions">
        {usingRemainingBox ? <span className="f5v-remaining-box-badge">另一支队伍</span> : null}
        {savedPlanState && savedPlanState !== 'stale' ? (
          <span className="optimizer-plan__stale-state">
            {savedPlanState === 'saved' ? '已保存配装' : '正在更新配装'}
          </span>
        ) : null}
        {executionPresentation && !savedPlanState && executionPresentation.status !== 'adjust' ? (
          <span className={`optimizer-plan__execution-state is-${executionPresentation.status}`}>
            {executionPresentation.statusLabel}
          </span>
        ) : null}
        <button className="button button--secondary" type="button" onClick={onReanalyze}>
          重新搭配
        </button>
        <button
          className="primary-action"
          type="button"
          aria-label="保存当前队伍方案"
          disabled={readOnly}
          onClick={onSave}
        >
          保存当前方案
        </button>
        {deleteAction}
      </div>
    </header>
  )
}
