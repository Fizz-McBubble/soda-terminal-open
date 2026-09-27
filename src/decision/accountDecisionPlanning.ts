import type { AccountPlanningDraft } from '../accounts/types'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { ActiveMemberPlan } from '../optimizer/multiTeamCoordinator'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'

export function activePlansForCoordination(
  drafts: AccountPlanningDraft[],
  preference: TeamPortfolioPreference,
  allocation: AccountBuildResult,
) {
  const draftsById = new Map(drafts.map((draft) => [draft.id, draft]))
  const plansByAgent: Record<string, ActiveMemberPlan> = Object.fromEntries(
    allocation.global.map((loadout) => [
      loadout.agentId,
      {
        planId: null,
        discIds: loadout.discs.map((choice) => choice.disc.id),
      } satisfies ActiveMemberPlan,
    ]),
  )
  for (const [agentId, planId] of Object.entries(preference.planIdsByAgent)) {
    if (!planId) continue
    const draft = draftsById.get(planId)
    if (!draft) {
      delete plansByAgent[agentId]
      continue
    }
    plansByAgent[agentId] = {
      planId,
      discIds: [...draft.warehouseRefs],
    }
  }
  return plansByAgent
}
