import type { StatKey } from '../domain/schemas'
import type { PlayerBuildSource } from './playerBuildSources'
import type { CandidateSetPlan } from './candidateSetPlans'

export type ReviewedTeamAgentState = {
  potentialImage?: number | null
  /** Observed account state. Unknown is never projected to M0. */
  mindscape?: number | null
}

/**
 * Context deliberately contains only the facts needed to evaluate a source
 * condition.  It is not an account import and does not infer an unknown team.
 */
export type ReviewedTeamDiscConditionContext = {
  memberIds?: readonly string[]
  agentStateById?: Readonly<Record<string, ReviewedTeamAgentState>>
  selectedDirectionIdByAgentId?: Readonly<Record<string, string>>
}

export type ReviewedTeamDiscDirection = {
  id: string
  agentId: string
  /** Every member set is an exact, order-independent reviewed trio. */
  exactMemberSets: readonly (readonly [string, string, string])[]
  requiredMemberIds?: readonly string[]
  retainBasePlans?: boolean
  additionalSources?: PlayerBuildSource[]
  teamCondition?: 'aria' | 'other-anomaly-support' | 'direct-damage' | 'anomaly-damage'
  mainStats?: Partial<Record<'4' | '5' | '6', StatKey[]>>
  subStatWeights?: Partial<Record<StatKey, number>>
  subStatCandidates?: readonly StatKey[]
  targetPanelPolicy?: 'omit_base_reference'
  mindscapeRangeByAgentId?: Readonly<Record<string, { minimum: number; maximum: number }>>
  requiresExplicitSelection?: boolean
  /** A named, limited numerical goal for this exact source branch. */
  objective?: 'declared_luminize_static_volley32'
  potentialMinimumByAgentId: Readonly<Record<string, number>>
  setPlan: CandidateSetPlan
  source: {
    postId: string
    url: string
    contentHash: string
    bodyHash: string
    sourceVersion: string | null
    targetVersion: '3.1' | '3.2'
    authorVersion?: string
    localReviewVersion?: '3.2'
    localReviewedAt?: string
    localReviewScope?: string
    secondaryEvidence?: readonly {
      url: string
      contentHash: string
      sourceVersion: string
      locator: string
    }[]
    locator: {
      kind: 'structured_text_span' | 'archived_image_region'
      text: string
    }
  }
  boundary: string
}

export type AppliedReviewedTeamDiscDirection = Pick<
  ReviewedTeamDiscDirection,
  | 'id'
  | 'agentId'
  | 'setPlan'
  | 'source'
  | 'boundary'
  | 'mainStats'
  | 'subStatWeights'
  | 'subStatCandidates'
  | 'targetPanelPolicy'
  | 'objective'
  | 'additionalSources'
  | 'retainBasePlans'
> & {
  exactMemberIds: [string, string, string]
  potentialMinimumByAgentId: Record<string, number>
  effectivePotentialByAgentId: Record<string, number>
  effectiveMindscapeByAgentId: Record<string, number | null>
}
