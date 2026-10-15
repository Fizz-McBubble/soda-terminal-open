import type { TeamStrengthMechanicFeatures } from './teamStrengthMechanicFeatures'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'

/** Missing optional effect quantities lower confidence, not the team's legality.
 * Conflicting sources or an unavailable required resource contract still block. */
export function hasDefaultTeamRecommendationEvidence(
  features: Pick<TeamStrengthMechanicFeatures, 'eligibility' | 'supportEvidence'>,
  memberIds: readonly string[],
) {
  const evidence = features.supportEvidence
  return (
    features.eligibility.eligible &&
    evidence.sourceConflictProviderIds.length === 0 &&
    memberIds.every((id) => {
      const contract = getCurrentAgentDecisionMechanicContract(resolveCurrentReleasedIdentity(id))
      return contract !== null && contract.readiness.resourceFlow !== 'mechanic_contract_pending'
    })
  )
}

export {
  selectDefaultTeamRecommendationIds,
  selectDefaultTeamRecommendationPool,
} from './defaultTeamRecommendationSelection'
export type { DefaultTeamRecommendationCandidate } from './defaultTeamRecommendationSelection'
