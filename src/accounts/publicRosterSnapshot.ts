import { agentCatalog } from '../application/publicRosterNames'
import { publicAssetCatalog } from '../application/publicAssetCatalog'
import { normalizeWEngineInstances } from './publicWEngineInstances'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'

const agentIds = new Set<string>([
  ...agentCatalog.map(([id]) => id),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.releaseState === 'released')
    .map((entry) => entry.stableId),
])
const bangbooIds = new Set<string>(publicAssetCatalog.bangboos.map((entry) => entry.stableId))

import { createRosterSnapshotAdapter } from './rosterSnapshotCore'
export { rosterSnapshotSchema, type RosterSnapshot } from './rosterSnapshotCore'

export const { exportRosterSnapshot, preflightRosterSnapshot, applyRosterSnapshot } =
  createRosterSnapshotAdapter({ agentIds, bangbooIds, normalizeWEngineInstances })
