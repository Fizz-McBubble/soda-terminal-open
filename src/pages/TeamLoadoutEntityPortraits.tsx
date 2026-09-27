import { getAgentName } from '../application/publicRosterNames'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { orderTeamMembersForDisplay } from '../application/teamMemberDisplayOrder'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'

export function TeamLoadoutEntityPortraits({
  item,
  orderedAgentIds,
  large = false,
}: {
  item: TeamLoadoutOverviewItem
  orderedAgentIds?: readonly string[]
  large?: boolean
}) {
  const agents =
    orderedAgentIds ??
    orderTeamMembersForDisplay(item.agentIds, (id) => id, item.deploymentOrder).slice(0, 3)
  return (
    <span className={`f5v-box-team-portraits${large ? ' is-large' : ''}`} aria-hidden="true">
      {agents.map((agentId) => (
        <span className="f5v-box-team-portrait-frame" key={agentId}>
          <VisualEntityImage
            className="f5v-box-team-portrait"
            entityType="agent"
            entityId={agentId}
            name={getAgentName(agentId)}
            slotId="agent.square-avatar"
            consumer="box.team-overview"
          />
        </span>
      ))}
      {item.bangbooId ? (
        <VisualEntityImage
          className="f5v-box-team-portrait is-bangboo"
          entityType="bangboo"
          entityId={item.bangbooId}
          name={item.bangbooLabel}
          slotId="bangboo.team-icon"
          consumer="box.team-overview"
        />
      ) : null}
    </span>
  )
}
