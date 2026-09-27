import type { AccountPlanningDraft } from '../accounts/types'

/** Independent references report overlap without reserving discs or consulting team plans. */
export function currentIndependentPlans(drafts: AccountPlanningDraft[], accountId: string) {
  const latest = new Map<string, AccountPlanningDraft>()
  for (const draft of drafts) {
    if (
      draft.accountId !== accountId ||
      draft.kind !== 'agent' ||
      draft.state !== 'saved' ||
      draft.savedRole !== 'current_reference' ||
      draft.selection.agentIds.length !== 1 ||
      draft.solutionContext?.scope !== 'agent_independent'
    )
      continue
    const agentId = draft.selection.agentIds[0]
    const previous = latest.get(agentId)
    if (
      !previous ||
      previous.updatedAt < draft.updatedAt ||
      (previous.updatedAt === draft.updatedAt && previous.revision < draft.revision)
    ) {
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
    for (const discId of new Set(plan.warehouseRefs)) {
      conflicts.set(discId, [...(conflicts.get(discId) ?? []), ownerId])
    }
  }
  return conflicts
}
