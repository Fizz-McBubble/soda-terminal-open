import type { DriveDisc } from '../domain/schemas'
import type { AccountPlanningDraft } from './types'

/** Legacy single-agent plans may lack scope; explicitly non-personal scopes never qualify. */
export function isPersonalSavedAgentPlan(plan: AccountPlanningDraft, agentId: string) {
  return (
    plan.kind === 'agent' &&
    plan.state === 'saved' &&
    plan.selection.agentIds.length === 1 &&
    plan.selection.agentIds[0] === agentId &&
    (plan.solutionContext?.scope === undefined ||
      plan.solutionContext.scope === 'agent_independent')
  )
}

export function isPersonalCurrentReference(plan: AccountPlanningDraft, agentId: string) {
  return plan.savedRole === 'current_reference' && isPersonalSavedAgentPlan(plan, agentId)
}

export function comparePersonalCurrentReferences(
  left: AccountPlanningDraft,
  right: AccountPlanningDraft,
) {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.revision - left.revision ||
    right.id.localeCompare(left.id)
  )
}

/** Keep a broken newest reference visible as broken, rather than picking older data. */
export function resolvePersonalReferenceDiscs(
  plan: AccountPlanningDraft,
  discs: readonly DriveDisc[],
) {
  const loadouts =
    plan.candidateWarehouse?.scope === 'agent'
      ? plan.candidateWarehouse.loadouts.filter(
          (loadout) => loadout.agentId === plan.selection.agentIds[0],
        )
      : []
  if (
    plan.candidateWarehouse &&
    (plan.candidateWarehouse.scope !== 'agent' ||
      plan.candidateWarehouse.loadouts.length !== 1 ||
      loadouts.length !== 1)
  )
    return null
  if (
    plan.warehouseRefs.length > 0 &&
    loadouts.length === 1 &&
    (loadouts[0]!.discIds.length !== plan.warehouseRefs.length ||
      loadouts[0]!.discIds.some((id) => !plan.warehouseRefs.includes(id)))
  )
    return null
  const ids =
    plan.warehouseRefs.length === 0 && loadouts.length === 1
      ? loadouts[0]!.discIds
      : plan.warehouseRefs
  if (ids.length !== 6 || new Set(ids).size !== 6) return null
  const selected = ids.flatMap((id) => {
    const matches = discs.filter((disc) => disc.id === id)
    return matches.length === 1 ? matches : []
  })
  return selected.length === 6 &&
    new Set(selected.map((disc) => disc.slot)).size === 6 &&
    selected.every((disc) => disc.slot >= 1 && disc.slot <= 6)
    ? selected
    : null
}
