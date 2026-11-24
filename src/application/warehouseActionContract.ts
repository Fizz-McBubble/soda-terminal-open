import type { AccountDecisionSnapshot } from '../decision/accountDecisionService'
import type {
  WarehouseAbsoluteRetentionEvidence,
  WarehouseAnalysisSnapshot,
  WarehouseDiscDecision,
} from '../warehouse/discWarehouseEvidence'
import type { WarehouseRetentionBasis } from './warehouseRetention'
import type { WarehouseDevelopmentAdvice } from './warehouseDevelopmentPresentation'

/** Serializable warehouse directions returned with an account decision run. */
export type WarehouseActionKind = 'keep' | 'enhance' | 'cleanup'
export type WarehouseActionStatus =
  | 'favorite'
  | 'currently_equipped'
  | 'active_plan_reference'
  | 'saved_plan_reference'
  | 'selected_portfolio_reference'
  | 'better_alternative'
  | 'needs_review'
  | 'stale'
export type WarehouseActionRecommendationState = 'current' | 'needs_review' | 'stale'
export type WarehouseActionRecommendationBasis =
  | 'absolute_quality'
  | 'explicit_protection'
  | 'recorded_use'
  | 'evidence_review'
  | 'unresolved'
export type WarehouseActionFreshnessReason =
  | 'current_snapshot'
  | 'account_changed'
  | 'analysis_rule_changed'

export type WarehouseActionFinalRecommendation = {
  action: WarehouseActionKind
  state: Exclude<WarehouseActionRecommendationState, 'stale'>
  basis: WarehouseActionRecommendationBasis
}

export type WarehouseActionNextStep = {
  kind:
    | 'keep'
    | 'try_upgrade'
    | 'review_quality'
    | 'check_condition'
    | 'complete_data'
    | 'manual_cleanup'
    | 'reanalyze'
  targetLevel: number | null
  detail: string
  stopWhen?: string
}

export type WarehouseActionFreshness = {
  state: 'current' | 'stale'
  reason: WarehouseActionFreshnessReason
}

export type WarehouseActionUsageEvidence = {
  /** Missing use rows mean "not recorded", never "recorded as unused". */
  state: 'recorded' | 'not_recorded'
  agentIds: string[]
  planIds: string[]
}

export type WarehouseActionEvidenceState = 'complete' | 'partial' | 'needs_review' | 'stale'

export type WarehouseActionItem = {
  disc: { id: string; setId: string; slot: number; level: number; mainStat: string }
  /**
   * Legacy presentation fallback. Current authority and the player-facing
   * direction live in `finalRecommendation`; a stale item has no current action.
   */
  action: WarehouseActionKind
  absoluteRetention?: WarehouseAbsoluteRetentionEvidence
  /** Typed producer proof, forwarded without recomputing cleanup gates in the projection. */
  cleanupAssessment?: WarehouseDiscDecision['cleanupSafety']
  retentionBasis?: WarehouseRetentionBasis
  retentionReview?: 'low_effective_rolls'
  reviewBasis?: 'no_current_fit'
  recommendationState: WarehouseActionRecommendationState
  finalRecommendation?: WarehouseActionFinalRecommendation | null
  nextStep?: WarehouseActionNextStep
  evidenceState?: WarehouseActionEvidenceState
  freshness?: WarehouseActionFreshness
  decisiveProfileIds?: string[]
  /** Complete compatible profile evidence; presentation may summarize but must not rewrite it. */
  profileEvidence?: WarehouseAbsoluteRetentionEvidence['leadingUses']
  usage?: WarehouseActionUsageEvidence
  reasons: string[]
  statuses: WarehouseActionStatus[]
  compatibleAgentIds: string[]
  retentionAgentIds?: string[]
  usageAgentIds: string[]
  affectedAgentIds: string[]
  affectedPlans: Array<{
    id: string
    name: string
    memberIds?: string[]
    state: 'draft' | 'saved'
    active: boolean
  }>
  affectedTeams: Array<{
    /** Stable saved-plan key. Older projections only carried the solver candidate. */
    planId?: string
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
  cleanup: '清理候选',
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
      // Keep the legacy CSS/filter fallback, but expose no current direction.
      action: 'keep',
      retentionBasis: undefined,
      recommendationState: 'stale',
      finalRecommendation: null,
      evidenceState: 'stale',
      nextStep: {
        kind: 'reanalyze',
        targetLevel: null,
        detail: '账户或分析版本已变化；先重新分析，旧方向不能作为当前建议执行。',
        stopWhen: '重新分析完成前暂停清理和投入决定。',
      },
      freshness:
        item.freshness?.state === 'stale'
          ? item.freshness
          : { state: 'stale', reason: 'account_changed' },
      statuses: item.statuses.includes('stale') ? item.statuses : [...item.statuses, 'stale'],
      retentionAgentIds: [],
      developmentAlternativeIds: [],
      developmentAdvice: undefined,
      affectedTeams: item.affectedTeams.map((team) => ({ ...team, decisionAuthority: null })),
    }),
  )
  return {
    ...captured,
    state: 'stale',
    counts: { keep: 0, enhance: 0, cleanup: 0 },
    actions,
  }
}
