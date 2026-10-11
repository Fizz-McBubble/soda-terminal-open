import { vi } from 'vitest'
import { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'

const { queryComparison } = vi.hoisted(() => ({ queryComparison: vi.fn() }))

vi.mock('../application/accountDecisionWorld', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../application/accountDecisionWorld')>()
  return {
    ...actual,
    useAccountDecisionWorld: vi.fn(actual.useAccountDecisionWorld),
    useDevelopmentCandidateAlternativesCalculation: () =>
      queryComparison.mockImplementation(
        async (
          runId: string,
          agentId: string,
          candidateParametersByRank?: import('../application/calculationQueryContract').DevelopmentCandidateAlternativesQuery['candidateParametersByRank'],
        ) => {
          const snapshot = readDevelopmentCandidateSnapshot('comparison-account', agentId)!
          return {
            ...snapshot,
            runId,
            inputFingerprint: runId.includes('after-save')
              ? 'after-save'
              : snapshot.inputFingerprint,
            candidateParametersByRank: candidateParametersByRank ?? {},
          }
        },
      ),
  }
})

export function getQueryComparisonMock() {
  return queryComparison
}
