import {
  publicAssetCatalog,
  publicPotentialMissingObservationPolicy,
} from '../application/publicAssetCatalog'
import { agentCatalog, bangbooCatalog } from '../application/publicRosterNames'
import {
  currentReleasedIdentityMap,
  resolveCurrentReleasedIdentity,
} from '../gameDataPacks/currentReleasedIdentityMap'

/**
 * Default identity order for a new roster: the released formal catalog first, then the released
 * identity additions, de-duplicated by stable identity. This reproduces the accepted desktop
 * order from public sources only (asserted in rosterHydration.parity.test.ts).
 */
export const defaultRosterAgentIds = [
  ...new Set(
    [
      ...agentCatalog.filter((entry) => entry[7] === 'released').map(([agentId]) => agentId),
      ...currentReleasedIdentityMap.entries
        .filter((entry) => entry.releaseState === 'released' && entry.stableId.startsWith('agent-'))
        .map((entry) => entry.stableId),
    ].map(resolveCurrentReleasedIdentity),
  ),
]

/** Released account-ownable Bangboo order: the formal catalog, then the reviewed projection. */
export const defaultRosterBangbooIds = [
  ...bangbooCatalog.filter((entry) => entry[4] === 'released').map(([bangbooId]) => bangbooId),
  ...publicAssetCatalog.bangboos
    .map((entry) => entry.stableId)
    .filter((stableId) => !bangbooCatalog.some(([bangbooId]) => bangbooId === stableId)),
]

const agentFactsById = new Map(publicAssetCatalog.agents.map((entry) => [entry.stableId, entry]))
const bangbooFactsById = new Map(
  publicAssetCatalog.bangboos.map((entry) => [entry.stableId, entry]),
)

export type RosterRarity = 'S' | 'A' | 'B' | null

/** Only the three account-relevant rarity labels carry defaults; anything else stays unknown. */
function asRosterRarity(value: string | null | undefined): RosterRarity {
  return value === 'S' || value === 'A' || value === 'B' ? value : null
}

export function rosterAgentRarity(agentId: string): RosterRarity {
  return asRosterRarity(agentFactsById.get(agentId)?.rarity)
}

export function rosterBangbooRarity(bangbooId: string): RosterRarity {
  return asRosterRarity(bangbooFactsById.get(bangbooId)?.rarity)
}

/**
 * Potential-image eligibility is an identity-level capability from the reviewed projection. It is
 * deliberately separate from progression values and never changes mindscape or skill defaults.
 */
export function supportsRosterPotentialImage(agentId: string) {
  return agentFactsById.get(agentId)?.supportsPotentialImage === true
}

/** Source eligibility does not authorize manufacturing a missing potential observation. */
export function resolveRosterPotentialImage(agentId: string, value: number | null | undefined) {
  if (value !== null && value !== undefined) return value
  if (publicPotentialMissingObservationPolicy[agentId] === 'preserve_unknown') return undefined
  return supportsRosterPotentialImage(agentId) ? 6 : undefined
}
