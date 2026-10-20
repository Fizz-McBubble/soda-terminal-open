import {
  candidateConstraintToDiscProfile,
  getCandidateWarehouseConstraint,
  type CandidateWarehouseConstraint,
  type CandidateWarehouseRecommendation,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { getAgentProfile } from '../gameDataPacks/agentProfile'

export function candidateConstraintForAgent(agentId: string): CandidateWarehouseConstraint | null {
  const constraint = getCandidateWarehouseConstraint(agentId)
  if (constraint?.status !== 'candidate') return null
  // 3.1 catalogue intake is a separate candidate layer until the agent receives a
  // formal game ID/Profile projection. Do not let the 3.0-only profile fallback
  // erase an otherwise sourced candidate warehouse constraint.
  if (constraint.gameVersion === '3.1' || constraint.gameVersion === '3.2') return constraint
  return getAgentProfile(agentId).warehouseStatus === 'candidate' ? constraint : null
}

export function candidateConstraintFromIntent(
  agentId: string,
  recommendations?: readonly CandidateWarehouseRecommendation[],
): CandidateWarehouseConstraint | null {
  const compiled = recommendations?.find((item) => item.agentId === agentId)
  if (recommendations) return compiled?.constraint ?? null
  return candidateConstraintForAgent(agentId)
}

export function getCandidateWarehouseProfiles(
  agentIds: string[],
  availableSetIds: string[],
  recommendations?: readonly CandidateWarehouseRecommendation[],
) {
  return agentIds.flatMap((agentId) => {
    const constraint = candidateConstraintFromIntent(agentId, recommendations)
    const profile = constraint ? candidateConstraintToDiscProfile(constraint) : null
    if (!profile) return []
    // Candidate constraints can retain a historical evidence id while the
    // account and solver use the released stable id. Keep provenance on the
    // constraint, but solve and return the plan for the selected account agent.
    const accountProfile = { ...profile, agentId }
    if (constraint!.setIds.length > 1) return [accountProfile]
    return [
      {
        ...accountProfile,
        setPlans: [
          {
            pattern: '4+2' as const,
            primarySets: [constraint!.setIds[0]!],
            // The source supports the 4-piece direction but does not claim a specific 2-piece.
            // Keep the unscored two-piece explicit in the result instead of fabricating a set bonus.
            secondarySets: availableSetIds.filter((setId) => setId !== constraint!.setIds[0]),
          },
        ],
      },
    ]
  })
}
