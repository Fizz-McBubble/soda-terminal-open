import type { AccountPlanningDraft } from '../accounts/types'
import {
  comparePersonalCurrentReferences,
  isPersonalCurrentReference,
} from '../accounts/personalCurrentReference'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'

/** Independent references report overlap without reserving discs or consulting team plans. */
export function currentIndependentPlans(drafts: AccountPlanningDraft[], accountId: string) {
  const latest = new Map<string, AccountPlanningDraft>()
  for (const draft of drafts) {
    const agentId = draft.selection.agentIds[0]
    if (draft.accountId !== accountId || !agentId || !isPersonalCurrentReference(draft, agentId))
      continue
    const previous = latest.get(agentId)
    if (!previous || comparePersonalCurrentReferences(draft, previous) < 0) {
      latest.set(agentId, draft)
    }
  }
  return latest
}

export function independentDiscConflicts(
  plans: Map<string, AccountPlanningDraft>,
  agentId: string,
) {
  const conflicts = new Map<string, string[]>()
  for (const [ownerId, plan] of plans) {
    if (ownerId === agentId) continue
    for (const discId of resolvePlanningDiscReferences(plan).referenceIds) {
      conflicts.set(discId, [...(conflicts.get(discId) ?? []), ownerId])
    }
  }
  return conflicts
}
