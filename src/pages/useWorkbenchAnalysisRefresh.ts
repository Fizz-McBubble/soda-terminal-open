import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { AccountDecisionRun } from '../application/calculationQueryContract'
import { playerErrorMessage } from '../application/playerErrorMessage'
import type { AnalysisRefresh } from './agentDevelopmentWorkbenchViewState'

export function useWorkbenchAnalysisRefresh(
  refreshDecisionWorld: () => Promise<AccountDecisionRun | null>,
  scopeKey: string,
  currentRun: AccountDecisionRun | null,
  analysisRefresh: AnalysisRefresh | null,
  setAnalysisRefresh: Dispatch<SetStateAction<AnalysisRefresh | null>>,
) {
  const analysisRefreshAttempt = useRef<string | null>(null)
  const analysisRefreshRequest = useRef(0)
  const pageActive = useRef(true)
  useLayoutEffect(() => {
    pageActive.current = true
    return () => {
      pageActive.current = false
      analysisRefreshRequest.current += 1
      analysisRefreshAttempt.current = null
    }
  }, [scopeKey])
  useEffect(() => {
    if (!currentRun || !analysisRefresh) return
    // Another request may have superseded this refresh and already produced a current run.
    analysisRefreshRequest.current += 1
    analysisRefreshAttempt.current = null
    let active = true
    queueMicrotask(() => {
      if (active) setAnalysisRefresh(null)
    })
    return () => {
      active = false
    }
  }, [analysisRefresh, currentRun, setAnalysisRefresh])
  const runAnalysisRefresh = useCallback(
    async function refreshAnalysis(
      key: string,
      expectedAccountId: string,
      options: { retry?: boolean } = {},
    ) {
      if (!options.retry && analysisRefreshAttempt.current === key) return
      analysisRefreshAttempt.current = key
      const request = analysisRefreshRequest.current + 1
      analysisRefreshRequest.current = request
      if (pageActive.current) {
        setAnalysisRefresh({ key, phase: 'updating' })
      }
      try {
        const next = await refreshDecisionWorld()
        if (!pageActive.current || request !== analysisRefreshRequest.current) return
        if (next?.input.warehouse.accountId !== expectedAccountId) {
          throw new Error('养成建议暂未更新。')
        }
        setAnalysisRefresh(null)
      } catch (error) {
        if (!pageActive.current || request !== analysisRefreshRequest.current) return
        setAnalysisRefresh({
          key,
          phase: 'failed',
          error: playerErrorMessage(error, '养成建议更新未完成，请重试。'),
          onRetry: () => {
            void refreshAnalysis(key, expectedAccountId, { retry: true })
          },
        })
      }
    },
    [refreshDecisionWorld, setAnalysisRefresh],
  )
  return runAnalysisRefresh
}
