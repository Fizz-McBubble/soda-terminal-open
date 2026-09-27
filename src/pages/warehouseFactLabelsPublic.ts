import { publicAssetDiscSetById } from '../application/publicAssetCatalog'
import { getPublicStatLabel } from '../application/publicCandidateLabels'
import { getAgentName } from '../application/publicRosterNames'
import { displayDriveDiscSet } from './publicDiscFacts'
import type { WarehouseFactLabelSources } from './warehouseFactLabelsShared'
import { createWarehouseFactLabels } from './warehouseFactLabelsShared'

/**
 * Public label sources: the published display catalog and published stat labels only. Parity with
 * the desktop sources for every manifest set and stat key is pinned by
 * `warehouseFactLabels.parity.test.ts`.
 */
export const warehouseFactLabelSources: WarehouseFactLabelSources = {
  setNames: new Map(
    [...publicAssetDiscSetById.values()].map((item) => [item.stableId, item.playerName]),
  ),
  readableSetName: (setId) => displayDriveDiscSet(setId),
  statLabel: (value) => getPublicStatLabel(value) ?? '资料待补齐',
  readableAgentName: (agentId) => {
    const name = getAgentName(agentId)
    return name === agentId ? '资料待补齐' : name
  },
}

const labels = createWarehouseFactLabels(warehouseFactLabelSources)

export const setNames = labels.setNames
export const readableSetName = labels.readableSetName
export const statLabel = labels.statLabel
export const readableAgentName = labels.readableAgentName
export const readablePhysicalDiscLabel = labels.readablePhysicalDiscLabel
export const readableWarehouseReason = labels.readableWarehouseReason
