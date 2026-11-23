import { resolveReviewedBuildFieldContinuity33 } from './reviewedBuildFieldContinuity33'
import { type AgentProfileField } from './agentProfile'
import { type ReviewedTargetContext } from './reviewedContextualTargetPanel'
import { reviewedBuildFieldReferenceContinuity32 } from './reviewedReferenceSupportContinuity32'
import { type ReviewedTeamDiscConditionContext } from './reviewedTeamDiscConditions'
import type { CandidateSetPlanEligibilityContext } from './candidateSetPlanEligibility'

export const currentBuildFieldIds = [
  'progression.lv60_and_ascension',
  'progression.skill_core_cinema',
  'progression.potential_overlay',
  'build.wengines',
  'build.drive_disc_sets',
  'build.main_sub_stats',
  'build.progression',
  'build.team_bangboo_scenario',
  'build.target_panel',
  'build.version_change_impact',
] as const
export type CurrentBuildFieldId = (typeof currentBuildFieldIds)[number]

export const currentCalculationAccountFieldIds = [
  'account.agent.level_ascension',
  'account.agent.skill_core_cinema',
  'account.agent.potential_overlay',
  'account.wengine.instance',
  'account.drive_disc.instances',
  'account.final_stats',
] as const

export type CurrentBuildFieldState = 'ready' | 'missing' | 'stale' | 'conflict' | 'not_applicable'

export type CurrentBuildAuthoritySourceTier =
  | 'direct_current_3_2'
  | 'direct_current_3_3'
  | 'continuity_reviewed'
  | 'not_applicable'
  | 'incomplete'

export type CurrentBuildAuthorityField = {
  fieldId: CurrentBuildFieldId
  lane: 'guidance'
  state: CurrentBuildFieldState
  /**
   * Provenance tier, not a strength or accuracy claim.
   * Ready fields are split between a direct current-version source and the
   * explicitly bounded 3.1 -> 3.2 continuity review.
   */
  sourceTier: CurrentBuildAuthoritySourceTier
  derivation?: 'rederived_current'
  sourceStatus: AgentProfileField['status'] | 'missing'
  value: unknown | null
  sourceRefs: ReadonlyArray<{
    id: string
    sourceVersion: string | null
    evaluatedForVersion: string | null
    checkedAt: string | null
    contentHash: string | null
    supportedValues?: readonly string[]
    conditionsByValue?: Readonly<Record<string, readonly string[]>>
  }>
  blockers: readonly string[]
  conditions: readonly string[]
  teamReferences?: readonly {
    id: string
    memberIds: readonly string[]
    members: string
    condition: string
    sources: readonly import('./playerBuildSources').PlayerBuildSource[]
  }[]
  wEngineReference?: {
    id: string
    engineId: string
    previousEngineId: string
    refinement: 1
    note: string
    sources: readonly import('./playerBuildSources').PlayerBuildSource[]
  }
  /** A current field review replaces the historical recommendation ordering. */
  currentReviewDisposition?: 'replaced'
  referenceContinuity?:
    | NonNullable<ReturnType<typeof reviewedBuildFieldReferenceContinuity32>>
    | NonNullable<ReturnType<typeof resolveReviewedBuildFieldContinuity33>>
  /** A selected, already reviewed branch; never part of context-free coverage. */
  contextualApplicability?: { directionId: string; constraintContentHash: string }
  nextEvidence: readonly string[]
}

export type CurrentCalculationAccountField = {
  fieldId: (typeof currentCalculationAccountFieldIds)[number]
  lane: 'calculation_account_snapshot'
  state: 'account_required'
  value: null
  reason: string
}

export type CurrentBuildTargetPanelContext = Omit<ReviewedTargetContext, 'agentId'> &
  ReviewedTeamDiscConditionContext &
  CandidateSetPlanEligibilityContext
