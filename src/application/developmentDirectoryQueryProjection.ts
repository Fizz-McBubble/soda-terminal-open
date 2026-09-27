import {
  getCurrentBuildProfile,
  getBuildRecommendation,
  getSelectedBuildBranchId,
} from '../assault/currentBuildProfiles'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { agentDevelopmentSkillRecommendations } from '../pages/agentDevelopmentSkillRecommendations'
import { projectAgentDecision } from './accountDecisionProjections'
import { accountDecisionNextAction, type AccountDecisionWorld } from './accountDecisionWorldModel'
import type { AccountDecisionRun } from './calculationQueryContract'
import type { DevelopmentDirectoryProjection } from './publicDevelopmentDirectoryContract'
import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'

type ReadyWorld = Extract<AccountDecisionWorld, { status: 'current' | 'stale' }>

/** Private Query output; the browser receives only serializable display decisions. */
export function projectDevelopmentDirectoryQuery(
  run: AccountDecisionRun,
): DevelopmentDirectoryProjection {
  const world = (status: 'current' | 'stale'): ReadyWorld => ({
    status,
    run,
    liveFingerprint: run.snapshot.fingerprint.inputHash,
    nextAction: accountDecisionNextAction(
      status === 'stale' ? 'stale' : run.snapshot.claims.overall.status,
      {
        status: run.snapshot.decisionAuthority.status,
        recommendationCount: run.snapshot.decisionAuthority.recommendations.length,
        blockers:
          run.snapshot.decisionAuthority.status === 'blocked'
            ? [...run.snapshot.decisionAuthority.blockers]
            : [],
      },
    ),
  })
  const current = world('current')
  const stale = world('stale')
  const eligibleIds = new Set<string>(
    publicDevelopmentDirectoryCatalog
      .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
      .map((entry) => entry.stableId),
  )
  return {
    contract: 'soda-development-directory/v1',
    runId: run.runId,
    accountId: run.input.warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    decisions: run.input.warehouse.roster.agents
      .filter((record) => record.owned && eligibleIds.has(record.agentId))
      .map((record) => {
        const agentId = record.agentId
        const projection = projectAgentDecision(current, agentId)
        const profile = getProjectedBuildKnowledgeProfile(agentId)
        const currentBuildProfile = getCurrentBuildProfile(agentId)
        const recommendation = currentBuildProfile
          ? getBuildRecommendation(
              currentBuildProfile,
              getSelectedBuildBranchId(record) ?? currentBuildProfile.defaultBranchId,
            )
          : null
        const guidance = agentDevelopmentSkillRecommendations(
          agentId,
          profile.recommendation?.skillPriority ??
            getCandidateWarehouseConstraint(agentId)?.progressionDirection ??
            [],
          recommendation?.skillPriority ?? [],
        )
        return {
          agentId,
          current: { status: projection.status, summary: projection.summary },
          staleSummary: projectAgentDecision(stale, agentId).summary,
          authority: projection.authorityRecommendation
            ? {
                teamRating: projection.authorityRecommendation.teamRating,
                cultivationPriority: projection.authorityRecommendation.cultivationPriority,
                confidence: projection.authorityRecommendation.confidence,
              }
            : null,
          skills: guidance.skills.map(({ key, label, targetLevel, priority }) => ({
            key,
            label,
            targetLevel,
            priority,
          })),
        }
      }),
  }
}
