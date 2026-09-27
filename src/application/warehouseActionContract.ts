import type { AccountDecisionSnapshot } from '../decision/accountDecisionService'
import type { WarehouseAnalysisSnapshot } from '../warehouse/discWarehouseEvidence'
import type { WarehouseRetentionBasis } from './warehouseRetention'
import type { WarehouseDevelopmentAdvice } from './warehouseDevelopmentPresentation'

/** Serializable warehouse directions returned with an account decision run. */
export type WarehouseActionKind = 'keep' | 'enhance' | 'cleanup'
export type WarehouseActionStatus =
  | 'currently_equipped'
  | 'active_plan_reference'
  | 'saved_plan_reference'
  | 'selected_portfolio_reference'
  | 'better_alternative'
  | 'needs_review'
  | 'stale'
export type WarehouseActionRecommendationState = 'current' | 'needs_review' | 'stale'

export type WarehouseActionItem = {
  disc: { id: string; setId: string; slot: number; level: number; mainStat: string }
  action: WarehouseActionKind
  retentionBasis?: WarehouseRetentionBasis
  retentionReview?: 'low_effective_rolls'
  reviewBasis?: 'no_current_fit'
  recommendationState: WarehouseActionRecommendationState
  reasons: string[]
  statuses: WarehouseActionStatus[]
  compatibleAgentIds: string[]
  retentionAgentIds?: string[]
  usageAgentIds: string[]
  affectedAgentIds: string[]
  affectedPlans: Array<{ id: string; name: string; state: 'draft' | 'saved'; active: boolean }>
  affectedTeams: Array<{
    candidateId: string
    memberIds: [string, string, string]
    status: 'ready' | 'needs_confirmation' | 'missing_equipment'
    decisionAuthority: null | {
      teamRating: string
      confidence: string
      cultivationPriority: string
    }
  }>
  alternativeDiscIds: string[]
  developmentAlternativeIds?: string[]
  developmentAdvice?: WarehouseDevelopmentAdvice
}

export type WarehouseActionProjection = {
  runId: string
  fingerprint: string
  accountId: string
  state: 'current' | 'stale'
  sideEffect: 'read_only'
  claim: { status: AccountDecisionSnapshot['claims']['warehouse']['status']; summary: string }
  counts: Record<WarehouseActionKind, number>
  referenceIssues?: WarehouseAnalysisSnapshot['referenceIssues']
  actions: WarehouseActionItem[]
}

export const warehouseActionLabels: Record<WarehouseActionKind, string> = {
  keep: '建议保留',
  enhance: '继续观察',
  cleanup: '可考虑清理',
}

/** A changed local account never inherits a prior run's cleanup recommendation. */
export function displayWarehouseActionProjection(
  captured: WarehouseActionProjection | undefined,
  status: 'current' | 'stale',
): WarehouseActionProjection | null {
  if (!captured) return null
  if (status === 'current') return captured
  const actions = captured.actions.map(
    (item): WarehouseActionItem => ({
      ...item,
      action: 'keep',
      retentionBasis: 'unresolved',
      recommendationState: 'stale',
      statuses: item.statuses.includes('stale') ? item.statuses : [...item.statuses, 'stale'],
      retentionAgentIds: [],
      developmentAlternativeIds: [],
      developmentAdvice: undefined,
    }),
  )
  return {
    ...captured,
    state: 'stale',
    counts: { keep: actions.length, enhance: 0, cleanup: 0 },
    actions,
  }
}
