import type { AccountRoster, RosterAgent } from '../assault/types'

export type WEngineCopy = NonNullable<AccountRoster['wEngines']>[number]

/** S-rank copies default to P1 unless the player set the refinement explicitly. */
export function usesDefaultWEngineRefinement(
  sRankWEngineIds: ReadonlySet<string>,
  copy: WEngineCopy,
) {
  return sRankWEngineIds.has(copy.engineId) && copy.refinementManuallySet !== true
}

export function withDefaultWEngineRefinement(
  sRankWEngineIds: ReadonlySet<string>,
  copy: WEngineCopy,
): WEngineCopy {
  return usesDefaultWEngineRefinement(sRankWEngineIds, copy) ? { ...copy, refinement: 1 } : copy
}

function slug(value: string) {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  )
}

export function makeWEngineCopyId(engineId: string, ordinal: number) {
  return `wengine-copy-${slug(engineId)}-${String(ordinal).padStart(3, '0')}`
}

function projectDetails(copy: WEngineCopy | undefined, previous: RosterAgent['wEngineDetails']) {
  if (previous.id) return previous
  if (!copy) return { id: null, name: null, level: null, refinement: null }
  return { id: copy.engineId, name: previous.name, level: copy.level, refinement: copy.refinement }
}

/** Upgrades legacy rows and rejects ambiguous/conflicting equipment authority. */
export function normalizeWEngineInstances(
  roster: Omit<AccountRoster, 'schemaVersion'> & { schemaVersion?: number },
): AccountRoster {
  const ordinalByEngine = new Map<string, number>()
  const usedCopyIds = new Set<string>()
  const copies: WEngineCopy[] = (roster.wEngines ?? []).map((item) => {
    const ordinal = (ordinalByEngine.get(item.engineId) ?? 0) + 1
    ordinalByEngine.set(item.engineId, ordinal)
    const proposed = 'copyId' in item && typeof item.copyId === 'string' ? item.copyId : ''
    const copyId =
      proposed && !usedCopyIds.has(proposed) ? proposed : makeWEngineCopyId(item.engineId, ordinal)
    usedCopyIds.add(copyId)
    return {
      copyId,
      engineId: item.engineId,
      level: item.level,
      refinement: item.refinement,
      equippedAgentId:
        'equippedAgentId' in item && typeof item.equippedAgentId === 'string'
          ? item.equippedAgentId
          : null,
      manualSource: item.manualSource,
      refinementManuallySet: item.refinementManuallySet === true,
    }
  })

  const requested = new Map<string, string[]>()
  for (const agent of roster.agents) {
    const explicit =
      'wEngineCopyId' in agent && typeof agent.wEngineCopyId === 'string'
        ? agent.wEngineCopyId
        : null
    if (explicit) requested.set(explicit, [...(requested.get(explicit) ?? []), agent.agentId])
  }
  for (const copy of copies) {
    if (copy.equippedAgentId)
      requested.set(copy.copyId, [...(requested.get(copy.copyId) ?? []), copy.equippedAgentId])
  }

  const validAgents = new Set(roster.agents.map((agent) => agent.agentId))
  const ownerByCopy = new Map<string, string>()
  const copyIds = new Set(copies.map((copy) => copy.copyId))
  const validRequests = new Map<string, string[]>()
  const copiesByAgent = new Map<string, Set<string>>()
  for (const [copyId, agentIds] of requested) {
    const unique = [...new Set(agentIds)].filter((agentId) => validAgents.has(agentId))
    if (!copyIds.has(copyId)) continue
    validRequests.set(copyId, unique)
    for (const agentId of unique) {
      const claimedCopies = copiesByAgent.get(agentId) ?? new Set<string>()
      claimedCopies.add(copyId)
      copiesByAgent.set(agentId, claimedCopies)
    }
  }
  for (const [copyId, agentIds] of validRequests) {
    if (agentIds.length !== 1) continue
    const [agentId] = agentIds
    if (copiesByAgent.get(agentId)?.size === 1) ownerByCopy.set(copyId, agentId)
  }
  const normalizedCopies = copies.map((copy) => ({
    ...copy,
    equippedAgentId: ownerByCopy.get(copy.copyId) ?? null,
  }))
  const copyByAgent = new Map(
    normalizedCopies
      .filter((copy) => copy.equippedAgentId)
      .map((copy) => [copy.equippedAgentId!, copy]),
  )
  const agents = roster.agents.map((agent) => {
    const copy = copyByAgent.get(agent.agentId)
    return {
      ...agent,
      wEngineCopyId: copy?.copyId ?? null,
      wEngineDetails: projectDetails(copy, agent.wEngineDetails),
    }
  })
  return {
    ...roster,
    schemaVersion: 3,
    agents,
    bangboos: roster.bangboos.map((bangboo) => ({
      ...bangboo,
      // v2 had no skill facts. Missing fields are deliberately migrated to
      // null; neither stars nor level authorizes an inferred skill value.
      skillLevel:
        typeof bangboo.skillLevel === 'number' &&
        Number.isInteger(bangboo.skillLevel) &&
        bangboo.skillLevel >= 1 &&
        bangboo.skillLevel <= 10
          ? bangboo.skillLevel
          : null,
      additionalAbilityLevel:
        typeof bangboo.additionalAbilityLevel === 'number' &&
        Number.isInteger(bangboo.additionalAbilityLevel) &&
        bangboo.additionalAbilityLevel >= 1 &&
        bangboo.additionalAbilityLevel <= 5
          ? bangboo.additionalAbilityLevel
          : null,
    })),
    wEngines: normalizedCopies,
  }
}
