import type { AccountPlanningDraft } from '../accounts/types'
import type { DriveDisc } from '../domain/schemas'
import {
  comparePersonalCurrentReferences,
  isPersonalCurrentReference,
  isPersonalSavedAgentPlan,
  resolvePersonalReferenceDiscs,
} from '../accounts/personalCurrentReference'

export type SavedAgentPlanComparisonTarget = {
  wEngine: {
    engineId: string
    level: number
    ascension?: number
    refinement: number
  } | null
  potential: number | null
}

export type SavedAgentPlanRouteResolution =
  | { status: 'current'; plan: AccountPlanningDraft | undefined }
  | { status: 'saved'; plan: AccountPlanningDraft }
  | { status: 'missing' }
  | { status: 'references_changed' }

/** Read-only comparison intent. Missing fields stay unknown instead of borrowing current facts. */
export function savedAgentPlanComparisonTarget(
  plan: AccountPlanningDraft,
): SavedAgentPlanComparisonTarget {
  const parameters = plan.solutionContext?.comparisonParameters
  return {
    wEngine: parameters?.wEngine ? { ...parameters.wEngine } : null,
    potential: parameters?.potential ?? null,
  }
}

function matchesAgentPlan(plan: AccountPlanningDraft, agentId: string) {
  return isPersonalSavedAgentPlan(plan, agentId)
}

function hasCompleteReferences(plan: AccountPlanningDraft, discs: DriveDisc[]) {
  return resolvePersonalReferenceDiscs(plan, discs) !== null
}

function newestCurrentReference(plans: AccountPlanningDraft[]) {
  return plans.toSorted(comparePersonalCurrentReferences)[0]
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
      planningDrafts.filter((plan) => isPersonalCurrentReference(plan, agentId)),
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
