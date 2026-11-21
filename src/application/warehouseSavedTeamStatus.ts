import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import type { AccountPlanningDraft } from '../accounts/types'
import type { DriveDisc } from '../domain/schemas'

/** Status of the exact saved team and its recorded disc assignments. */
export function savedTeamStatus(
  draft: AccountPlanningDraft,
  byId: ReadonlyMap<string, DriveDisc>,
): 'ready' | 'needs_confirmation' | 'missing_equipment' {
  if (!resolvePlanningDiscReferences(draft).consistent) return 'needs_confirmation'
  if (
    draft.warehouseRefs.length !== 18 ||
    new Set(draft.warehouseRefs).size !== 18 ||
    draft.warehouseRefs.some((id) => !byId.has(id))
  )
    return 'missing_equipment'
  const execution = draft.teamExecutionSnapshot
  const matchingExecution =
    execution &&
    execution.memberIds.length === 3 &&
    execution.memberIds.every((id) => draft.selection.agentIds.includes(id))
      ? execution
      : null
  if (
    matchingExecution?.status === 'missing_equipment' ||
    matchingExecution?.blockers.length ||
    matchingExecution?.members.some((member) => member.status === 'missing_equipment')
  )
    return 'missing_equipment'
  const loadouts =
    matchingExecution?.members.map((member) => ({
      agentId: member.agentId,
      discIds: member.suggested.discIds,
    })) ?? draft.candidateWarehouse?.loadouts
  if (!loadouts) return 'needs_confirmation'
  const assigned = loadouts.flatMap((loadout) => loadout.discIds)
  const complete =
    new Set(draft.selection.agentIds).size === 3 &&
    loadouts.length === 3 &&
    new Set(loadouts.map((loadout) => loadout.agentId)).size === 3 &&
    loadouts.every(
      (loadout) =>
        draft.selection.agentIds.includes(loadout.agentId) &&
        loadout.discIds.length === 6 &&
        loadout.discIds.every((id) => byId.has(id)) &&
        new Set(loadout.discIds.map((id) => byId.get(id)?.slot)).size === 6,
    ) &&
    assigned.length === 18 &&
    new Set(assigned).size === 18 &&
    new Set(draft.warehouseRefs).size === 18 &&
    assigned.every((id) => draft.warehouseRefs.includes(id))
  if (!complete) return 'missing_equipment'
  if (matchingExecution?.members.some((member) => member.status === 'needs_confirmation'))
    return 'needs_confirmation'
  return matchingExecution?.status ?? 'needs_confirmation'
}
