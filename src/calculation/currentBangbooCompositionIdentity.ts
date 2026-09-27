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
