import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type {
  AccountDecisionSnapshot,
  CalculationQueryClient,
  TargetTeamWarehouseFitQueryResult,
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
  alternativeAbortRef,
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
  alternativeAbortRef: MutableRefObject<AbortController | null>
  capturePageScope: () => () => boolean
  setSwitchingAlternativeId: Dispatch<SetStateAction<string | null>>
  setAlternativeError: Dispatch<SetStateAction<string | null>>
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
  navigate: NavigateFunction
}) {
  return async (candidateId: string) => {
    if (
      !decision ||
      !analysisRunId ||
      !calculationClient ||
      readOnly ||
      switchingAlternativeId === candidateId
    )
      return
    alternativeAbortRef.current?.abort()
    const controller = new AbortController()
    alternativeAbortRef.current = controller
    const generation = ++targetFitRequestGeneration.current
    const isCurrentPage = capturePageScope()
    const isCurrentRequest = () =>
      !controller.signal.aborted &&
      isCurrentPage() &&
      generation === targetFitRequestGeneration.current
    let navigating = false
    setSwitchingAlternativeId(candidateId)
    setAlternativeError(null)
    try {
      const identity = {
        runId: analysisRunId,
        accountId: accountId ?? '',
        inputFingerprint: decision.fingerprint.inputHash,
        candidateId,
      }
      const previous = acceptTeamRoutePresentation(
        currentTeamAnalysisSession?.result.teamRoutePresentations?.[candidateId],
        identity,
      )
      const projected =
        previous ??
        (await calculationClient
          .queryTeamRoutePresentation(
            {
              contractVersion: calculationQueryContractVersion,
              kind: 'team_route_presentation',
              runId: analysisRunId,
              candidateId,
            },
            { signal: controller.signal },
          )
          .catch((error) => {
            if (controller.signal.aborted) throw error
            return null
          }))
      if (!isCurrentRequest()) return
      const entry = acceptTeamRoutePresentation(projected, identity)
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
      const { team, targetCandidateId } = entry
      const matchesTarget = (fit: TargetTeamWarehouseFitQueryResult | undefined) =>
        fit?.candidateId === targetCandidateId &&
        fit.memberIds.length === team.agentIds.length &&
        team.agentIds.every((agentId) => fit.memberIds.includes(agentId))
      const destination = `/loadouts/team/${encodeURIComponent(candidateId)}`
      const openDestination = () => {
        navigate(destination)
        navigating = true
      }
      if (!entry.discOnlyCandidate && !entry.team.bangbooId && !entry.automaticBangboo) {
        openDestination()
        return
      }
      const currentSession = currentTeamAnalysisSession
      const sameInput =
        currentSession?.result.analysisRunId === analysisRunId &&
        currentSession.result.warehouse.accountId === accountId &&
        currentSession.result.inputFingerprint === decision.fingerprint.inputHash
      const cached = sameInput ? currentSession.result.targetTeamFits[entry.team.id] : undefined
      if (matchesTarget(cached)) {
        openDestination()
        return
      }
      const fit = await calculateTargetTeamWarehouseFit(
        analysisRunId,
        entry.targetCandidateId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        controller.signal,
      )
      if (!isCurrentRequest()) return
      if (!matchesTarget(fit)) throw new Error('替换队伍配装对象不匹配。')
      const session = currentTeamAnalysisSession
      if (
        session?.result.analysisRunId !== analysisRunId ||
        session.result.warehouse.accountId !== accountId ||
        session.result.inputFingerprint !== decision.fingerprint.inputHash ||
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
      openDestination()
    } catch {
      if (isCurrentRequest()) setAlternativeError('替换队伍配装失败，请重试；账户资产没有改变。')
    } finally {
      if (alternativeAbortRef.current === controller) alternativeAbortRef.current = null
      if (!navigating && isCurrentRequest()) setSwitchingAlternativeId(null)
    }
  }
}
