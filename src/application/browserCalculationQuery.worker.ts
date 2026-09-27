import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
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
    return buildAccountDecisionSnapshot(input)
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
    let result: unknown
    switch (request.query.kind) {
      case 'account_decision':
        result = await client.calculateAccountDecision(request.query)
        break
      case 'target_team_warehouse_fit':
        result = await client.calculateTargetTeamWarehouseFit(request.query)
        break
      case 'team_overview_presentation':
        result = await client.queryTeamOverviewPresentation(request.query)
        break
      case 'team_route_presentation':
        result = await client.queryTeamRoutePresentation(request.query)
        break
      case 'saved_team_plan_replay':
        result = await client.querySavedTeamPlanReplay(request.query)
        break
      case 'saved_team_solution_components':
        result = await client.querySavedTeamSolutionComponents(request.query)
        break
      case 'decision_portfolio':
        result = await client.queryDecisionPortfolio(request.query)
        break
      case 'development_candidate_alternatives':
        result = await client.queryDevelopmentCandidateAlternatives(request.query)
        break
      case 'development_workbench_route':
        result = await client.queryDevelopmentWorkbenchRoute(request.query)
        break
      case 'warehouse_disc_transition_uses':
        result = await client.queryWarehouseDiscTransitionUses?.(request.query)
        break
      default:
        throw new Error('不支持的计算请求。')
    }
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
