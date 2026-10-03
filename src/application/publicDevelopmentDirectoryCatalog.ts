import { agentCatalog } from './publicRosterNames'
import { publicAssetCatalog } from './publicAssetCatalog'

const legacy = new Map<string, { name: string; specialty: string; attribute: string }>(
  agentCatalog.map(([id, name, specialty, , , attribute]) => [id, { name, specialty, attribute }]),
)

/** The generated display-only projection owns canonical release order; no private source imports. */
export const publicDevelopmentDirectoryCatalog = publicAssetCatalog.agents.map((entry) => ({
  stableId: entry.stableId,
  playerName: legacy.get(entry.stableId)?.name ?? entry.playerName,
  specialty: legacy.get(entry.stableId)?.specialty ?? entry.specialty ?? undefined,
  rarity: entry.rarity,
  attribute: legacy.get(entry.stableId)?.attribute ?? entry.attribute ?? undefined,
  releaseState: 'released' as const,
  accountOwnable: true,
}))
