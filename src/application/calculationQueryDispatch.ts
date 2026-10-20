import type {
  AccountDecisionRun,
  CalculationQueryClient,
  DecisionPortfolioQuery,
} from './calculationQueryContract'
import type { RemoteCalculationRequest } from './remoteCalculationProtocol'

export type DispatchableCalculationQuery =
  | RemoteCalculationRequest['query']
  | DecisionPortfolioQuery

export type CalculationDispatchSourceRun = Pick<AccountDecisionRun, 'runId' | 'input' | 'snapshot'>

export type CalculationDispatchTransform = (
  kind: DispatchableCalculationQuery['kind'],
  result: unknown,
) => unknown

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

/**
 * One query dispatcher is shared by the private Node worker and the community
 * browser worker. Transport validation and public projection stay at their
 * respective boundaries; capability coverage cannot silently diverge here.
 */
export async function dispatchCalculationQuery(
  client: CalculationQueryClient,
  query: DispatchableCalculationQuery,
  options: {
    sourceRun?: CalculationDispatchSourceRun
    transform?: CalculationDispatchTransform
  } = {},
): Promise<unknown> {
  let result: unknown
  switch (query.kind) {
    case 'account_decision':
      result = await client.calculateAccountDecision(query)
      break
    case 'target_team_warehouse_fit':
      result = await client.calculateTargetTeamWarehouseFit(query)
      break
    case 'team_overview_presentation':
      result = await client.queryTeamOverviewPresentation(query, {
        sourceRun: options.sourceRun,
      })
      break
    case 'team_route_presentation':
      result = await client.queryTeamRoutePresentation(query)
      break
    case 'saved_team_plan_replay':
      result = await client.querySavedTeamPlanReplay(query)
      break
    case 'saved_team_solution_components':
      result = await client.querySavedTeamSolutionComponents(query)
      break
    case 'decision_portfolio':
      result = await client.queryDecisionPortfolio(query)
      break
    case 'development_candidate_alternatives':
      result = await client.queryDevelopmentCandidateAlternatives(query)
      break
    case 'common_anomaly_settlement32':
      result = await required(client.queryCommonAnomalySettlement32, '风异常声明结算不可用。').call(
        client,
        query,
      )
      break
    case 'reviewed_incremental_event32':
      result = await required(client.queryReviewedIncrementalEvent32, '单次命中计算不可用。').call(
        client,
        query,
      )
      break
    case 'planning_benchmark32':
      result = await required(client.queryPlanningBenchmark32, '逐次事件基准计算不可用。').call(
        client,
        query,
      )
      break
    case 'development_workbench_route':
      result = await client.queryDevelopmentWorkbenchRoute(query)
      break
    case 'warehouse_disc_transition_uses':
      result = await required(
        client.queryWarehouseDiscTransitionUses,
        '仓库驱动盘转换计算不可用。',
      ).call(client, query)
      break
    default: {
      const unreachable: never = query
      throw new Error(`不支持的计算请求：${String((unreachable as { kind?: unknown }).kind)}`)
    }
  }
  return options.transform ? options.transform(query.kind, result) : result
}
