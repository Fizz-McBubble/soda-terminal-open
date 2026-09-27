import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AgentDiscProfile } from '../assault/engine'
import { currentBangbooDirectory } from '../assault/catalog'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import { defaultEquipmentRankForRarity } from './teamEquipmentRecommendations'
import type {
  BangbooStarsById,
  TeamEngineBoxInput,
  TeamEngineCandidate,
  TeamEnginePack,
} from '../teamEngine/contracts'
import { bangbooStarForId } from '../teamEngine/contracts'
import { solveTeamEngine } from '../teamEngine/solveTeamEngine'
import type { AuthorityExecutionVariantResolver } from './accountDecisionAuthorityExecutionCandidates'
import { resolveDecisionProfiles } from './accountDecisionFingerprint'

function memberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

function isExecutableBangbooCandidate(candidate: TeamEngineCandidate, bangbooId: string) {
  return (
    candidate.bangbooId === bangbooId &&
    (candidate.bangbooSelection.status === 'selected' ||
      candidate.bangbooSelection.status === 'compatible_fallback')
  )
}

function defaultBangbooSchemeStars() {
  return Object.fromEntries(
    currentBangbooDirectory
      .filter((bangboo) => bangboo.releaseState === 'released')
      .map((bangboo) => [bangboo.id, defaultEquipmentRankForRarity(bangboo.rarity)] as const),
  )
}

/**
 * The sole account-to-Team-Engine input projection for live current-version
 * queries. Consumers must reuse it when replaying a source-backed Bangboo
 * identity, so readiness and cultivation facts cannot drift from the snapshot.
 */
export function createAccountTeamEngineBoxInput(input: {
  warehouse: CoreWarehouse
  profiles: AgentDiscProfile[] | undefined
  allocation: AccountBuildResult
  developmentPriorityAgentIds?: readonly string[]
  /** Explicit scheme/query parameter only; never inferred from account inventory. */
  bangbooStarsById?: BangbooStarsById
}): TeamEngineBoxInput {
  const { ownedAgentIds, profiles } = resolveDecisionProfiles(input.warehouse, input.profiles)
  return {
    ownedAgentIds,
    bangbooCandidateIds: currentBangbooDirectory
      .filter((bangboo) => bangboo.releaseState === 'released')
      .map((bangboo) => bangboo.id),
    bangbooStarsById: { ...defaultBangbooSchemeStars(), ...input.bangbooStarsById },
    preferredAgentIds: [...(input.developmentPriorityAgentIds ?? [])],
    agentStateById: Object.fromEntries(
      input.warehouse.roster.agents.map((agent) => [
        agent.agentId,
        { mindscape: agent.mindscape, potentialImage: agent.potentialImage },
      ]),
    ),
    cultivationByAgentId: Object.fromEntries(
      ownedAgentIds.map((agentId) => [
        agentId,
        input.allocation.global.some((loadout) => loadout.agentId === agentId)
          ? 'ready'
          : profiles.some((profile) => profile.agentId === agentId)
            ? 'developing'
            : 'unbuilt',
      ]),
    ),
    warehouseReadyAgentIds: input.allocation.global.map((loadout) => loadout.agentId),
  }
}

/**
 * Replays the existing Team Engine for one source-backed Bangboo identity.
 *
 * Authority can name a valid Bangboo variant that is not the Engine's default
 * selection.  That difference must be resolved by the same producer, rather
 * than attaching the Authority identity to an unrelated Engine candidate.
 */
export function createAuthorityExecutionVariantResolver(input: {
  pack: TeamEnginePack
  boxInput: TeamEngineBoxInput
  baseCandidates: readonly TeamEngineCandidate[]
}): AuthorityExecutionVariantResolver {
  const knownFormationKeys = new Set(
    input.baseCandidates.map((candidate) => memberKey(candidate.memberIds)),
  )
  const byBangbooAndStar = new Map<string, readonly TeamEngineCandidate[]>()

  return ({ memberIds, bangbooId, bangbooStar: requestedBangbooStar }) => {
    const formationKey = memberKey(memberIds)
    // The authority workset intentionally spans more formations than the
    // current Engine shortlist. This adapter projects only identities the
    // Engine already admits; it never creates a parallel formation producer.
    if (!knownFormationKeys.has(formationKey)) return undefined

    const baselineBangbooStar = bangbooStarForId(input.boxInput.bangbooStarsById, bangbooId)
    const candidateStars = requestedBangbooStar
      ? [requestedBangbooStar]
      : ([1, 2, 3, 4, 5] as const).filter((bangbooStar) => bangbooStar >= baselineBangbooStar)
    for (const bangbooStar of candidateStars) {
      const cacheKey = `${bangbooId}:${bangbooStar}`
      const recomputed =
        byBangbooAndStar.get(cacheKey) ??
        solveTeamEngine(input.pack, {
          ...input.boxInput,
          bangbooCandidateIds: [bangbooId],
          // This is an execution requirement probe, never an account mutation.
          bangbooStarsById: { ...input.boxInput.bangbooStarsById, [bangbooId]: bangbooStar },
        }).recommendations
      byBangbooAndStar.set(cacheKey, recomputed)
      const candidate = recomputed.find(
        (item) =>
          memberKey(item.memberIds) === formationKey &&
          isExecutableBangbooCandidate(item, bangbooId),
      )
      if (candidate) return candidate
    }
    return undefined
  }
}
