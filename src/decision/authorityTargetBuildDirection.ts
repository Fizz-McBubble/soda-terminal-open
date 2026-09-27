import { authorityConsumerRecommendations } from './accountDecisionAuthorityConsumers'
import type { TeamBuildExecutionIdentity } from './teamBuildExecutionIdentity'

type AuthorityRecommendation = ReturnType<typeof authorityConsumerRecommendations>[number]

/**
 * Preserves an Authority exact Variant as a target-build identity without
 * manufacturing Team Engine ranking or combat metadata.  The Authority has
 * already established the exact three members and named Bangboo; it has not
 * established an Engine execution scenario for every such direction.
 */
export type AuthorityTargetBuildDirection = TeamBuildExecutionIdentity & {
  bangbooId: string
  provenance: 'authority_exact'
  authority: Pick<
    AuthorityRecommendation,
    'featureVector' | 'teamRating' | 'mechanicValidity' | 'mechanicRating' | 'metaCalibration'
  >
}

export function authorityTargetBuildDirection(
  recommendation: AuthorityRecommendation,
): AuthorityTargetBuildDirection | undefined {
  if (!recommendation.bangbooId) return undefined
  return {
    candidateId: recommendation.candidateId,
    memberIds: [
      recommendation.memberIds[0],
      recommendation.memberIds[1],
      recommendation.memberIds[2],
    ],
    bangbooId: recommendation.bangbooId,
    scenarioTags: [],
    provenance: 'authority_exact',
    authority: {
      featureVector: recommendation.featureVector,
      teamRating: recommendation.teamRating,
      mechanicValidity: recommendation.mechanicValidity,
      mechanicRating: recommendation.mechanicRating,
      metaCalibration: recommendation.metaCalibration,
    },
  }
}
