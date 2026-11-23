import type { AccountPlanningDraft } from '../accounts/types'

/**
 * Persisted rows have carried the same historical entity links in more than one compatible
 * projection. Keep their union for read-only restore; filtering against the current warehouse
 * would silently turn a recorded 18-disc plan into a shorter plan.
 */
export function savedPlanHistoricalDiscReferenceStatus(plan: AccountPlanningDraft) {
  const candidateWarehouseDiscIds =
    plan.candidateWarehouse?.loadouts.flatMap((loadout) => loadout.discIds) ?? []
  const executionMemberDiscIds =
    plan.teamExecutionSnapshot?.members.flatMap((member) => member.suggested.discIds) ?? []
  const portfolioExecutionDiscIds =
    plan.teamPortfolioSnapshot?.executions.flatMap((execution) => execution.physicalDiscIds) ?? []
  const portfolioMemberDiscIds =
    plan.teamPortfolioSnapshot?.executions.flatMap((execution) =>
      execution.members.flatMap((member) => member.suggested.discIds),
    ) ?? []
  const projections = [
    plan.warehouseRefs,
    candidateWarehouseDiscIds,
    ...(plan.teamExecutionSnapshot?.physicalDiscIds
      ? [plan.teamExecutionSnapshot.physicalDiscIds]
      : []),
    executionMemberDiscIds,
    ...(plan.teamPortfolioSnapshot?.uniquePhysicalDiscIds
      ? [plan.teamPortfolioSnapshot.uniquePhysicalDiscIds]
      : []),
    portfolioExecutionDiscIds,
    portfolioMemberDiscIds,
  ].filter((discIds) => discIds.length > 0)
  const normalized = projections.map((discIds) => [...new Set(discIds)].toSorted())
  const baseline = normalized[0]?.join('|') ?? ''
  return {
    references: [...new Set(projections.flat())],
    conflict: normalized.slice(1).some((discIds) => discIds.join('|') !== baseline),
  }
}

export function savedPlanHistoricalDiscRefs(plan: AccountPlanningDraft) {
  return savedPlanHistoricalDiscReferenceStatus(plan).references
}
