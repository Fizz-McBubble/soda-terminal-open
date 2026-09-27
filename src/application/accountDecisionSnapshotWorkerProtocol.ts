import type { AccountDecisionQueryInput } from './calculationQueryContract'
import type { AccountDecisionSnapshot } from '../decision/accountDecisionService'

export const accountDecisionSnapshotWorkerProtocolVersion =
  'soda-account-decision-snapshot-worker/v1' as const

export type AccountDecisionSnapshotCalculationInput = AccountDecisionQueryInput & {
  capturedAt: string
}

export type AccountDecisionSnapshotWorkerRequest = {
  protocolVersion: typeof accountDecisionSnapshotWorkerProtocolVersion
  kind: 'calculate'
  requestId: number
  input: AccountDecisionSnapshotCalculationInput
}

export type SerializedWorkerError = {
  name: string
  message: string
}

export type AccountDecisionSnapshotWorkerResponse =
  | {
      protocolVersion: typeof accountDecisionSnapshotWorkerProtocolVersion
      kind: 'success'
      requestId: number
      snapshot: AccountDecisionSnapshot
    }
  | {
      protocolVersion: typeof accountDecisionSnapshotWorkerProtocolVersion
      kind: 'error'
      requestId: number
      error: SerializedWorkerError
    }

export function serializeAccountDecisionWorkerError(error: unknown): SerializedWorkerError {
  if (error instanceof Error) return { name: error.name, message: error.message }
  return { name: 'Error', message: String(error) }
}
