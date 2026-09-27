import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  enumerateActiveTeamHardConstraints,
  TeamPortfolioPreference,
} from '../accounts/teamPortfolioPreference'
import type { AgentDiscProfile } from '../assault/engine'
import type { BoxNumericDecision } from '../calculation/boxNumericDecision'
import { currentDataAuthorityProjection } from '../gameDataPacks/currentDataAuthorityProjection'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import type { ActiveMemberPlan, coordinateMatchedTeams } from '../optimizer/multiTeamCoordinator'
import type {
  AccountBuildResult,
  AccountOptimizerOptions,
} from '../optimizer/optimizeAccountBuilds'
import type { WarehouseAnalysisSnapshot } from '../warehouse/discWarehouseAnalysis'
import type { TeamEngineResult } from '../teamEngine/contracts'
import type { TeamEngineCoverageDiagnostics } from '../teamEngine/coverageDiagnostics'
import type { teamEngineRecommendationsForCoordinationWithDiagnostics } from './teamEngineDecisionAdapter'
import type { PlanningCandidateEvaluationAssembly } from './planningCandidateEvaluationAssembler'
import type { PlanningCandidateEvaluationAuthority } from './planningCandidateEvaluationAuthority'
import type { TeamExecution, TeamExecutionPortfolio } from './teamExecutionProjection'
import type { scoreCurrent31ExhaustiveAccountCandidates } from './exhaustiveAccountCandidateScoring'
import type { projectAccountDecisionAuthority } from './accountDecisionAuthority'
import type { AccountDecisionFingerprint } from './accountDecisionFingerprint'

export const accountDecisionContractVersion = 'soda-account-decision-service/v1' as const
export const accountDecisionRevision = 'pc4-shared-decision-world-r1' as const

export type DecisionClaimStatus = 'formal' | 'candidate' | 'limited' | 'unsupported'

export type DecisionClaim = {
  status: DecisionClaimStatus
  summary: string
  allows: string[]
  forbids: string[]
  blockers: string[]
}

export type AccountDecisionSnapshot = {
  contractVersion: typeof accountDecisionContractVersion
  revision: typeof accountDecisionRevision
  sideEffect: 'read_only'
  account: {
    accountId: string
    warehouseDiscCount: number
    warehouseHash: string
    rosterHash: string
  }
  data: {
    gameVersion: typeof currentVersionProjection.gameVersion
    packageId: typeof currentVersionProjection.packageId
    packageVersion: typeof currentVersionProjection.packageVersion
    lifecycle: typeof currentVersionProjection.lifecycle
    fieldBoundary: typeof currentVersionProjection.fieldBoundary
    authorityId: typeof currentDataAuthorityProjection.authorityId
  }
  fingerprint: AccountDecisionFingerprint
  warehouse: WarehouseAnalysisSnapshot
  allocation: AccountBuildResult
  teamEngine: TeamEngineResult
  teamEngineCoverage: TeamEngineCoverageDiagnostics
  coordination: ReturnType<typeof coordinateMatchedTeams>
  coordinationByTeamCount: Record<1 | 2 | 3, ReturnType<typeof coordinateMatchedTeams>>
  teamExecutions: TeamExecution[]
  teamExecutionPortfoliosByTeamCount: Record<1 | 2 | 3, TeamExecutionPortfolio>
  planningDpsAssembly: PlanningCandidateEvaluationAssembly[]
  boxNumericDecision: BoxNumericDecision
  candidateUniverseCoverage: {
    legalAgentFormationCount: number
    formationBangbooCandidateCount: number
    normalizedScoredFormationCount: number
    normalizedScoredFormationBangbooCandidateCount: number
    exhaustiveAccountFormationCount: number
    exhaustiveEvaluatedFormationBangbooCandidateCount: number
    exhaustiveScoredFormationBangbooCandidateCount: number
    sourceBackedBangbooRecommendationCount: number
    exhaustiveUnsupportedBangbooCandidateCount: number
    exhaustiveBangbooBlockerCounts: Record<string, number>
    exhaustiveDecisionIssueClassification: ReturnType<
      typeof scoreCurrent31ExhaustiveAccountCandidates
    >['coverage']['decisionIssueClassification']
    mechanicClosedAtBaseCount: number
    limitedButNotPrunedCount: number
    curatedProductionCandidateCount: number
    accountBoundProductionCandidateCount: number
    status:
      | 'source_backed_asset_bound_complete_authority_reopened'
      | 'reopened_missing_asset_bindings'
    boundary: string
  }
  exhaustiveCandidateScoring: {
    coverage: ReturnType<typeof scoreCurrent31ExhaustiveAccountCandidates>['coverage']
    topRankedFormations: ReturnType<
      typeof scoreCurrent31ExhaustiveAccountCandidates
    >['rankedFormations']
    fingerprint: string
    boundary: string
  }
  decisionAuthority: ReturnType<typeof projectAccountDecisionAuthority>
  hardConstraints: {
    active: ReturnType<typeof enumerateActiveTeamHardConstraints>
    canRestoreDefault: boolean
  }
  portfolioInput: {
    candidates: ReturnType<
      typeof teamEngineRecommendationsForCoordinationWithDiagnostics
    >['candidates']
    activePlansByAgent: Record<string, ActiveMemberPlan>
    /** Directory favorites / development priorities consumed by the sole Team Engine input. */
    preferredAgentIds: string[]
    preference: TeamPortfolioPreference
  }
  claims: {
    overall: DecisionClaim
    data: DecisionClaim
    warehouse: DecisionClaim
    allocation: DecisionClaim
    teamEngine: DecisionClaim
    coordination: DecisionClaim
    formalDamage: DecisionClaim
    planningDps: DecisionClaim
  }
  explanation: {
    ownedAgentCount: number
    calculableAgentCount: number
    profileCoverageGapCount: number
    scheduledAgentCount: number
    unavailableAgentCount: number
    physicalDiscReferenceCount: number
    uniquePhysicalDiscReferenceCount: number
    warehouseCoverageComplete: boolean
    planningDpsReadyAgentCount: number
    planningDpsReadyAgentIds: string[]
  }
}

export type BuildAccountDecisionInput = {
  warehouse: CoreWarehouse
  profiles?: AgentDiscProfile[]
  drafts: AccountPlanningDraft[]
  activePlanIds: Readonly<Record<string, string | null | undefined>>
  developmentPriorityAgentIds?: readonly string[]
  preference: TeamPortfolioPreference
  optimizerOptions?: AccountOptimizerOptions
  capturedAt?: string
  planningDpsEvaluations?: readonly unknown[]
  planningCandidateAuthorities?: Readonly<
    Record<string, PlanningCandidateEvaluationAuthority | undefined>
  >
}
