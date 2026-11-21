import { useCallback, type Dispatch, type SetStateAction, type RefObject } from 'react'
import type { AccountDecisionRun } from '../application/calculationQueryContract'
import { playerErrorMessage } from '../application/playerErrorMessage'
import type { AnalysisRefresh } from './agentDevelopmentWorkbenchViewState'

export function useWorkbenchAnalysisRefresh(
  refreshDecisionWorld: () => Promise<AccountDecisionRun | null>,
  analysisRefreshAttempt: RefObject<string | null>,
  analysisRefreshRequest: RefObject<number>,
  pageActive: RefObject<boolean>,
  setAnalysisRefresh: Dispatch<SetStateAction<AnalysisRefresh | null>>,
) {
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
    [
      analysisRefreshAttempt,
      analysisRefreshRequest,
      pageActive,
      refreshDecisionWorld,
      setAnalysisRefresh,
    ],
  )
  return runAnalysisRefresh
}
