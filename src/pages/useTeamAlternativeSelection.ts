import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type {
  AccountDecisionSnapshot,
  CalculationQueryClient,
} from '../application/calculationQueryContract'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import type { useTargetTeamWarehouseFitCalculation } from '../application/accountDecisionWorldHooks'
import { acceptTeamRoutePresentation } from './publicTeamRoutePresentation'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from './teamAnalysisSession'

export function useTeamAlternativeSelection({
  accountId,
  decision,
  analysisRunId,
  calculationClient,
  readOnly,
  switchingAlternativeId,
  targetFitRequestGeneration,
  capturePageScope,
  setSwitchingAlternativeId,
  setAlternativeError,
  calculateTargetTeamWarehouseFit,
  navigate,
}: {
  accountId: string | null
  decision?: AccountDecisionSnapshot
  analysisRunId?: string
  calculationClient: CalculationQueryClient | null
  readOnly: boolean
  switchingAlternativeId: string | null
  targetFitRequestGeneration: MutableRefObject<number>
  capturePageScope: () => () => boolean
  setSwitchingAlternativeId: Dispatch<SetStateAction<string | null>>
  setAlternativeError: Dispatch<SetStateAction<string | null>>
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
  navigate: NavigateFunction
}) {
  return async (candidateId: string) => {
    if (!decision || !analysisRunId || !calculationClient || readOnly || switchingAlternativeId)
      return
    const generation = ++targetFitRequestGeneration.current
    const isCurrentPage = capturePageScope()
    const isCurrentRequest = () =>
      isCurrentPage() && generation === targetFitRequestGeneration.current
    setSwitchingAlternativeId(candidateId)
    setAlternativeError(null)
    try {
      const projected = await calculationClient
        .queryTeamRoutePresentation({
          contractVersion: calculationQueryContractVersion,
          kind: 'team_route_presentation',
          runId: analysisRunId,
          candidateId,
        })
        .catch(() => null)
      if (!isCurrentRequest()) return
      const entry = acceptTeamRoutePresentation(projected, {
        runId: analysisRunId,
        accountId: accountId ?? '',
        inputFingerprint: decision.fingerprint.inputHash,
        candidateId,
      })
      if (entry && currentTeamAnalysisSession?.result.analysisRunId === analysisRunId)
        setCurrentTeamAnalysisSession({
          ...currentTeamAnalysisSession,
          result: {
            ...currentTeamAnalysisSession.result,
            teamRoutePresentations: {
              ...currentTeamAnalysisSession.result.teamRoutePresentations,
              [candidateId]: entry,
            },
          },
        })
      if (!entry?.team || !entry.targetCandidateId) {
        setAlternativeError('这支替换队伍暂不能生成配装。')
        return
      }
      const destination = `/loadouts/team/${encodeURIComponent(candidateId)}`
      if (!entry.discOnlyCandidate && !entry.team.bangbooId && !entry.automaticBangboo) {
        navigate(destination)
        return
      }
      const cached = currentTeamAnalysisSession?.result.targetTeamFits[entry.team.id]
      if (cached?.candidateId === entry.targetCandidateId) {
        navigate(destination)
        return
      }
      const fit = await calculateTargetTeamWarehouseFit(analysisRunId, entry.targetCandidateId)
      if (!isCurrentRequest()) return
      const session = currentTeamAnalysisSession
      if (
        session?.result.analysisRunId !== analysisRunId ||
        session.result.warehouse.accountId !== accountId ||
        session.result.decisionSnapshot.fingerprint.inputHash !== decision.fingerprint.inputHash
      ) {
        setAlternativeError('账户资料已更新，请重新分析后再配装。')
        return
      }
      setCurrentTeamAnalysisSession({
        ...session,
        result: {
          ...session.result,
          targetTeamFits: { ...session.result.targetTeamFits, [entry.team.id]: fit },
        },
      })
      navigate(destination)
    } catch {
      if (isCurrentRequest()) setAlternativeError('替换队伍配装失败，请重试；账户资产没有改变。')
    } finally {
      if (isCurrentRequest()) setSwitchingAlternativeId(null)
    }
  }
}
