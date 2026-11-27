import type {
  CommonAnomalySettlement32Query,
  PlanningBenchmark32Query,
  ReviewedIncrementalEvent32Query,
  AccountDecisionQuery,
  DecisionPortfolioQuery,
  DevelopmentCandidateAlternativesQuery,
  DevelopmentWorkbenchRouteQuery,
  DevelopmentWorkbenchFactsQuery,
  DevelopmentDirectoryFactsQuery,
  SavedTeamPlanReplayQuery,
  SavedTeamSolutionComponentsQuery,
  TargetTeamWarehouseFitQuery,
  TeamOverviewPresentationQuery,
  TeamRoutePresentationQuery,
  WarehouseDiscTransitionUsesQuery,
  WarehouseActionsQuery,
} from './calculationQueryContract'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type {
  OpenPersonalDevelopmentQuery,
  PersonalDevelopmentCandidatesQuery,
  PersonalDevelopmentRouteQuery,
} from './publicPersonalDevelopment'

export const browserCalculationQueryProtocolVersion = 'soda-browser-calculation-query/v8' as const

export type BrowserCalculationQuery =
  | CommonAnomalySettlement32Query
  | PlanningBenchmark32Query
  | ReviewedIncrementalEvent32Query
  | AccountDecisionQuery
  | DecisionPortfolioQuery
  | TargetTeamWarehouseFitQuery
  | TeamOverviewPresentationQuery
  | TeamRoutePresentationQuery
  | SavedTeamPlanReplayQuery
  | SavedTeamSolutionComponentsQuery
  | DevelopmentCandidateAlternativesQuery
  | DevelopmentWorkbenchRouteQuery
  | DevelopmentWorkbenchFactsQuery
  | DevelopmentDirectoryFactsQuery
  | OpenPersonalDevelopmentQuery
  | PersonalDevelopmentCandidatesQuery
  | PersonalDevelopmentRouteQuery
  | WarehouseDiscTransitionUsesQuery
  | WarehouseActionsQuery

export type BrowserCalculationQueryRequest =
  | {
      protocolVersion: typeof browserCalculationQueryProtocolVersion
      kind: 'query'
      requestId: number
      runtime: Extract<CurrentGameDataRuntimeSelection, { status: 'compiled_current' }>
      query: BrowserCalculationQuery
      resultProjection?: 'local' | 'public-development'
    }
  | {
      protocolVersion: typeof browserCalculationQueryProtocolVersion
      kind: 'release'
      runId: string
    }
  | {
      protocolVersion: typeof browserCalculationQueryProtocolVersion
      kind: 'release_personal'
      sessionId: string
    }
  | {
      protocolVersion: typeof browserCalculationQueryProtocolVersion
      kind: 'prepare_account_decision'
    }

export type BrowserCalculationQueryResponse = {
  protocolVersion: typeof browserCalculationQueryProtocolVersion
  requestId: number
  status: 'ready' | 'succeeded' | 'failed'
  result?: unknown
  error?: string
}
