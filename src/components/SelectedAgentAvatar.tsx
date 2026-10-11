import { useEffect, useState } from 'react'
import { getVisualAsset } from '../assets/visualAssets'
import {
  preloadVisualEntityImage,
  resolveSessionVisualSource,
  sessionVisualSources,
  visualSourceKey,
} from '../assets/visualEntityImageSource'
import type { VisualAssetConsumer } from '../assets/visualAssetSlots'
import { VisualEntityImage } from './VisualEntityImage'

type SummaryConsumer = Extract<VisualAssetConsumer, 'assets.editor' | 'agent-development.overview'>

/** Reuse personal caches only. A missing new avatar keeps the existing portrait visible. */
export async function preloadSelectedAgentAvatar(agentId: string, consumer: SummaryConsumer) {
  const preferred = getVisualAsset('agent', agentId, 'interknot')
  const source = preferred ? await resolveSessionVisualSource(preferred) : null
  return (
    source ??
    preloadVisualEntityImage({
      entityType: 'agent',
      entityId: agentId,
      slotId: 'agent.square-avatar',
      consumer,
    })
  )
}

export function SelectedAgentAvatar({
  agentId,
  name,
  consumer,
  className,
}: {
  agentId: string
  name: string
  consumer: SummaryConsumer
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
