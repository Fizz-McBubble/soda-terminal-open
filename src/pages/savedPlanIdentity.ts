import type { AccountPlanningDraft } from '../accounts/types'
import { contentHash } from '../application/contentHash'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'

function sameSavedDiscIds(left: readonly string[], right: readonly string[]) {
  return (
    left.length === 6 &&
    right.length === 6 &&
    new Set(left).size === 6 &&
    new Set(right).size === 6 &&
    [...left].sort().join('|') === [...right].sort().join('|')
  )
}

/** A current fit is usable only when all three persisted disc assignments still match. */
export function savedTeamTargetFitMatchesSavedDiscs(
  plan: AccountPlanningDraft,
  targetTeamFit: TargetTeamWarehouseFitQueryResult,
) {
  const savedLoadouts = plan.candidateWarehouse?.loadouts
  const savedExecution = plan.teamExecutionSnapshot
  if (
    !savedLoadouts ||
    !savedExecution ||
    savedLoadouts.length !== 3 ||
    savedExecution.members.length !== 3
  )
    return false
  const savedIds = new Set(savedLoadouts.flatMap((loadout) => loadout.discIds))
  if (savedIds.size !== 18 || savedLoadouts.some((loadout) => loadout.discIds.length !== 6))
    return false
  return (
    plan.selection.agentIds.length === 3 &&
    plan.selection.agentIds.every((agentId) => {
      const savedLoadout = savedLoadouts.find((loadout) => loadout.agentId === agentId)
      const savedMember = savedExecution.members.find((member) => member.agentId === agentId)
      const currentLoadout = targetTeamFit.warehousePlan.loadouts.find(
        (loadout) => loadout.agentId === agentId,
      )
      return Boolean(
        savedLoadout &&
        savedMember &&
        currentLoadout &&
        sameSavedDiscIds(savedLoadout.discIds, savedMember.suggested.discIds) &&
        sameSavedDiscIds(
          savedLoadout.discIds,
          currentLoadout.discs.map((choice) => choice.disc.id),
        ),
      )
    })
  )
}

export function savedTeamDiscAssignmentFingerprint(plan: AccountPlanningDraft) {
  return contentHash({
    planId: plan.id,
    candidateWarehouse: plan.candidateWarehouse?.loadouts
      .map((loadout) => ({ agentId: loadout.agentId, discIds: [...loadout.discIds].sort() }))
      .sort((left, right) => left.agentId.localeCompare(right.agentId)),
    executionSnapshot: plan.teamExecutionSnapshot?.members
      .map((member) => ({ agentId: member.agentId, discIds: [...member.suggested.discIds].sort() }))
      .sort((left, right) => left.agentId.localeCompare(right.agentId)),
  })
}
