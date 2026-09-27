import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'

/** Private Query side: freeze reviewed directions with the captured candidate solve. */
export function projectDevelopmentCandidatePresentation(agentId: string) {
  const constraint = getCandidateWarehouseConstraint(agentId)
  const profile = getProjectedBuildKnowledgeProfile(agentId)
  return {
    contract: 'soda-development-candidate-presentation/v1' as const,
    preferredStatKeys: Object.entries(constraint?.subStatWeights ?? {})
      .filter(([, weight]) => weight > 0)
      .toSorted(([, left], [, right]) => right - left)
      .map(([key]) => key),
    recommendedMainStats: {
      '4': [...(constraint?.mainStats['4'] ?? [])],
      '5': [...(constraint?.mainStats['5'] ?? [])],
      '6': [...(constraint?.mainStats['6'] ?? [])],
    },
    progressionDirections: [
      ...(profile.recommendation?.skillPriority ?? constraint?.progressionDirection ?? []),
    ],
  }
}
