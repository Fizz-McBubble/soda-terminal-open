import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type {
  AccountDecisionSnapshot,
  DecisionClaimStatus,
} from '../decision/accountDecisionService'
import type { TeamExecutionPortfolio } from '../decision/teamExecutionProjection'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'

export const calculationQueryContractVersion = 'soda-calculation-query/v2' as const
export type { AccountDecisionSnapshot, DecisionClaimStatus }

export type AccountDecisionQueryInput = {
  warehouse: CoreWarehouse
  drafts: AccountPlanningDraft[]
  activePlanIds: Record<string, string | null | undefined>
  developmentPriorityAgentIds: string[]
  preference: TeamPortfolioPreference
}

export type AccountDecisionRun = {
  runId: string
  capturedAt: string
  /**
   * Public transport facts. Both clients fill them, so page code never has to read `snapshot`:
   * the browser transport deliberately omits `snapshot` (and the captured `input` is restored
   * locally by the remote client), leaving only display/validation fields on the wire.
   */
  inputFingerprint: string
  claimStatus: DecisionClaimStatus
  decisionAuthority: AccountDecisionAuthoritySummary
  /** Desktop and in-process runs keep the captured input; the browser restores its own copy. */
  input: AccountDecisionQueryInput
  /** Private capture. Absent on the browser transport — never read it from page code. */
  snapshot: AccountDecisionSnapshot
  /** Server-produced read-only warehouse display projection; absent on older stored fixtures. */
  warehouseActions?: import('./warehouseActionContract').WarehouseActionProjection
  /** Server-produced display decisions; absent on older stored fixtures. */
  developmentDirectory?: import('./publicDevelopmentDirectoryContract').DevelopmentDirectoryProjection
  /** Private producer's captured equipment directions for the development workbench. */
  developmentWorkbenchPresentation?: import('./publicDevelopmentWorkbenchPresentation').DevelopmentWorkbenchPresentation
  /** Private producer's current BOX view; absent on older Query responses. */
  teamPresentation?: import('../pages/teamLoadoutPresentationDto').TeamOverviewPresentationDto
}

/** Display/validation subset of the decision authority that the browser transport carries. */
export type AccountDecisionAuthoritySummary = {
  status: AccountDecisionSnapshot['decisionAuthority']['status']
  recommendationCount: number
  blockers: string[]
}

export type AccountDecisionQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'account_decision'
  runId: string
  capturedAt: string
  input: AccountDecisionQueryInput
}

export type DecisionPortfolioQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'decision_portfolio'
  runId: string
  teamCount: number
  lockedTemplateIds: string[]
  equipmentParametersByCandidateId?: Record<string, TargetTeamEquipmentParameterSelection>
}

export type DecisionPortfolioQueryResult = {
  buildIntent: import('../decision/buildIntent').PortfolioJointBuildIntent
  warehousePlan: CandidateWarehousePlan
  coordination: ReturnType<
    typeof import('../decision/accountDecisionCoordination').coordinateDecisionPortfolio
  >
  executionPortfolio: TeamExecutionPortfolio
}

export type TargetTeamWarehouseFitQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'target_team_warehouse_fit'
  runId: string
  candidateId: string
  equipmentParameters?: TargetTeamEquipmentParameterSelection
  /** Private producer resolves a player-confirmed Bangboo into the exact equipment parameters. */
  playerBangbooSelection?: {
    teamKey: string
    bangbooId: string
    bangbooStars: 1 | 2 | 3 | 4 | 5
  }
}

export type TargetTeamEquipmentParameterSelection =
  import('../decision/targetTeamAccountBoundBenchmark').TargetTeamEquipmentParameterSelection

export type TeamOverviewPresentationQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'team_overview_presentation'
  runId: string
  context: { agentId: string | null; planId: string | null; discId: string | null }
  /** A detached remaining-BOX run is bound to its still-live source run and reservations. */
  sourceRunId?: string
  reservedPlanIds?: string[]
  /** Exact fit results already calculated for this run; order mirrors the visible session. */
  fitCandidateIds?: string[]
}

export type TeamRoutePresentationQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'team_route_presentation'
  runId: string
  candidateId: string
}

export type SavedTeamPlanReplayQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'saved_team_plan_replay'
  runId: string
  planId: string
  planHash: string
}

export type SavedTeamSolutionComponentsQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'saved_team_solution_components'
  runId: string
  currentInput: AccountDecisionQueryInput
}

export type TargetTeamWarehouseFitQueryResult =
  import('../decision/targetTeamWarehouseFit').TargetTeamWarehouseFit & {
    /** Only reviewed exact teams can seed the current recommended multi-team journey. */
    portfolioContinuationEligible?: boolean
    /**
     * The normalized input used by this exact calculation. Null intentionally means that
     * the result cannot be saved or restored as the same equipment-parameter identity.
     */
    effectiveEquipmentParameters:
      | import('../decision/targetTeamEquipmentParameters').EffectiveTargetTeamEquipmentParameters
      | null
    targetExecution: import('../decision/teamExecutionProjection').TeamExecution
    /** Private producer's exact 18-disc view; absent on older Query responses. */
    teamExecutionPresentation?: import('../pages/teamLoadoutPresentationDto').TeamExecutionPresentationDto
    accountBoundBenchmark: import('../decision/targetTeamAccountBoundBenchmark').TargetTeamAccountBoundBenchmark
    cultivationRefinement: ReturnType<
      typeof import('../decision/accountDecisionAuthority').refineCultivationPriorityWithTargetFit
    >
    valueBenchmark: import('../calculation/valueBenchmarkComparison').ValueBenchmarkComparison
  }

export type DevelopmentCandidateAlternativesQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'development_candidate_alternatives'
  runId: string
  agentId: string
}

export type DevelopmentWorkbenchRouteQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'development_workbench_route'
  runId: string
  selection: import('./publicDevelopmentWorkbenchRoute').DevelopmentWorkbenchRouteSelection
}

export type DevelopmentCandidateAlternativesQueryResult = {
  contract: 'soda-development-candidate-alternatives/v1'
  runId: string
  capturedAt: string
  inputFingerprint: string
  accountId: string
  agentId: string
  status: 'ready' | 'unavailable'
  sideEffect: 'read_only'
  buildIntent: import('../decision/buildIntent').AgentIndependentBuildIntent
  baseline: DriveDisc[]
  candidates: CandidateWarehousePlan[]
  /** Added in Value Benchmark V1; older session snapshots may not contain it. */
  valueBenchmarks?: import('../calculation/valueBenchmarkComparison').ValueBenchmarkComparison[]
  gaps: string[]
  /** Private Query display directions, bound to this captured candidate result. */
  presentation?: ReturnType<
    typeof import('./developmentCandidatePresentation').projectDevelopmentCandidatePresentation
  >
  /** Private Query panel facts for the exact baseline, candidates and saved plans. */
  panelPresentation?: import('./publicDevelopmentComparisonPanels').DevelopmentComparisonPanels
}

export type WarehouseDiscTransitionUsesQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'warehouse_disc_transition_uses'
  runId: string
  discId: string
}
export type WarehouseDiscTransitionUsesResult = {
  runId: string
  inputFingerprint: string
  discId: string
  accountId: string
  sideEffect: 'read_only'
  checkedAgentCount: number
  uses: import('../decision/warehouseDiscTransitionUses').WarehouseDiscTransitionUse[]
}

/**
 * The UI only knows this asynchronous, serializable query boundary. The current implementation
 * executes in-process; a future Remote/API client can implement the same interface without
 * changing page components or moving browser/storage concerns into Core.
 */
export interface CalculationQueryClient {
  /** Release a transient query handle; saved plans carry their own snapshots. */
  releaseAccountDecisionRun?(runId: string): void
  /** Synchronous server-side liveness check after bounded run eviction. */
  hasAccountDecisionRun?(runId: string): boolean
  /** Observe transient handle invalidation without changing the serialized Query contract. */
  subscribeAccountDecisionRuns?(listener: () => void): () => void
  /** Abort active work for a completed run; its captured input remains available for replay. */
  cancelActiveQuery?(runId: string): void
  fingerprintAccountDecisionInput(input: AccountDecisionQueryInput, currentRunId?: string): string
  calculateAccountDecision(query: AccountDecisionQuery): Promise<AccountDecisionRun>
  queryDecisionPortfolio(query: DecisionPortfolioQuery): Promise<DecisionPortfolioQueryResult>
  calculateTargetTeamWarehouseFit(
    query: TargetTeamWarehouseFitQuery,
  ): Promise<TargetTeamWarehouseFitQueryResult>
  queryTeamOverviewPresentation(
    query: TeamOverviewPresentationQuery,
    /** Worker transport only; never accepted from a browser request. */
    internal?: { sourceRun?: Pick<AccountDecisionRun, 'runId' | 'input'> },
  ): Promise<import('../pages/teamLoadoutPresentationDto').TeamOverviewPresentationDto>
  queryTeamRoutePresentation(
    query: TeamRoutePresentationQuery,
  ): Promise<import('../pages/publicTeamRoutePresentation').TeamRoutePresentation>
  querySavedTeamPlanReplay(
    query: SavedTeamPlanReplayQuery,
  ): Promise<import('./publicSavedTeamReplay').SavedTeamReplayPresentation>
  querySavedTeamSolutionComponents(
    query: SavedTeamSolutionComponentsQuery,
  ): Promise<import('./publicSavedTeamSolutionComponents').SavedTeamSolutionComponents>
  queryDevelopmentCandidateAlternatives(
    query: DevelopmentCandidateAlternativesQuery,
  ): Promise<DevelopmentCandidateAlternativesQueryResult>
  queryDevelopmentWorkbenchRoute(
    query: DevelopmentWorkbenchRouteQuery,
  ): Promise<import('./publicDevelopmentWorkbenchRoute').DevelopmentWorkbenchRoutePresentation>
  queryWarehouseDiscTransitionUses?(
    query: WarehouseDiscTransitionUsesQuery,
    options?: { signal?: AbortSignal },
  ): Promise<WarehouseDiscTransitionUsesResult>
}
