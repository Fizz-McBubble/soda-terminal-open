import { VisualEntityImage } from '../components/VisualEntityImage'
import { readableAgentName } from './warehouseFactLabels'

/** Only physical-disc assignments enter this list; related team members do not. */
export function WarehouseUsedAgents({
  agentIds,
  maxVisible,
}: {
  agentIds: readonly string[]
  maxVisible?: number
}) {
  if (!agentIds.length) return null
  const users = [...new Set(agentIds)]
  const shown = maxVisible ? users.slice(0, maxVisible) : users
  return (
    <span className="warehouse-used-agents" role="list" aria-label="使用角色">
      {shown.map((agentId) => (
        <span key={agentId} role="listitem" title={readableAgentName(agentId)}>
          <VisualEntityImage
            className="warehouse-used-agent"
            entityType="agent"
            entityId={agentId}
            name={readableAgentName(agentId)}
            slotId="agent.square-avatar"
            consumer="warehouse.action-list"
          />
        </span>
      ))}
      {shown.length < users.length ? (
        <span role="listitem" title={users.slice(shown.length).map(readableAgentName).join('、')}>
          +{users.length - shown.length}
        </span>
      ) : null}
    </span>
  )
}
