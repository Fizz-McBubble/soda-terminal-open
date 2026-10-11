import { VisualEntityImage } from '../../components/VisualEntityImage'
import { SelectedAgentAvatar } from '../../components/SelectedAgentAvatar'
import type { VisualAssetConsumer, VisualAssetSlotId } from '../../assets/visualAssetSlots'

export type AgentVisualSlot = 'compact-agent' | 'recommendation-identity' | 'hero-agent'

const slotSpec: Record<
  AgentVisualSlot,
  { slotId: VisualAssetSlotId; consumer: VisualAssetConsumer }
> = {
  'compact-agent': {
    slotId: 'agent.factual-card',
    consumer: 'agent-development.overview',
  },
  'recommendation-identity': {
    slotId: 'agent.selected-summary',
    consumer: 'agent-development.overview',
  },
  'hero-agent': { slotId: 'agent.hero', consumer: 'agent-development.workbench' },
}

export function AgentVisualSlot({
  slot,
  agentId,
  name,
  className,
}: {
  slot: AgentVisualSlot
  agentId: string
  name: string
  className?: string
}) {
  const spec = slotSpec[slot]
  if (slot === 'recommendation-identity') {
    return (
      <SelectedAgentAvatar
        agentId={agentId}
        name={name}
        className={className}
        consumer="agent-development.overview"
      />
    )
  }
  return (
    <VisualEntityImage
      className={className}
      entityType="agent"
      entityId={agentId}
      name={name}
      slotId={spec.slotId}
      consumer={spec.consumer}
      compactFallback={slot === 'compact-agent'}
    />
  )
}
