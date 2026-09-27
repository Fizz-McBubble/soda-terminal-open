import {
  calculationQueryContractVersion,
  type AccountDecisionQueryInput,
  type CalculationQueryClient,
} from './calculationQueryContract'

/** Dispatches a captured run through the selected client without importing decision rules. */
export function createAccountDecisionRun(
  input: AccountDecisionQueryInput,
  options: { runId?: string; capturedAt?: string; client: CalculationQueryClient },
) {
  const capturedAt = options.capturedAt ?? new Date().toISOString()
  return options.client.calculateAccountDecision({
    contractVersion: calculationQueryContractVersion,
    kind: 'account_decision',
    runId: options.runId ?? crypto.randomUUID(),
    capturedAt,
    input,
  })
}
