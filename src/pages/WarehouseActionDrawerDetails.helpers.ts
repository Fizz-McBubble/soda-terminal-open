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
  return plans.reduce<SavedUsageReference[]>((references, plan) => {
    if (plan.state !== 'saved' || seenPlanIds.has(plan.id)) return references
    const team = teams.find((candidate) => (candidate.planId ?? candidate.candidateId) === plan.id)
    seenPlanIds.add(plan.id)
    references.push({ plan, ...(team ? { team } : {}) })
    return references
  }, [])
}
