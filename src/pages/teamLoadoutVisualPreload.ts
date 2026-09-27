import type { VisualEntityImageRequest } from '../assets/visualEntityImageSource'
import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'

const visualPreload =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : await import('../assets/visualEntityImageSource')

function itemVisualRequests(item: TeamLoadoutOverviewItem): VisualEntityImageRequest[] {
  return [
    ...item.agentIds.slice(0, 3).map((agentId) => ({
      entityType: 'agent' as const,
      entityId: agentId,
      slotId: 'agent.square-avatar' as const,
      consumer: 'box.team-overview' as const,
    })),
    ...(item.bangbooId
      ? [
          {
            entityType: 'bangboo' as const,
            entityId: item.bangbooId,
            slotId: 'bangboo.team-icon' as const,
            consumer: 'box.team-overview' as const,
          },
        ]
      : []),
  ]
}

export function preloadTeamLoadoutFamilyVisuals(family: TeamLoadoutOverviewFamily) {
  if (visualPreload)
    void visualPreload.preloadVisualEntityImages(
      family.variants.slice(0, 4).flatMap(itemVisualRequests),
    )
}
