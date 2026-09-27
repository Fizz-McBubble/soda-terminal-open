import type {
  AccountDecisionQuery,
  DecisionPortfolioQuery,
  DevelopmentCandidateAlternativesQuery,
  DevelopmentWorkbenchRouteQuery,
  SavedTeamPlanReplayQuery,
  SavedTeamSolutionComponentsQuery,
  TargetTeamWarehouseFitQuery,
  TeamOverviewPresentationQuery,
  TeamRoutePresentationQuery,
  WarehouseDiscTransitionUsesQuery,
} from './calculationQueryContract'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'

export const browserCalculationQueryProtocolVersion = 'soda-browser-calculation-query/v2' as const

export type BrowserCalculationQuery =
  | AccountDecisionQuery
  | DecisionPortfolioQuery
  | TargetTeamWarehouseFitQuery
  | TeamOverviewPresentationQuery
  | TeamRoutePresentationQuery
  | SavedTeamPlanReplayQuery
  | SavedTeamSolutionComponentsQuery
  | DevelopmentCandidateAlternativesQuery
  | DevelopmentWorkbenchRouteQuery
  | WarehouseDiscTransitionUsesQuery

export type BrowserCalculationQueryRequest =
  | {
      protocolVersion: typeof browserCalculationQueryProtocolVersion
      kind: 'query'
      requestId: number
      runtime: Extract<CurrentGameDataRuntimeSelection, { status: 'compiled_current' }>
      query: BrowserCalculationQuery
    }
  | {
      protocolVersion: typeof browserCalculationQueryProtocolVersion
      kind: 'release'
      runId: string
    }

export type BrowserCalculationQueryResponse = {
  protocolVersion: typeof browserCalculationQueryProtocolVersion
  requestId: number
  status: 'ready' | 'succeeded' | 'failed'
  result?: unknown
  error?: string
}
