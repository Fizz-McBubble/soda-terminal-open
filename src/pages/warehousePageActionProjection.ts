import type { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import {
  displayWarehouseActionProjection,
  type WarehouseActionProjection,
} from '../application/warehouseActionContract'
import type { DriveDisc } from '../domain/schemas'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { savedDiscAgentIds } from '../warehouse/discWarehousePlanAssignments'
import { warehousePlanReferences } from '../application/warehousePlanReferences'

/** Reconcile the captured recommendations with current account facts before display. */
export function warehousePageActionProjection(
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>,
  discs: readonly DriveDisc[] | undefined,
  projection: WarehouseActionProjection | undefined,
) {
  if (decisionWorld.status !== 'current' && decisionWorld.status !== 'stale') return null
  const captured = displayWarehouseActionProjection(projection, decisionWorld.status)
  if (!captured) return null
  // Older captured projections may contain the retired A/B cleanup policy.
  const liveDiscs = decisionWorld.liveInput?.warehouse.discs ?? discs ?? []
  const liveEligibleIds = new Set(
    liveDiscs.filter((disc) => disc.rarity === 'S').map((disc) => disc.id),
  )
  const eligibleIds = new Set(
    discs
      ?.filter((disc) => disc.rarity === 'S' && liveEligibleIds.has(disc.id))
      .map((disc) => disc.id),
  )
  const liveById = new Map(liveDiscs.map((disc) => [disc.id, disc]))
  const input = decisionWorld.liveInput ?? decisionWorld.run.input
  const equippedByDisc = new Map<string, string[]>()
  for (const agent of input.warehouse.roster.agents)
    for (const discId of agent.equippedDiscIds ?? [])
      equippedByDisc.set(discId, [...(equippedByDisc.get(discId) ?? []), agent.agentId])
  const plansByDisc = new Map<string, typeof input.drafts>()
  for (const draft of input.drafts)
    for (const discId of resolvePlanningDiscReferences(draft).referenceIds)
      plansByDisc.set(discId, [...(plansByDisc.get(discId) ?? []), draft])
  const actions = captured.actions
    .filter((item) => eligibleIds.has(item.disc.id))
    .map((item) => {
      const drafts = plansByDisc.get(item.disc.id) ?? []
      const equippedAgentIds = equippedByDisc.get(item.disc.id) ?? []
      const usageAgentIds = [
        ...new Set([
          ...equippedAgentIds,
          ...drafts.flatMap((draft) => savedDiscAgentIds(draft, item.disc.id)),
        ]),
      ]
      const affectedPlans = warehousePlanReferences(
        drafts,
        Object.values(input.activePlanIds).filter((id): id is string => typeof id === 'string'),
      )
      const portfolioReferenced =
        captured.state === 'current' && item.statuses.includes('selected_portfolio_reference')
      const statuses = item.statuses.filter(
        (status) =>
          ![
            'currently_equipped',
            'active_plan_reference',
            'saved_plan_reference',
            'selected_portfolio_reference',
          ].includes(status),
      )
      if (portfolioReferenced) statuses.push('selected_portfolio_reference')
      if (equippedAgentIds.length) statuses.push('currently_equipped')
      if (affectedPlans.some((plan) => plan.active)) statuses.push('active_plan_reference')
      if (affectedPlans.some((plan) => plan.state === 'saved'))
        statuses.push('saved_plan_reference')
      return {
        ...item,
        disc: liveById.get(item.disc.id) ?? item.disc,
        usageAgentIds,
        affectedPlans,
        statuses,
        usage: {
          state:
            usageAgentIds.length || affectedPlans.length || portfolioReferenced
              ? ('recorded' as const)
              : ('not_recorded' as const),
          agentIds: usageAgentIds,
          planIds: drafts.map((draft) => draft.id),
        },
        ...(captured.state === 'stale' ? { affectedTeams: [] } : {}),
      }
    })
  const counts = { keep: 0, enhance: 0, cleanup: 0 }
  for (const item of actions)
    if (item.finalRecommendation) counts[item.finalRecommendation.action]++
  return { ...captured, actions, counts }
}
