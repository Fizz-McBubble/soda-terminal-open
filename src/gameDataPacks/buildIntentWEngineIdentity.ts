import { currentWEngineDirectory } from '../assault/planningCatalog'
import { adoptedBuildIntentWEngineIds } from '../application/publicBuildIntentWEngineAliases'
export { adoptedBuildIntentWEngineIds } from '../application/publicBuildIntentWEngineAliases'

const stableWEngineIds = new Set(currentWEngineDirectory.map((engine) => engine.id))

/** Adopted agent relation used only when the projected Build Intent has no resolvable option. */
const adoptedAgentBuildIntentWEngineIds: Readonly<Record<string, readonly string[]>> = {
  // gameData31RemielleEquipmentIntake: project stable ID + current account-ownable catalog entry.
  'agent-remielle': ['wengine-14158'],
}

export function resolveBuildIntentWEngineIds(agentId: string, values: readonly string[]) {
  const resolved = values
    .map((value) => (stableWEngineIds.has(value) ? value : adoptedBuildIntentWEngineIds[value]))
    .filter((engineId): engineId is string => Boolean(engineId && stableWEngineIds.has(engineId)))
  const fallback = adoptedAgentBuildIntentWEngineIds[agentId] ?? []
  return [
    ...new Set(resolved.length ? resolved : fallback.filter((id) => stableWEngineIds.has(id))),
  ]
}
