import type { WarehouseActionItem } from '../application/warehouseActionProjection'

export type SavedUsageReference = {
  plan: WarehouseActionItem['affectedPlans'][number]
  team?: WarehouseActionItem['affectedTeams'][number]
}

export function savedUsageReferences(
  plans: WarehouseActionItem['affectedPlans'],
  teams: WarehouseActionItem['affectedTeams'],
) {
  const seenPlanIds = new Set<string>()
  const seenMemberIdentities = new Set<string>()
  const aligned = plans.length === teams.length
  return plans.reduce<SavedUsageReference[]>((references, plan, index) => {
    if (plan.state !== 'saved' || seenPlanIds.has(plan.id)) return references
    const team =
      teams.find((candidate) => candidate.candidateId === plan.id) ??
      (aligned ? teams[index] : undefined)
    const memberIdentity = team ? [...team.memberIds].sort().join('|') : null
    if (memberIdentity && seenMemberIdentities.has(memberIdentity)) return references
    seenPlanIds.add(plan.id)
    if (memberIdentity) seenMemberIdentities.add(memberIdentity)
    references.push({ plan, ...(team ? { team } : {}) })
    return references
  }, [])
}
