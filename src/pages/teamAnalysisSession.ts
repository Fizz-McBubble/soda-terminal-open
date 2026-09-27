// `import type` is fully erased; an inline `{ type X }` specifier survives as an empty side-effect
// import and would pull the account core-flow module (and the private evaluation modules behind it)
// into the public browser bundle.
import type { CoreWarehouse } from '../accounts/coreFlow'
import { type RemainingBoxReservation } from '../application/remainingBox'
import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { type TeamLoadoutOverviewUiState } from './TeamLoadoutOverview'
import { type TeamLoadoutOverviewModel } from './teamLoadoutOverviewTypes'
import type { TeamRoutePresentation } from './publicTeamRoutePresentation'

export type TeamAnalysisResult = {
  sourceRunId?: string
  reservations?: RemainingBoxReservation[]
  appSessionId: string
  analysisRunId: string
  warehouse: CoreWarehouse
  overviewModel: TeamLoadoutOverviewModel
  /** Exact-fit overlay from the private Query; base overview remains available for stale views. */
  fitOverviewModel?: TeamLoadoutOverviewModel
  presentationContext?: { agentId: string | null; planId: string | null; discId: string | null }
  decisionSnapshot: AccountDecisionSnapshot
  capturedAt: Date
  inputFingerprint: string
  targetTeamFits: Record<string, TargetTeamWarehouseFitQueryResult>
  teamRoutePresentations?: Record<string, TeamRoutePresentation>
  overviewUiState?: TeamLoadoutOverviewUiState
}

export type TeamAnalysisState =
  | { kind: 'ready' }
  | { kind: 'running'; stage: number }
  | { kind: 'complete'; result: TeamAnalysisResult }
  | { kind: 'stale'; result: TeamAnalysisResult }
  | { kind: 'unable'; reason: 'no_account' | 'empty_warehouse' }
  | { kind: 'error'; stage: number; message?: string }

export type TeamAnalysisSnapshot = {
  accountName: string
  ownedAgentCount: number
  discCount: number
  capturedAt: Date
}

export type LastCompleteAnalysis = Extract<TeamAnalysisState, { kind: 'complete' | 'stale' }>

export let currentTeamAnalysisSession: LastCompleteAnalysis | null = null

export function setCurrentTeamAnalysisSession(value: LastCompleteAnalysis | null) {
  currentTeamAnalysisSession = value
}
