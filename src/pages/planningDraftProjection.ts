import { type PlanningDraftInput } from '../accounts/planningDrafts'
import { getAgentName } from '../application/publicRosterNames'
import { localizedAgentNames } from '../application/savedPlanDisplayName'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import {
  formatCandidateMainStats,
  getCandidateSetLabels,
  formatCandidateSkillDirections,
  getCandidateWEngineLabels,
} from '../application/publicCandidateLabels'
// `import type` is fully erased; an inline `{ type X }` specifier survives as an empty side-effect
// import and would pull the private solver into the public browser bundle.
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { type DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'
import { type PlanningProfile } from './planningProfile'

export function decisionTeamWarehousePlan(
  decision: AccountDecisionSnapshot,
  agentIds: string[],
): CandidateWarehousePlan {
  const loadouts = agentIds.flatMap((agentId) =>
    decision.allocation.global.filter((loadout) => loadout.agentId === agentId),
  )
  const missing = agentIds.filter(
    (agentId) => !loadouts.some((loadout) => loadout.agentId === agentId),
  )
  // Allocation claims aggregate every owned agent. A team detail can only explain
  // diagnoses for its own members; passing the claim's flattened blocker list here
  // leaked unrelated agents into this candidate's six-disc result.
  const scopedAllocationGaps = decision.allocation.diagnostics
    .filter((diagnosis) => diagnosis.scope === 'global' && agentIds.includes(diagnosis.agentId))
    .flatMap((diagnosis) => diagnosis.reasons)
  return {
    scope: 'team',
    agentIds,
    loadouts,
    totalScore:
      Math.round(loadouts.reduce((sum, loadout) => sum + loadout.totalScore, 0) * 100) / 100,
    alternatives: [],
    gaps: [
      ...missing.map((agentId) => `${getAgentName(agentId)} 还没有匹配到六张驱动盘。`),
      ...scopedAllocationGaps,
    ],
    boundary: '本方案使用本次仓库匹配结果；保存前不会改动当前装备。',
  }
}

export function directionFor(profile: PlanningProfile) {
  const recommendation = profile.recommendation
  const setLabels = recommendation ? [...new Set(getCandidateSetLabels(recommendation.sets))] : []
  return {
    wEngineDirection: recommendation
      ? getCandidateWEngineLabels(recommendation.wEngines).join('、')
      : '资料待补齐',
    discDirection: recommendation
      ? `${setLabels.join('、')}；${formatCandidateMainStats(recommendation.mainStats)}`
      : '资料待补齐',
    progressionDirection: formatCandidateSkillDirections(recommendation?.skillPriority),
  }
}

export function draftFromProfiles(
  kind: 'agent' | 'team',
  profiles: PlanningProfile[],
  discIds: string[],
  team?: DecisionTeamViewModel,
): PlanningDraftInput {
  const first = profiles[0]!
  const direction = directionFor(first)
  return {
    kind,
    name: localizedAgentNames(
      kind === 'team' ? `${team?.title ?? '队伍'}方案` : `${first.agentName}方案`,
      profiles.map((profile) => profile.agentId),
    ),
    selection: {
      agentIds: profiles.map((profile) => profile.agentId),
      bangbooId: team?.bangbooId ?? null,
      scenario: team ? (team.scenario ?? '') : first.scenario,
    },
    manualOverrides: { ...direction, notes: '' },
    knowledgeRefs: profiles.map((profile) => ({
      profileId: profile.id,
      status: profile.status,
      version: profile.packageVersion,
      source: profile.sources.map((source) => source.label).join('、'),
    })),
    warehouseRefs: discIds,
    comparisonCapability: profiles.every((profile) => profile.status === 'formal')
      ? 'formal'
      : 'direction',
  }
}
