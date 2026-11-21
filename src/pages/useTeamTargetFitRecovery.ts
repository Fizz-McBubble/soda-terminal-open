import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'
import type { useTargetTeamWarehouseFitCalculation } from '../application/accountDecisionWorldHooks'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import { standardReferenceContinuation32 } from './standardReferenceContinuation32'

export function useTeamTargetFitRecovery({
  analysisRunId,
  calculateTargetTeamWarehouseFit,
  canRecoverTargetFit,
  recoveryAccountId,
  recoveryAttempt,
  recoveryInputHash,
  recoveryTeamId,
  targetCandidateId,
  retainedTargetTeamFit,
  targetFitRequestGenerationRef,
  setTargetFitState,
  setFitStatus,
}: {
  analysisRunId?: string
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
  canRecoverTargetFit: boolean
  recoveryAccountId: string | null
  recoveryAttempt: number
  recoveryInputHash: string | null
  recoveryTeamId: string | null
  targetCandidateId: string | null
  retainedTargetTeamFit?: TargetTeamWarehouseFitQueryResult
  targetFitRequestGenerationRef: MutableRefObject<number>
  setTargetFitState: Dispatch<
    SetStateAction<{
      runId: string | undefined
      fit: TargetTeamWarehouseFitQueryResult | undefined
    }>
  >
  setFitStatus: Dispatch<SetStateAction<'idle' | 'running' | 'error'>>
}) {
  useEffect(() => {
    if (!canRecoverTargetFit || !analysisRunId || !targetCandidateId) return
    let active = true
    const controller = new AbortController()
    const generation = ++targetFitRequestGenerationRef.current
    // StrictMode replays effects on first mount. Wait one microtask so its discarded
    // pass never submits a second calculation task.
    queueMicrotask(() => {
      if (
        !active ||
        controller.signal.aborted ||
        generation !== targetFitRequestGenerationRef.current
      )
        return
      setFitStatus('running')
      void calculateTargetTeamWarehouseFit(
        analysisRunId,
        targetCandidateId,
        undefined,
        retainedTargetTeamFit?.scenarioSelection,
        retainedTargetTeamFit?.eventConditionDeclarationsByAgentId,
        undefined,
        standardReferenceContinuation32(retainedTargetTeamFit, targetCandidateId),
        undefined,
        controller.signal,
      )
        .then((fit) => {
          if (
            !active ||
            controller.signal.aborted ||
            generation !== targetFitRequestGenerationRef.current
          )
            return
          const session = currentTeamAnalysisSession
          if (
            recoveryTeamId &&
            session?.result.analysisRunId === analysisRunId &&
            session.result.warehouse.accountId === recoveryAccountId &&
            session.result.decisionSnapshot.fingerprint.inputHash === recoveryInputHash
          )
            setCurrentTeamAnalysisSession({
              ...session,
              result: {
                ...session.result,
                targetTeamFits: { ...session.result.targetTeamFits, [recoveryTeamId]: fit },
              },
            })
          setTargetFitState({ runId: analysisRunId, fit })
          setFitStatus('idle')
        })
        .catch(() => {
          if (
            active &&
            !controller.signal.aborted &&
            generation === targetFitRequestGenerationRef.current
          )
            setFitStatus('error')
        })
    })
    return () => {
      active = false
      controller.abort()
      targetFitRequestGenerationRef.current += 1
    }
  }, [
    analysisRunId,
    calculateTargetTeamWarehouseFit,
    canRecoverTargetFit,
    recoveryAccountId,
    recoveryAttempt,
    recoveryInputHash,
    recoveryTeamId,
    targetCandidateId,
    retainedTargetTeamFit,
    targetFitRequestGenerationRef,
    setTargetFitState,
    setFitStatus,
  ])
}
