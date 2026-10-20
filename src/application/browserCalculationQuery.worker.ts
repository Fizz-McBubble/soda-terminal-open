import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
import { projectPublicCalculationResult } from './publicCalculationTransport'
import { dispatchCalculationQuery } from './calculationQueryDispatch'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { createLocalCalculationQueryClientCore } from './localCalculationQueryClientCore'
import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'

type WorkerScope = {
  onmessage: ((event: MessageEvent<BrowserCalculationQueryRequest>) => void) | null
  postMessage(message: BrowserCalculationQueryResponse): void
}

let runtime: CurrentGameDataRuntimeSelection | null = null
const client = createLocalCalculationQueryClientCore({
  readRuntimeSelection: async () => {
    if (!runtime) throw new Error('游戏资料版本尚未校验。')
    return runtime
  },
  // The entire Query client already runs in this Worker. Reusing the direct calculator avoids
  // creating a nested snapshot Worker and preserves the accepted calculation implementation.
  calculateSnapshot: async (input, options) => {
    options?.signal?.throwIfAborted()
    return buildAccountDecisionSnapshot({ ...input, deferDiagnosticInference: true })
  },
})

export async function calculateBrowserQueryResponse(
  request: BrowserCalculationQueryRequest,
): Promise<BrowserCalculationQueryResponse | null> {
  if (request.kind === 'release') {
    client.releaseAccountDecisionRun?.(request.runId)
    return null
  }
  const response = {
    protocolVersion: browserCalculationQueryProtocolVersion,
    requestId: request.requestId,
  } as const
  if (request.protocolVersion !== browserCalculationQueryProtocolVersion)
    return { ...response, status: 'failed', error: '计算版本不匹配，请刷新页面后重试。' }
  if (
    request.runtime.status !== 'compiled_current' ||
    request.runtime.packageId !== currentVersionProjection.packageId ||
    request.runtime.packageVersion !== currentVersionProjection.packageVersion ||
    request.runtime.gameVersion !== currentVersionProjection.gameVersion
  )
    return { ...response, status: 'failed', error: '游戏资料版本不匹配，请刷新页面后重试。' }

  runtime = request.runtime
  try {
    const result = await dispatchCalculationQuery(client, request.query, {
      transform: (kind, value) =>
        kind === 'account_decision' ||
        kind === 'common_anomaly_settlement32' ||
        kind === 'planning_benchmark32'
          ? projectPublicCalculationResult(kind, value)
          : value,
    })
    return { ...response, status: 'succeeded', result }
  } catch (error) {
    return {
      ...response,
      status: 'failed',
      error: error instanceof Error ? error.message : '计算失败。',
    }
  }
}

const workerScope = self as unknown as WorkerScope
workerScope.onmessage = (event) => {
  void calculateBrowserQueryResponse(event.data).then((response) => {
    if (response) workerScope.postMessage(response)
  })
}
// Module imports may take seconds to evaluate. A query sent before this handler exists can be
// lost in a module Worker, so the page dispatches only after this explicit readiness message.
workerScope.postMessage({
  protocolVersion: browserCalculationQueryProtocolVersion,
  requestId: 0,
  status: 'ready',
})
