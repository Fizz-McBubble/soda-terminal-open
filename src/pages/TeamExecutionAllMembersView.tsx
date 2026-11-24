import type { RefObject } from 'react'
import type {
  TeamExecutionDiscPresentation,
  TeamExecutionPresentation,
} from './teamExecutionPresentation'
import {
  MissingTeamDiscsNotice,
  TeamExecutionDiscCard,
  TeamMemberVisual,
  WEngineVisual,
} from './teamExecutionWorkspaceParts'

export type TeamExecutionAllMembersViewProps = {
  view: TeamExecutionPresentation
  headingId: string
  descriptionId: string
  loadoutHeadingRef: RefObject<HTMLHeadingElement | null>
  hasCompleteTeamLoadout: boolean
  loadoutProgressLabel: string
  expectedDiscCount: number
  selectedDiscId: string | null
  isDiscHighlighted: (disc: TeamExecutionDiscPresentation, memberId: string) => boolean
  onSelectDisc: (disc: TeamExecutionDiscPresentation, memberId: string) => void
  onDeselect: () => void
  onSelectMemberView: (memberId?: string) => void
  onSelectTeamView: () => void
}

export function TeamExecutionAllMembersView({
  view,
  headingId,
  descriptionId,
  loadoutHeadingRef,
  hasCompleteTeamLoadout,
  loadoutProgressLabel,
  expectedDiscCount,
  selectedDiscId,
  isDiscHighlighted,
  onSelectDisc,
  onDeselect,
  onSelectMemberView,
  onSelectTeamView,
}: TeamExecutionAllMembersViewProps) {
  return (
    <div className="team-execution__all-members" aria-label="全队驱动盘配装">
      <header className="team-execution__loadout-heading">
        <div>
          <h2 ref={loadoutHeadingRef} id={headingId} tabIndex={-1}>
            全队配装
          </h2>
          {hasCompleteTeamLoadout ? null : <p id={descriptionId}>{loadoutProgressLabel}</p>}
        </div>
        <div className="team-execution__view-toggle" role="group" aria-label="完整配装视图">
          <button type="button" aria-pressed={false} onClick={() => onSelectMemberView()}>
            当前角色
          </button>
          <button type="button" aria-pressed onClick={onSelectTeamView}>
            全队驱动盘<span aria-hidden="true"> · {expectedDiscCount}槽</span>
          </button>
        </div>
      </header>
      {view.members.map((member) => (
        <article key={member.agentId}>
          <header>
            <div className="team-execution__all-member-identity">
              <TeamMemberVisual
                agentId={member.agentId}
                name={member.agentName}
                className="team-execution__all-member-avatar"
              />
              <h4>{member.agentName}</h4>
            </div>
            <div className="team-execution__all-member-engine">
              <WEngineVisual
                className="team-execution__all-member-engine-visual"
                engineId={member.suggestedWEngineId}
                name={member.suggestedWEngineLabel}
              />
              <span>{member.suggestedWEngineLabel}</span>
            </div>
            <button
              className="team-execution__member-detail-action"
              type="button"
              onClick={() => onSelectMemberView(member.agentId)}
            >
              查看角色配装
            </button>
          </header>
          {member.discFacts.length > 0 ? (
            <ol aria-label={`${member.agentName}的六张驱动盘`}>
              {member.discFacts.map((disc) => (
                <TeamExecutionDiscCard
                  condensed
                  disc={disc}
                  key={disc.id}
                  selected={selectedDiscId === disc.id}
                  highlighted={isDiscHighlighted(disc, member.agentId)}
                  onSelect={() => onSelectDisc(disc, member.agentId)}
                  onDeselect={onDeselect}
                />
              ))}
            </ol>
          ) : null}
          <MissingTeamDiscsNotice count={member.missingDiscIds.length} />
        </article>
      ))}
    </div>
  )
}
