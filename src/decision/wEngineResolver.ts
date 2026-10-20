import { hasCurrentWEngineProgression } from '../accounts/observedAgentFacts'
import { currentWEngineDirectory, getAgentSpecialty } from '../assault/planningCatalog'
import type { AccountRoster, RosterAgent } from '../assault/types'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { resolveBuildIntentWEngineIds } from '../gameDataPacks/buildIntentWEngineIdentity'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'

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

export type LegalWEngineCandidate = {
  copyIdentity?: string
  engineId: string
  name: string
  rarity: string | null
  specialty: string
  level: number | null
  ascension?: number | null
  refinement: number | null
  source:
    | 'agent_current_fact'
    | 'account_owned'
    | 'legacy_copy_compat'
    | 'recommendation'
    | 'theoretical_benchmark'
  owned: boolean
  isRecommended: boolean
  recommendationRole: 'primary' | 'alternative' | 'legal_candidate'
  passiveCompatibility: 'matched' | 'mismatched' | 'static_only'
}

export type WEngineMatchStatus =
  | 'current_unrecorded'
  | 'recommended_unavailable'
  | 'matches_primary'
  | 'matches_alternative'
  | 'upgrade_available'

export type WEngineResolution = {
  contract: typeof wEngineResolverContract
  current: ResolvedWEngine | null
  recommendedPrimary: ResolvedWEngine | null
  recommendedAlternatives: ResolvedWEngine[]
  matchStatus: WEngineMatchStatus
  legalCandidates?: readonly LegalWEngineCandidate[]
}

const directoryById = new Map(currentWEngineDirectory.map((engine) => [engine.id, engine]))

