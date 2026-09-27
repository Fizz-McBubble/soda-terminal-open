import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { TeamEngineResult } from '../teamEngine/contracts'

export function uniqueInOrder(values: readonly string[]) {
  return [...new Set(values)]
}

function candidatesInHardPreferenceOrder(
  result: TeamEngineResult,
  preference: TeamPortfolioPreference,
) {
  const hardAgentIds = new Set(preference.fixedAgentIds)
  const hardBangbooIds = new Set(preference.fixedBangbooIds)
  const hardTemplateIds = new Set(preference.templateIds)
  return [...result.recommendations].sort((left, right) => {
    const hardRank = (candidate: TeamEngineResult['recommendations'][number]) =>
      Number(hardTemplateIds.has(candidate.candidateId)) * 4 +
      Number(candidate.memberIds.some((agentId) => hardAgentIds.has(agentId))) * 2 +
      Number(Boolean(candidate.bangbooId && hardBangbooIds.has(candidate.bangbooId)))
    return hardRank(right) - hardRank(left)
  })
}

export function allocationTargetCandidates(
  result: TeamEngineResult,
  preference: TeamPortfolioPreference,
) {
  const ordered = candidatesInHardPreferenceOrder(result, preference)
  const hasHardTeamPreference = Boolean(
    preference.templateIds.length ||
    preference.fixedAgentIds.length ||
    preference.fixedBangbooIds.length,
  )
  const pool = hasHardTeamPreference
    ? ordered.filter(
        (candidate) =>
          preference.templateIds.includes(candidate.candidateId) ||
          candidate.memberIds.some((agentId) => preference.fixedAgentIds.includes(agentId)) ||
          Boolean(candidate.bangbooId && preference.fixedBangbooIds.includes(candidate.bangbooId)),
      )
    : ordered
  const selected: TeamEngineResult['recommendations'] = []
  const usedAgentIds = new Set<string>()
  for (const candidate of pool) {
    if (candidate.memberIds.some((agentId) => usedAgentIds.has(agentId))) continue
    selected.push(candidate)
    candidate.memberIds.forEach((agentId) => usedAgentIds.add(agentId))
    if (selected.length === preference.teamCount) break
  }
  return selected
}
