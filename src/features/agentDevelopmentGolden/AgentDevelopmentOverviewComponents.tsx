import { VisualEntityImage } from '../../components/VisualEntityImage'
import { AgentVisualSlot } from './agentVisualSlot'
import { attributeIcons, specialtyIcons } from './agentDevelopmentOverviewHelpers'
import type { AgentSummary } from './types'

export function AgentIdentityIcons({ agent }: { agent: AgentSummary }) {
  const attribute = agent.attribute ? attributeIcons[agent.attribute] : undefined
  const specialty = agent.specialty ? specialtyIcons[agent.specialty] : undefined
  if (!attribute && !specialty) return null
  return (
    <span className="agent-identity-icons" aria-label="属性与特性">
      {attribute ? (
        <VisualEntityImage
          entityType="illustration"
          entityId={attribute.id}
          variant="icon"
          name={attribute.label}
        />
      ) : null}
      {specialty ? (
        <VisualEntityImage
          entityType="illustration"
          entityId={specialty.id}
          variant="icon"
          name={specialty.label}
        />
      ) : null}
    </span>
  )
}

export function AgentAvatar({
  agent,
  className = '',
  slot = 'compact-agent',
}: {
  agent: AgentSummary
  className?: string
  slot?: 'compact-agent' | 'recommendation-identity'
}) {
  return (
    <span
      className={`agent-avatar ${className}`.trim()}
      data-entity-id={agent.agentId}
      data-asset-kind={agent.visual.kind}
      data-fallback={agent.visual.fallback}
    >
      <span aria-hidden="true">{agent.name.slice(0, 1)}</span>
      <AgentVisualSlot slot={slot} agentId={agent.agentId} name={agent.name} />
      <AgentIdentityIcons agent={agent} />
    </span>
  )
}
