import type { TeamStrengthMechanicFeatures } from './teamStrengthMechanicFeatures'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { resolveReviewedPhoenixTeam33 } from './reviewedPhoenixTeams33'

/** Missing optional effect quantities lower confidence, not the team's legality.
 * Conflicting sources still block; partial resource contracts remain visible in
 * reliability and limitations without rejecting the whole team by default. */
export function hasDefaultTeamRecommendationEvidence(
  features: Pick<TeamStrengthMechanicFeatures, 'eligibility' | 'supportEvidence'>,
  memberIds: readonly string[],
) {
  const evidence = features.supportEvidence
  return (
    features.eligibility.eligible &&
    evidence.sourceConflictProviderIds.length === 0 &&
    memberIds.length === 3 &&
    new Set(memberIds).size === 3 &&
    (!!resolveReviewedPhoenixTeam33(memberIds) ||
      memberIds.every(
        (id) =>
          getCurrentAgentDecisionMechanicContract(resolveCurrentReleasedIdentity(id)) !== null,
      ))
  )
}

export {
  selectDefaultTeamRecommendationIds,
  selectDefaultTeamRecommendationPool,
} from './defaultTeamRecommendationSelection'
export type { DefaultTeamRecommendationCandidate } from './defaultTeamRecommendationSelection'
