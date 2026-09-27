type CatalogAgent = {
  stableId: string
  releaseState: 'released' | 'unreleased'
  accountOwnable: boolean
}

type RosterAgent = {
  agentId: string
  owned: boolean
}

/** Keeps catalog metadata authoritative while exposing records that cannot join it. */
export function projectAgentDevelopmentCatalogJoin(
  rosterAgents: readonly RosterAgent[],
  catalogAgents: readonly CatalogAgent[],
) {
  const eligibleCatalogIds = new Set(
    catalogAgents
      .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
      .map((entry) => entry.stableId),
  )
  const ownedAgentIds = rosterAgents.filter((agent) => agent.owned).map((agent) => agent.agentId)
  return {
    eligibleOwnedAgentIds: ownedAgentIds.filter((agentId) => eligibleCatalogIds.has(agentId)),
    unmappedOwnedAgentIds: ownedAgentIds.filter((agentId) => !eligibleCatalogIds.has(agentId)),
  }
}
