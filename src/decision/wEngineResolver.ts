import { currentWEngineDirectory } from '../assault/planningCatalog'
import type { AccountRoster, RosterAgent } from '../assault/types'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { resolveBuildIntentWEngineIds } from '../gameDataPacks/buildIntentWEngineIdentity'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'

export const wEngineResolverContract = 'soda-w-engine-resolver/v1' as const

export type ResolvedWEngine = {
  engineId: string
  name: string
  rarity: string | null
  level: number
  ascension?: number
  refinement: number
  source: 'agent_current_fact' | 'legacy_copy_compat' | 'recommendation'
}

export type WEngineMatchStatus =
  | 'current_unrecorded'
  | 'recommended_unavailable'
  | 'matches_primary'
  | 'matches_alternative'
  | 'upgrade_available'

const directoryById = new Map(currentWEngineDirectory.map((engine) => [engine.id, engine]))

export function defaultWEngineRefinement(rarity: string | null | undefined) {
  return rarity === 'S' ? 1 : 5
}

function recommendation(engineId: string): ResolvedWEngine | null {
  const engine = directoryById.get(engineId)
  if (!engine || engine.releaseState !== 'released' || !engine.accountOwnable) return null
  return {
    engineId: engine.id,
    name: engine.name,
    rarity: engine.rarity ?? null,
    level: 60,
    refinement: defaultWEngineRefinement(engine.rarity),
    source: 'recommendation',
  }
}

function currentFact(
  agent: RosterAgent | undefined,
  legacyWEngines: AccountRoster['wEngines'],
): ResolvedWEngine | null {
  if (!agent) return null
  const details = agent.wEngineDetails
  if (
    details.id &&
    details.level !== null &&
    details.refinement !== null &&
    details.level > 0 &&
    details.refinement > 0
  ) {
    const engine = directoryById.get(details.id)
    return {
      engineId: details.id,
      name: details.name ?? engine?.name ?? details.id,
      rarity: engine?.rarity ?? null,
      level: details.level,
      ...(details.ascension == null ? {} : { ascension: details.ascension }),
      refinement: details.refinement,
      source: 'agent_current_fact',
    }
  }

  // Compatibility only: old accounts may not yet have wEngineDetails populated.
  const copy = legacyWEngines?.find((item) => item.copyId === agent.wEngineCopyId)
  if (!copy) return null
  const engine = directoryById.get(copy.engineId)
  return {
    engineId: copy.engineId,
    name: engine?.name ?? copy.engineId,
    rarity: engine?.rarity ?? null,
    level: copy.level,
    refinement: copy.refinement,
    source: 'legacy_copy_compat',
  }
}

function defaultRecommendationIds(agentId: string) {
  const profileDirections =
    getProjectedBuildKnowledgeProfile(agentId).recommendation?.wEngines ?? []
  const constraintDirections = getCandidateWarehouseConstraint(agentId)?.wEngineDirections ?? []
  const directions = [...profileDirections, ...constraintDirections]
  const adoptedIds = resolveBuildIntentWEngineIds(agentId, directions)
  const namedIds = directions.flatMap((direction) =>
    currentWEngineDirectory
      .filter((engine) => direction.includes(engine.name))
      .sort((left, right) => direction.indexOf(left.name) - direction.indexOf(right.name))
      .map((engine) => engine.id),
  )
  return [...new Set([...adoptedIds, ...namedIds])]
}

/**
 * The only production read contract for Current W-Engine and recommended plans.
 * Current facts prefer agent maintenance data; legacy inventory is read-only fallback.
 */
export function resolveWEngine(input: {
  agent: RosterAgent | undefined
  legacyWEngines?: AccountRoster['wEngines']
  recommendedWEngineIds?: readonly string[]
}) {
  const current = currentFact(input.agent, input.legacyWEngines)
  const recommendationIds =
    input.recommendedWEngineIds ??
    (input.agent ? defaultRecommendationIds(input.agent.agentId) : [])
  const recommendations = recommendationIds.flatMap((engineId) => {
    const resolved = recommendation(engineId)
    return resolved ? [resolved] : []
  })
  const recommendedPrimary = recommendations[0] ?? null
  const recommendedAlternatives = recommendations.slice(1, 4)
  let matchStatus: WEngineMatchStatus
  if (!current) matchStatus = 'current_unrecorded'
  else if (!recommendedPrimary) matchStatus = 'recommended_unavailable'
  else if (
    current.engineId === recommendedPrimary.engineId &&
    current.level >= recommendedPrimary.level &&
    current.refinement >= recommendedPrimary.refinement
  )
    matchStatus = 'matches_primary'
  else if (recommendedAlternatives.some((engine) => engine.engineId === current.engineId))
    matchStatus = 'matches_alternative'
  else matchStatus = 'upgrade_available'

  return {
    contract: wEngineResolverContract,
    current,
    recommendedPrimary,
    recommendedAlternatives,
    matchStatus,
  }
}
