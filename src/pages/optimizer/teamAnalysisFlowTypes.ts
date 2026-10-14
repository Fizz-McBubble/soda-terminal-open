import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type {
  useAccountDecisionWorld,
  useDetachedAccountDecisionCalculation,
  useReleaseAccountDecisionRun,
  useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import type { TargetTeamWarehouseFitQueryResult } from '../../application/calculationQueryContract'
import type { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import type {
  LastCompleteAnalysis,
  TeamAnalysisResult,
  TeamAnalysisSnapshot,
  TeamAnalysisState,
} from '../teamAnalysisSession'
import type { useTeamPickerQueries } from './useTeamPickerQueries'

export interface UseTeamAnalysisFlowOptions {
  accountSummary: ReturnType<typeof useF5AccountSummary>
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  reservedPlanIds: string[]
  contextAgentId: string | null
  contextPlanId: string | null
  contextDiscId: string | null
  rematchRequest: MutableRefObject<{ planId: string | null; teamId: string | null } | null>
  analysis: TeamAnalysisState
  setAnalysis: Dispatch<SetStateAction<TeamAnalysisState>>
  lastCompleteAnalysis: LastCompleteAnalysis | null
  setLastCompleteAnalysis: Dispatch<SetStateAction<LastCompleteAnalysis | null>>
  setAnalysisSnapshot: Dispatch<SetStateAction<TeamAnalysisSnapshot | null>>
  setRequestedSelectedId: Dispatch<SetStateAction<string | null>>
  setRemainingBoxError: Dispatch<SetStateAction<string | null>>
  setRemainingBoxOpen: Dispatch<SetStateAction<boolean>>
  setOverviewFeedback: Dispatch<SetStateAction<string | null>>
  setPreparingItemId: Dispatch<SetStateAction<string | null>>
  setPreparationError: Dispatch<
    SetStateAction<{ runId: string; itemId: string; message: string } | null>
  >
  analysisRequest: MutableRefObject<number>
  remainingRequest: MutableRefObject<number>
  remainingRunning: MutableRefObject<boolean>
  prepareRequest: MutableRefObject<number>
  identityForRun: ReturnType<typeof useTeamPickerQueries>['identityForRun']
  queryTeamOverview: ReturnType<typeof useTeamPickerQueries>['queryTeamOverview']
  queryTeamRoute: ReturnType<typeof useTeamPickerQueries>['queryTeamRoute']
  querySavedReplay: ReturnType<typeof useTeamPickerQueries>['querySavedReplay']
  queueFitOverview: (
    result: TeamAnalysisResult,
    fits: Record<string, TargetTeamWarehouseFitQueryResult>,
  ) => void
  releasePreviousDetached: (nextRunId: string) => void
  calculateDetached: ReturnType<typeof useDetachedAccountDecisionCalculation>
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
  releaseRun: ReturnType<typeof useReleaseAccountDecisionRun>
  navigate: NavigateFunction
}
