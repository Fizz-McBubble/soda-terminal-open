import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { getReviewedAgentAttackTypes32 } from '../gameDataPacks/reviewedAgentAttackTypes32'
import { bangbooFactionCompositionKey } from '../decision/bangbooCompositionIdentity'

/**
 * Bangboo additional-ability predicates identify agents by the current stable
 * roster identity, without the `agent-` storage prefix.  Keep the one legacy
 * producer form (`agent:agent-…`) readable while emitting only this key.
 */
export function currentBangbooAgentCompositionKey(stableAgentId: string) {
  const sourceId = stableAgentId.startsWith('agent:')
    ? stableAgentId.slice('agent:'.length)
    : stableAgentId
  const normalizedId = sourceId
    .replace(/^agent[-_]/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
  return `agent:${normalizedId}`
}

/** One member counts once for each sourced attack type, including multi-type actors. */
export function projectCurrentBangbooComposition32(memberIds: readonly string[]) {
  if (new Set(memberIds).size !== memberIds.length) return null
  const composition: Record<string, number> = {
    'attack_type:slash': 0,
    'attack_type:strike': 0,
    'attack_type:pierce': 0,
  }
  for (const agentId of memberIds) {
    const identity = getCurrentAgentEventContract(agentId)?.identity
    const attackTypes = getReviewedAgentAttackTypes32(agentId)
    if (!identity || !attackTypes) return null
    for (const key of [
      currentBangbooAgentCompositionKey(agentId),
      `attribute:${identity.attribute}`,
      `specialty:${identity.specialty}`,
      bangbooFactionCompositionKey(identity.faction),
      ...attackTypes.map((type) => `attack_type:${type}`),
    ])
      composition[key] = (composition[key] ?? 0) + 1
  }
  return composition
}

/** Normalize only the former exhaustive-scoring agent-key spelling. */
export function normalizeCurrentBangbooComposition(
  composition: Readonly<Record<string, number>>,
): Record<string, number> {
  const normalized = { ...composition }
  for (const [key, value] of Object.entries(composition)) {
    if (!key.startsWith('agent:agent-')) continue
    const currentKey = currentBangbooAgentCompositionKey(key)
    normalized[currentKey] = Math.max(normalized[currentKey] ?? 0, value)
  }
  return normalized
}
