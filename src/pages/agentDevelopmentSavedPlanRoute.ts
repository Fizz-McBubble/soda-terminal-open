import type { AccountPlanningDraft } from '../accounts/types'
import type { DriveDisc } from '../domain/schemas'

export type SavedAgentPlanRouteResolution =
  | { status: 'current'; plan: AccountPlanningDraft | undefined }
  | { status: 'saved'; plan: AccountPlanningDraft }
  | { status: 'missing' }
  | { status: 'references_changed' }

function matchesAgentPlan(plan: AccountPlanningDraft, agentId: string) {
  return (
    plan.kind === 'agent' &&
    plan.state === 'saved' &&
    plan.selection.agentIds.length === 1 &&
    plan.selection.agentIds[0] === agentId
  )
}

function hasCompleteReferences(plan: AccountPlanningDraft, discs: DriveDisc[]) {
  const referencedDiscs = discs.filter((disc) => plan.warehouseRefs.includes(disc.id))
  return (
    plan.warehouseRefs.length === 6 &&
    new Set(plan.warehouseRefs).size === 6 &&
    referencedDiscs.length === 6 &&
    new Set(referencedDiscs.map((disc) => disc.slot)).size === 6
  )
}

function newestCurrentReference(plans: AccountPlanningDraft[]) {
  return plans.toSorted(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.revision - left.revision,
  )[0]
}

export function resolveSavedAgentPlanRoute(input: {
  requestedPlanId: string | null
  agentId: string
  activePlanId: string | null | undefined
  planningDrafts: AccountPlanningDraft[]
  discs: DriveDisc[]
}): SavedAgentPlanRouteResolution {
  const { requestedPlanId, agentId, activePlanId, planningDrafts, discs } = input
  if (!requestedPlanId) {
    if (activePlanId) {
      const active = planningDrafts.find((plan) => plan.id === activePlanId)
      if (!active || !matchesAgentPlan(active, agentId)) return { status: 'missing' }
      return hasCompleteReferences(active, discs)
        ? { status: 'current', plan: active }
        : { status: 'references_changed' }
    }
    const currentReference = newestCurrentReference(
      planningDrafts.filter(
        (plan) =>
          matchesAgentPlan(plan, agentId) &&
          plan.savedRole === 'current_reference' &&
          plan.solutionContext?.scope === 'agent_independent',
      ),
    )
    if (!currentReference) return { status: 'current', plan: undefined }
    return hasCompleteReferences(currentReference, discs)
      ? { status: 'current', plan: currentReference }
      : { status: 'references_changed' }
  }

  const plan = planningDrafts.find(
    (item) => item.id === requestedPlanId && matchesAgentPlan(item, agentId),
  )
  if (!plan) return { status: 'missing' }
  return hasCompleteReferences(plan, discs)
    ? { status: 'saved', plan }
    : { status: 'references_changed' }
}
