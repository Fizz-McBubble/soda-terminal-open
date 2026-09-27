import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { SourceBackedTeamCandidate } from '../optimizer/multiTeamCoordinator'
import type { TeamEnginePack, TeamEngineResult } from '../teamEngine/contracts'
import {
  inspectTeamEngineAdapterDrop,
  teamEngineAdapterDiagnostics,
  type TeamEngineAdapterDiagnostics,
} from '../teamEngine/coverageDiagnostics'

export type TeamEngineCoordinationAdapterProjection = {
  candidates: SourceBackedTeamCandidate[]
  diagnostics: TeamEngineAdapterDiagnostics
}

/**
 * Adapts only closed Team Engine recommendations to the existing physical-disc coordinator.
 * Rejected and assemble-only results remain explanation evidence and never enter coordination.
 */
export function teamEngineRecommendationsForCoordination(input: {
  result: TeamEngineResult
  pack: TeamEnginePack
  preference: TeamPortfolioPreference
  currentPlanIdsByAgent: Readonly<Record<string, string | null | undefined>>
}): SourceBackedTeamCandidate[] {
  return teamEngineRecommendationsForCoordinationWithDiagnostics(input).candidates
}

export function teamEngineRecommendationsForCoordinationWithDiagnostics(input: {
  result: TeamEngineResult
  pack: TeamEnginePack
  preference: TeamPortfolioPreference
  currentPlanIdsByAgent: Readonly<Record<string, string | null | undefined>>
}): TeamEngineCoordinationAdapterProjection {
  const rulesById = new Map(input.pack.agentRules.map((rule) => [rule.agentId, rule]))
  const kernelsById = new Map(input.pack.kernels.map((kernel) => [kernel.kernelId, kernel]))

  const candidates = input.result.recommendations.flatMap((candidate) => {
    if (!candidate.kernelId) return []
    if (inspectTeamEngineAdapterDrop(candidate, input.pack)) return []
    const kernel = kernelsById.get(candidate.kernelId)
    if (!kernel) return []
    const members = candidate.memberIds.map((agentId) => {
      const rule = rulesById.get(agentId)
      if (!rule) return null
      const planId =
        input.preference.planIdsByAgent[agentId] ?? input.currentPlanIdsByAgent[agentId] ?? null
      return {
        agentId,
        role: rule.specialty,
        requiredAgentId: agentId,
        substitution: 'none' as const,
        currentPlan: { status: planId ? ('available' as const) : ('unavailable' as const), planId },
      }
    })
    if (members.some((member) => member === null)) return []

    return [
      {
        templateId: candidate.candidateId,
        label: candidate.label,
        coreAgentId: kernel.coreAgentIds[0],
        members: members as SourceBackedTeamCandidate['members'],
        bangbooId: candidate.bangbooId,
        scenario: candidate.scenarioTags.join('|') || null,
        formulaFamily: candidate.kernelId,
        source: {
          sourceIds: candidate.sourceIds,
          evidenceLocator: `soda-team-engine/v1:${candidate.kernelId}`,
          sourceRevision: input.pack.gameVersion,
        },
        strength: {
          status: 'candidate' as const,
          band: candidate.metaBand,
          boundary: 'Team Engine Candidate；不代表 Formal、伤害、DPS、最高或数学最优。',
        },
      },
    ]
  })
  return {
    candidates,
    diagnostics: teamEngineAdapterDiagnostics(input.result, input.pack),
  }
}
