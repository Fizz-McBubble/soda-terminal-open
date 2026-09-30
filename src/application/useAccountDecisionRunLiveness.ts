import { useCallback, useSyncExternalStore } from 'react'
import type { CalculationQueryClient } from './calculationQueryContract'

const subscribeNone = () => () => undefined
const readRetained = () => true

export function useAccountDecisionRunLiveness(client: CalculationQueryClient, runId?: string) {
  const readLiveness = useCallback(
    () => (runId ? (client.hasAccountDecisionRun?.(runId) ?? true) : true),
    [client, runId],
  )
  return useSyncExternalStore(
    client.subscribeAccountDecisionRuns ?? subscribeNone,
    readLiveness,
    readRetained,
  )
}