export { hasCurrentWEngineProgression } from '../accounts/observedAgentFacts'

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
  if (!hasCurrentWEngineProgression(agent)) return null
  if (
    details.id &&
    details.level !== null &&
    details.refinement !== null &&
    Number.isInteger(details.level) &&
    details.level >= 0 &&
    details.level <= 60 &&
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
  if (!copy || (details.id && details.id !== copy.engineId)) return null
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

export function normalizeSpecialty(specialty: string | null | undefined): string | null {
  if (!specialty) return null
  if (specialty === 'attack') return 'damage'
  return specialty
}

export function resolveAllLegalWEngines(input: {
  agentId: string
  agent?: RosterAgent
  legacyWEngines?: AccountRoster['wEngines']
  roster?: AccountRoster
  recommendedWEngineIds?: readonly string[]
  includeMismatchedSpecialty?: boolean
}): readonly LegalWEngineCandidate[] {
  const agentSpecialty = normalizeSpecialty(getAgentSpecialty(input.agentId))
  const recommendationIds = input.recommendedWEngineIds ?? defaultRecommendationIds(input.agentId)
  const primaryId = recommendationIds[0] ?? null
  const alternativeIds = new Set(recommendationIds.slice(1, 4))

  const ownedByEngineId = new Map<
    string,
    Array<{
      copyIdentity: string
      level: number | null
      refinement: number | null
      ascension?: number | null
      source: LegalWEngineCandidate['source']
    }>
  >()

  if (input.agent?.wEngineDetails?.id) {
    const known = hasCurrentWEngineProgression(input.agent)
    ownedByEngineId.set(input.agent.wEngineDetails.id, [
      {
        copyIdentity: input.agent.wEngineCopyId ?? `agent:${input.agent.agentId}`,
        level: known ? input.agent.wEngineDetails.level : null,
        refinement: known ? input.agent.wEngineDetails.refinement : null,
        ...(input.agent.wEngineDetails.ascension != null
          ? { ascension: input.agent.wEngineDetails.ascension }
          : {}),
        source: 'agent_current_fact',
      },
    ])
  }

  if (input.legacyWEngines) {
    for (const item of input.legacyWEngines) {
      const copies = ownedByEngineId.get(item.engineId) ?? []
      if (!copies.some((copy) => copy.copyIdentity === item.copyId)) {
        ownedByEngineId.set(item.engineId, [
          ...copies,
          {
            copyIdentity: item.copyId,
            level: item.level,
            refinement: item.refinement,
            source:
              input.agent?.wEngineCopyId === item.copyId ? 'legacy_copy_compat' : 'account_owned',
          },
        ])
      }
    }
  }

  if (input.roster?.agents) {
    for (const other of input.roster.agents) {
      if (other.agentId === input.agentId) continue
      const id = other.wEngineDetails?.id
      if (other.owned && id) {
        const copies = ownedByEngineId.get(id) ?? []
        const copyIdentity = other.wEngineCopyId ?? `agent:${other.agentId}`
        if (copies.some((copy) => copy.copyIdentity === copyIdentity)) continue
        const known = hasCurrentWEngineProgression(other)
        ownedByEngineId.set(id, [
          ...copies,
          {
            copyIdentity,
            level: known ? other.wEngineDetails.level : null,
            refinement: known ? other.wEngineDetails.refinement : null,
            ...(other.wEngineDetails.ascension != null
              ? { ascension: other.wEngineDetails.ascension }
              : {}),
            source: 'account_owned',
          },
        ])
      }
    }
  }

  const releasedEngines = currentWEngineDirectory.filter(
    (engine) => engine.releaseState === 'released' && engine.accountOwnable,
  )

  const candidates: LegalWEngineCandidate[] = []

  for (const engine of releasedEngines) {
    const engineSpecialty = normalizeSpecialty(engine.specialty)
    const specialtyMatches = agentSpecialty !== null && engineSpecialty === agentSpecialty
    if (!specialtyMatches && input.includeMismatchedSpecialty === false) {
      continue
    }

    const staticData = getCurrentWEngineStaticData(engine.id)
    const passiveCompatibility: LegalWEngineCandidate['passiveCompatibility'] = !specialtyMatches
      ? 'mismatched'
      : staticData?.formulaAdoption?.status === 'static_only'
        ? 'static_only'
        : 'matched'

    for (const owned of ownedByEngineId.get(engine.id) ?? [undefined]) {
      const isRecommended = specialtyMatches && recommendationIds.includes(engine.id)
      const recommendationRole: LegalWEngineCandidate['recommendationRole'] = !specialtyMatches
        ? 'legal_candidate'
        : engine.id === primaryId
          ? 'primary'
          : alternativeIds.has(engine.id)
            ? 'alternative'
            : 'legal_candidate'

      const level = owned ? owned.level : 60
      const refinement = owned ? owned.refinement : defaultWEngineRefinement(engine.rarity)
      const source: LegalWEngineCandidate['source'] = owned
        ? owned.source
        : isRecommended
          ? 'recommendation'
          : 'theoretical_benchmark'

      candidates.push({
        engineId: engine.id,
        ...(owned ? { copyIdentity: owned.copyIdentity } : {}),
        name: engine.name,
        rarity: engine.rarity ?? null,
        specialty: engine.specialty,
        level,
        ...(owned?.ascension != null ? { ascension: owned.ascension } : {}),
        refinement,
        source,
        owned: Boolean(owned),
        isRecommended,
        recommendationRole,
        passiveCompatibility,
      })
    }
  }

  const roleRank = (role: LegalWEngineCandidate['recommendationRole']) =>
    role === 'primary' ? 0 : role === 'alternative' ? 1 : 2
  const passiveRank = (compat: LegalWEngineCandidate['passiveCompatibility']) =>
    compat === 'matched' ? 0 : compat === 'static_only' ? 1 : 2
  const rarityRank = (rarity: string | null) => (rarity === 'S' ? 0 : rarity === 'A' ? 1 : 2)

  return candidates.sort((a, b) => {
    return (
      passiveRank(a.passiveCompatibility) - passiveRank(b.passiveCompatibility) ||
      roleRank(a.recommendationRole) - roleRank(b.recommendationRole) ||
      (a.owned === b.owned ? 0 : a.owned ? -1 : 1) ||
      rarityRank(a.rarity) - rarityRank(b.rarity) ||
      a.name.localeCompare(b.name, 'zh-CN')
    )
  })
}

/**
 * The only production read contract for Current W-Engine and recommended plans.
 * Current facts prefer agent maintenance data; legacy inventory is read-only fallback.
 */
export function resolveWEngine(input: {
  agent: RosterAgent | undefined
  legacyWEngines?: AccountRoster['wEngines']
  recommendedWEngineIds?: readonly string[]
  roster?: AccountRoster
}): WEngineResolution {
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

  const legalCandidates = input.agent
    ? resolveAllLegalWEngines({
        agentId: input.agent.agentId,
        agent: input.agent,
        legacyWEngines: input.legacyWEngines,
        roster: input.roster,
        recommendedWEngineIds: input.recommendedWEngineIds,
      })
    : []

  return {
    contract: wEngineResolverContract,
    current,
    recommendedPrimary,
    recommendedAlternatives,
    matchStatus,
    legalCandidates,
  }
}
