import type { AccountPlanningDraft } from '../accounts/types'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type {
  MultiTeamCoordination,
  SourceBackedTeamCandidate,
} from '../optimizer/multiTeamCoordinator'

/** Selection proves intent. Only saved physical plans prove protected entities. */
export function warehouseDecisionDemand(
  preference: TeamPortfolioPreference,
  coordination: MultiTeamCoordination,
  candidates: SourceBackedTeamCandidate[],
  drafts: AccountPlanningDraft[],
) {
  const savedPortfolio =
    preference.teamCount > 1 &&
    preference.templateIds.length > 0 &&
    coordination.teams.every((team) =>
      team.template.members.every((member) => {
        const id = team.planIdsByAgent[member.agentId]
        return Boolean(id && drafts.some((draft) => draft.id === id && draft.state === 'saved'))
      }),
    )
  const discIds = savedPortfolio ? coordination.teams.flatMap((team) => team.discIds) : []
  return {
    selectedTeamAgentIds: candidates
      .filter((candidate) => preference.templateIds.includes(candidate.templateId))
      .map((candidate) => candidate.members.map((member) => member.agentId)),
    protectedSimultaneousDemands: discIds.length ? [{ id: 'selected-portfolio', discIds }] : [],
    protectedDemandCoverageComplete:
      !savedPortfolio ||
      (coordination.status === 'ready' &&
        coordination.teams.length === preference.teamCount &&
        discIds.length === preference.teamCount * 18 &&
        new Set(discIds).size === preference.teamCount * 18),
  }
}
