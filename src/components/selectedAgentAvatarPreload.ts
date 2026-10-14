import { getVisualAsset } from '../assets/visualAssets'
import {
  preloadVisualEntityImage,
  resolveSessionVisualSource,
} from '../assets/visualEntityImageSource'
import type { VisualAssetConsumer } from '../assets/visualAssetSlots'

export type SelectedAgentAvatarConsumer = Extract<
  VisualAssetConsumer,
  'assets.editor' | 'agent-development.overview'
>

/** Reuse personal caches only. A missing new avatar keeps the existing portrait visible. */
export async function preloadSelectedAgentAvatar(
  agentId: string,
  consumer: SelectedAgentAvatarConsumer,
) {
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
