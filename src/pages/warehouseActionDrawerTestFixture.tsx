import type { WarehouseActionItem } from '../application/warehouseActionProjection'
import { sampleDiscs } from '../evaluation/fixtures'
import { WarehouseActionDrawer } from './WarehouseActionDrawer'

export const disc = { ...sampleDiscs.treasureCandidate, id: 'drawer-disc' }
export function action(overrides: Partial<WarehouseActionItem> = {}): WarehouseActionItem {
  return {
    disc,
    action: 'keep',
    recommendationState: 'current',
    reasons: [],
    statuses: [],
    compatibleAgentIds: [],
    usageAgentIds: [],
    affectedAgentIds: [],
    affectedPlans: [],
    affectedTeams: [],
    alternativeDiscIds: [],
    ...overrides,
  }
}

export function drawer(item: WarehouseActionItem) {
  return (
    <WarehouseActionDrawer
      ownedAgentIds={new Set()}
      item={item}
      disc={disc}
      discs={[disc]}
      decisionLabel="建议保留"
      relations={[]}
    />
  )
}
