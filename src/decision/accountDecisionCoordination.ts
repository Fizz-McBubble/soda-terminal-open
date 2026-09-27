import { coordinateMatchedTeams } from '../optimizer/multiTeamCoordinator'
import type { AccountDecisionSnapshot } from './accountDecisionService'
import type { PortfolioJointBuildIntent } from './buildIntent'

/** Re-coordinates a player-selected portfolio without exposing a page-level solver. */
export function coordinateDecisionPortfolio(
  decision: Pick<AccountDecisionSnapshot, 'portfolioInput'>,
  buildIntent: PortfolioJointBuildIntent,
) {
  const preference = decision.portfolioInput.preference
  return coordinateMatchedTeams({
    matches: decision.portfolioInput.candidates,
    preference: {
      ...preference,
      teamCount: buildIntent.teamCount,
      templateIds:
        preference.templateIds.length <= buildIntent.teamCount ? preference.templateIds : [],
    },
    activePlansByAgent: decision.portfolioInput.activePlansByAgent,
    lockedTemplateIds: buildIntent.lockedCandidateIds,
  })
}
