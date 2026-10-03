import type { DecisionClaimStatus } from '../application/calculationQueryContract'
import type { ReviewedTeamAnalysis } from '../decision/reviewedTeamAnalysis'
import type { TeamExecutionPlayerStatus } from './teamExecutionPresentation'
import type { TeamLoadoutCompletionCandidate } from './teamLoadoutCompletionCandidates'

export type TeamLoadoutOverviewKind = 'saved' | 'buildable' | 'progress' | 'direction'
export type TeamLoadoutOverviewGroupKind = 'recommended' | 'development' | 'saved'

export type TeamLoadoutVisibleAnswer = {
  status: DecisionClaimStatus
  title: string
  summary: string
  blockers: string[]
  boundary: string
  fingerprint: string
}

export type TeamLoadoutOverviewItem = {
  id: string
  candidateId: string | null
  detailCandidateId: string | null
  kind: TeamLoadoutOverviewKind
  familyKey: string
  title: string
  agentIds: string[]
  deploymentOrder?: import('../decision/teamDeployment').TeamDeploymentOrder
  coreAgentIds: string[]
  mechanism: string
  bangbooId: string | null
  bangbooLabel: string
  bangbooReason?: string | null
  bangbooAlternativeIds?: readonly string[]
  bangbooSuggestions?: Array<{
    bangbooId: string
    defaultStars: number
    recommendationReason: string
  }>
  stateLabel: string
  reason: string
  why: string
  readiness: string
  gaps: string[]
  advice: string
  boundary: string
  primaryLabel: string
  destination: string
  recommendationRank: number
  /** Reviewed source tie preference, calculated privately for this exact trio. */
  preferredOverMemberKeys?: string[]
  executionStatus: TeamExecutionPlayerStatus | null
  primaryActions: string[]
  impacts: string[]
  bangbooAuthority: 'authoritative' | 'compatible' | 'unknown'
  /** Read-only explanation of a match with the directory's sole favorite/priority input. */
  favoriteMatchCount: number
  favoriteLabel: string | null
  favoriteReason: string | null
  planningDps: number | null
  planningDpsStatus: 'ready' | 'unsupported'
  cultivationPriority: 'ready_now' | 'short_upgrade' | 'strategic_build' | 'experimental' | null
  teamRatingBand: 'S+' | 'S' | 'A+' | 'A' | 'B' | 'Experimental' | null
  confidence: 'high' | 'medium' | 'low' | 'experimental' | null
  /** Exact-team local editorial analysis supplied by Decision Authority. */
  ratingAnalysis?: ReviewedTeamAnalysis | null
  /** Authority-owned recommendation index. It is not damage or a band conversion. */
  recommendationScore?: number | null
  graduationCompletion?:
    | import('../decision/savedTeamGraduationCompletion').SavedTeamGraduationCompletion
    | null
  /** Internal selection metadata; the player sees only grade and score. */
  inferredStrength?: boolean
  fallbackOnly?: boolean
  inferredPrimaryOutputAgentId?: string | null
  mechanicValidity: 'invalid' | 'partial' | 'valid' | 'excellent' | null
  combatEvidence?:
    | import('../decision/reviewedTeamCombatEvidence').ReviewedTeamCombatEvidence
    | null
  versionPosition: 'apex' | 'meta' | 'viable' | null
  referencePerformanceStatus: 'complete' | 'partial' | 'unavailable' | null
  calibrationStatus: 'aligned' | 'calibration_violation' | 'insufficient' | null
  outputPotentialBand: 'excellent' | 'good' | 'mixed' | 'weak' | null
  /** Dense rank: equal means no asserted Team Strength relation. */
  teamStrengthOrder: number | null
  /** Account-bound dense rank, intentionally separate from theoretical strength. */
  cultivationPriorityOrder: number | null
  authorityReasons: string[]
  authorityTradeoffs: string[]
  authorityNextAction: string | null
  /** A reviewed exact-three source confirms this direction, but not its strength band. */
  sourceConfirmed?: boolean
  /** Typed membership observation, exposed only by deliberate member search. */
  authorComparisonMembership?: import('../decision/reviewedAuthorComparisonMembership32').AuthorComparisonMembership32
  /** Named local finite model availability; deliberate search only, no strength claim. */
  hasPreparedBenchmark32?: boolean
  sourceConditions?: string[]
  sourceBangbooOptionIds?: string[]
  historicalReferenceOnly?: boolean
}

export type TeamLoadoutOverviewFamily = {
  id: string
  kind: TeamLoadoutOverviewKind
  title: string
  coreAgentIds: string[]
  mechanism: string
  stateLabel: string
  reason: string
  planningDps: number | null
  planningDpsStatus: 'ready' | 'unsupported'
  cultivationPriority: TeamLoadoutOverviewItem['cultivationPriority']
  teamRatingBand: TeamLoadoutOverviewItem['teamRatingBand']
  confidence: TeamLoadoutOverviewItem['confidence']
  outputPotentialBand: TeamLoadoutOverviewItem['outputPotentialBand']
  variants: TeamLoadoutOverviewItem[]
}

export type TeamLoadoutOverviewGroup = {
  kind: TeamLoadoutOverviewGroupKind
  label: string
  description: string
  items: TeamLoadoutOverviewFamily[]
  completionCandidates?: TeamLoadoutCompletionCandidate[]
}

export type TeamLoadoutOverviewModel = {
  answer: TeamLoadoutVisibleAnswer
  coverage: {
    available: boolean
    ownedAgentCount: number
    ownedAgentRuleCount: number
    ownedAgentRuleGapCount: number
    recommendationCount: number
    rejectedCount: number
    familyCount: number
    adapterDroppedCount: number
    numericCandidateCount: number
    numericLegalCandidateCount: number
  }
  groups: TeamLoadoutOverviewGroup[]
  initialSelectedId: string | null
  contextNote: string | null
}
