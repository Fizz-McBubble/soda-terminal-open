import { getAgentName } from '../application/publicRosterNames'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { orderTeamMembersForDisplay } from '../application/teamMemberDisplayOrder'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import { resolveMemberMindscapeDisplay } from './teamMemberMindscapePresentation'
import { TeamLoadoutMindscapeBadge } from './TeamLoadoutMindscapeBadge'

export function TeamLoadoutEntityPortraits({
  item,
  orderedAgentIds,
  large = false,
  showMindscapeBadges = true,
}: {
  item: Pick<
    TeamLoadoutOverviewItem,
    | 'agentIds'
    | 'deploymentOrder'
    | 'formedTeamReference'
    | 'currentMemberCultivation'
    | 'bangbooId'
    | 'bangbooLabel'
  >
  orderedAgentIds?: readonly string[]
  large?: boolean
  showMindscapeBadges?: boolean
}) {
  const agents =
    orderedAgentIds ??
    orderTeamMembersForDisplay(item.agentIds, (id) => id, item.deploymentOrder).slice(0, 3)

  return (
    <span className={`f5v-box-team-portraits${large ? ' is-large' : ''}`}>
      {agents.map((agentId) => {
        const mindscape = showMindscapeBadges
          ? resolveMemberMindscapeDisplay(
              agentId,
              item.formedTeamReference,
              item.currentMemberCultivation?.[agentId],
            )
          : null

        return (
          <span className="f5v-box-team-portrait-slot" key={agentId}>
            <span className="f5v-box-team-portrait-frame">
              <VisualEntityImage
                className="f5v-box-team-portrait"
                entityType="agent"
                entityId={agentId}
                name={getAgentName(agentId)}
                slotId="agent.square-avatar"
                consumer="box.team-overview"
              />
            </span>
            {mindscape ? <TeamLoadoutMindscapeBadge display={mindscape} /> : null}
          </span>
        )
      })}
      {item.bangbooId ? (
        <span className="f5v-box-team-portrait-slot is-bangboo">
          <VisualEntityImage
            className="f5v-box-team-portrait is-bangboo"
            entityType="bangboo"
            entityId={item.bangbooId}
            name={item.bangbooLabel}
            slotId="bangboo.team-icon"
            consumer="box.team-overview"
          />
        </span>
      ) : null}
    </span>
  )
}
