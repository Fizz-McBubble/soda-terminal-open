import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
import {
  accountDecisionSnapshotWorkerProtocolVersion,
  serializeAccountDecisionWorkerError,
  type AccountDecisionSnapshotWorkerRequest,
  type AccountDecisionSnapshotWorkerResponse,
} from './accountDecisionSnapshotWorkerProtocol'

type WorkerScope = {
  onmessage: ((event: MessageEvent<AccountDecisionSnapshotWorkerRequest>) => void) | null
  postMessage(message: AccountDecisionSnapshotWorkerResponse): void
}

export function calculateAccountDecisionSnapshotWorkerResponse(
  request: AccountDecisionSnapshotWorkerRequest,
): AccountDecisionSnapshotWorkerResponse {
  if (request.protocolVersion !== accountDecisionSnapshotWorkerProtocolVersion) {
    return {
      protocolVersion: accountDecisionSnapshotWorkerProtocolVersion,
      kind: 'error',
      requestId: request.requestId,
      error: {
        name: 'AccountDecisionWorkerProtocolError',
        message: `Unsupported account decision worker protocol: ${String(request.protocolVersion)}`,
      },
    }
  }
  try {
    return {
      protocolVersion: accountDecisionSnapshotWorkerProtocolVersion,
      kind: 'success',
      requestId: request.requestId,
      snapshot: buildAccountDecisionSnapshot(request.input),
    }
  } catch (error) {
    return {
      protocolVersion: accountDecisionSnapshotWorkerProtocolVersion,
      kind: 'error',
      requestId: request.requestId,
      error: serializeAccountDecisionWorkerError(error),
    }
  }
}

const workerScope = self as unknown as WorkerScope
workerScope.onmessage = (event) => {
  workerScope.postMessage(calculateAccountDecisionSnapshotWorkerResponse(event.data))
}
