import type { WarehouseDiscDecision } from '../warehouse/discWarehouseAnalysis'

export type WarehouseRetentionBasis =
  | 'in_use'
  | 'account_fit'
  | 'other_agent_fit'
  | 'unique_class'
  | 'premium_reserve'
  | 'scarce_reserve'
  | 'unresolved'

/** An explanation of the captured decision, not another retention policy. */
export function warehouseRetentionBasis(
  decision: WarehouseDiscDecision,
  accountAgentIds: ReadonlySet<string>,
): WarehouseRetentionBasis {
  const safety = decision.cleanupSafety
  if (
    safety.equipped ||
    safety.activePlanReferenced ||
    safety.savedPlanReferenced ||
    safety.portfolioReferenced
  )
    return 'in_use'
  if (!safety.complete) return 'unresolved'
  if (decision.useAssessment?.basis === 'quality_reserve') return 'premium_reserve'
  if (decision.fitAgentIds.some((id) => accountAgentIds.has(id))) return 'account_fit'
  if (decision.fitAgentIds.length) return 'other_agent_fit'
  if (safety.rareUnique) return 'unique_class'
  if (safety.scarceReserve) return 'scarce_reserve'
  if (safety.premiumReserve) return 'premium_reserve'
  return 'unresolved'
}
