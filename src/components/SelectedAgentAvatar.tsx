import { useEffect, useState } from 'react'
import { getVisualAsset } from '../assets/visualAssets'
import {
  resolveSessionVisualSource,
  sessionVisualSources,
  visualSourceKey,
} from '../assets/visualEntityImageSource'
import { VisualEntityImage } from './VisualEntityImage'
import type { SelectedAgentAvatarConsumer } from './selectedAgentAvatarPreload'

export function SelectedAgentAvatar({
  agentId,
  name,
  consumer,
  className,
}: {
  agentId: string
  name: string
  consumer: SelectedAgentAvatarConsumer
  className?: string
}) {
  const preferred = getVisualAsset('agent', agentId, 'interknot')
  const key = preferred ? visualSourceKey(preferred) : ''
  const [resolved, setResolved] = useState<{ key: string; available: boolean } | null>(null)
  const available = sessionVisualSources.has(key) || (resolved?.key === key && resolved.available)
  useEffect(() => {
    let active = true
    const refresh = () => {
      if (!preferred) return
      void resolveSessionVisualSource(preferred).then((source) => {
        if (active) setResolved({ key, available: Boolean(source) })
      })
    }
    refresh()
    window.addEventListener('soda-visual-assets-ready', refresh)
    return () => {
      active = false
      window.removeEventListener('soda-visual-assets-ready', refresh)
    }
  }, [key, preferred])
  return (
    <VisualEntityImage
      entityType="agent"
      entityId={agentId}
      name={name}
      className={className}
      consumer={consumer}
      slotId={available ? 'agent.selected-summary' : 'agent.square-avatar'}
    />
  )
}
