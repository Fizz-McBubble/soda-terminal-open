import { useMemo } from 'react'
import type {
  AccountDecisionQueryInput,
  AccountDecisionRun,
  CalculationQueryClient,
} from './calculationQueryContract'

/** Compare change-detection identities in one domain, then retain the issued core identity. */
export function useLiveDecisionFingerprint(
  client: CalculationQueryClient,
  run: AccountDecisionRun | null,
  input: AccountDecisionQueryInput | null | undefined,
) {
  const captured = useMemo(
    () => (run ? client.fingerprintAccountDecisionInput(run.input) : null),
    [client, run],
  )
  return useMemo(() => {
    if (!input?.warehouse.accountId) return null
    const fingerprint = client.fingerprintAccountDecisionInput(input)
    return run && fingerprint === captured ? run.inputFingerprint : fingerprint
  }, [captured, input, client, run])
}
