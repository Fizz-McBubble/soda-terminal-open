import type { StatKey } from '../domain/schemas'
import type { TargetPanelSemantics } from './targetPanelSemantics'
import type { PlayerBuildSource } from './playerBuildProfiles'
import type { CandidateSetPlan } from './candidateSetPlans'
import type { AppliedReviewedTeamDiscDirection } from './reviewedTeamDiscConditions'
import type { ReviewedMainStatAlternative } from './reviewedMainStatAlternatives'
import type { BuildApplicabilityIdentity } from './buildApplicabilityDependencyAnalysis'

export type CandidateWarehouseConstraint = {
  agentId: string
  agentName: string
  gameVersion: '3.0' | '3.1' | '3.2' | '3.3'
  status: 'candidate' | 'missing'
  setPlanReadiness:
    | {
        status: 'executable'
        pattern: CandidateSetPlan['pattern']
        primarySetIds: string[]
        secondarySetIds: string[]
      }
    | {
        status: 'non_executable'
        reason: 'missing_secondary_set' | 'unresolved_set_roles'
        missingEvidence: string
      }
  sources: PlayerBuildSource[]
  /** Source/reference continuity is separate from current author build review. */
  guidanceApplicability?: BuildApplicabilityIdentity[]
  setIds: string[]
  /** Explicit source branches; readiness is the first-branch compatibility projection. */
  setPlans?: CandidateSetPlan[]
  unresolvedSetDirections?: string[]
  mainStats: Partial<Record<'4' | '5' | '6', StatKey[]>>
  /** Explicit single-slot source intent; absent for default and historical candidates. */
  reviewedIndependentDirectionId?: string
  /** Sourced purpose-specific guidance; never flattened into automatic eligibility. */
  mainStatAlternatives?: ReviewedMainStatAlternative[]
  subStatWeights: Partial<Record<StatKey, number>>
  /** Frozen identity and goal of a source-reviewed exact-team branch. */
  reviewedTeamDirectionId?: string
  reviewedTeamDirectionSource?: AppliedReviewedTeamDiscDirection['source']
  reviewedTeamMindscapeByAgentId?: Record<string, number | null>
  /** Source-named candidates without fabricated numerical importance. */
  reviewedSubStatCandidates?: readonly StatKey[]
  targetPanelApplicability?: {
    disposition: 'base_reference_not_applicable'
    directionId: string
    reason: string
  }
  buildObjective?: AppliedReviewedTeamDiscDirection['objective']
  wEngineDirections: string[]
  teamAndBangbooPreconditions: string[]
  progressionDirection: string[]
  targetPanel?: {
    level: 60
    values: Partial<
      Record<
        'atk' | 'hp' | 'def' | 'critRate' | 'critDamage',
        number | { min: number; max?: number; upperOpen?: boolean }
      >
    >
    conditions: string[]
    sourceIds: string[]
    label: 'guide_reference_range'
    targetSemantics?: TargetPanelSemantics
  }
  gaps: string[]
  boundary: string
  contentHash: string
}

export const candidateBuildGuidanceFieldPaths = [
  'build.wengines',
  'build.drive_disc_sets',
  'build.main_sub_stats',
  'build.progression',
  'build.team_bangboo_scenario',
] as const
export type CandidateBuildGuidanceFieldPath = (typeof candidateBuildGuidanceFieldPaths)[number]

/** Frozen recommendation payload compiled into a solve-specific Build Intent. */
export type CandidateWarehouseRecommendation = {
  agentId: string
  constraint: CandidateWarehouseConstraint | null
}
