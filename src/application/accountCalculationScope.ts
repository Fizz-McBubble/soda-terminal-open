import type { AccountDecisionRun, CalculationQueryClient } from './calculationQueryContract'
import {
  releaseScopedPersonalSessions,
  scopedAccountEpochGuard,
  scopedAccountRunGuard,
  scopedPersonalDevelopmentClient,
} from './scopedPersonalDevelopmentClient'

export function createAccountCalculationScope(
  queryClient: CalculationQueryClient,
  accountIdentity: { accountId: string | null },
) {
  const { accountId } = accountIdentity
  const state = {
    identity: accountIdentity,
    active: true,
    epoch: 0,
    runs: new Set<string>(),
    personalSessions: new Set<string>(),
  }
  const guarded = scopedAccountEpochGuard(state, accountIdentity)
  const queryRun = scopedAccountRunGuard(state.runs, guarded)
  const client: CalculationQueryClient = {
    ...queryClient,
    ...scopedPersonalDevelopmentClient(queryClient, state, accountId, accountIdentity, guarded),
    cancelActiveQuery: queryClient.cancelActiveQuery
      ? (runId) => {
          if (state.active && state.runs.has(runId)) queryClient.cancelActiveQuery!(runId)
        }
      : undefined,
    releaseAccountDecisionRun(runId) {
      if (!state.active || !state.runs.delete(runId)) return
      queryClient.releaseAccountDecisionRun?.(runId)
    },
    async calculateAccountDecision(query) {
      if (query.input.warehouse.accountId !== accountId) throw new Error('分析输入不属于当前账户。')
      return guarded(async () => {
        let result: AccountDecisionRun | undefined
        state.runs.add(query.runId)
        try {
          result = await queryClient.calculateAccountDecision(query)
          if (!state.runs.has(query.runId)) throw new Error('本次分析已取消，可重新分析。')
          return result
        } catch (error) {
          state.runs.delete(query.runId)
          queryClient.releaseAccountDecisionRun?.(result?.runId ?? query.runId)
          throw error
        }
      })
    },
    queryDecisionPortfolio: (query) =>
      queryRun(query.runId, () => queryClient.queryDecisionPortfolio(query)),
    calculateTargetTeamWarehouseFit: (query, options) =>
      queryRun(query.runId, () => queryClient.calculateTargetTeamWarehouseFit(query, options)),
    queryTeamOverviewPresentation: (query, internal) =>
      queryRun(query.runId, () => queryClient.queryTeamOverviewPresentation(query, internal)),
    queryTeamRoutePresentation: (query, options) =>
      queryRun(query.runId, () => queryClient.queryTeamRoutePresentation(query, options)),
    querySavedTeamPlanReplay: (query) =>
      queryRun(query.runId, () => queryClient.querySavedTeamPlanReplay(query)),
    querySavedTeamSolutionComponents: (query) =>
      queryRun(query.runId, () => queryClient.querySavedTeamSolutionComponents(query)),
    queryDevelopmentCandidateAlternatives: (query, options) =>
      queryRun(query.runId, () =>
        queryClient.queryDevelopmentCandidateAlternatives(query, options),
      ),
    queryDevelopmentWorkbenchRoute: (query) =>
      queryRun(query.runId, () => queryClient.queryDevelopmentWorkbenchRoute(query)),
    queryDevelopmentWorkbenchFacts: queryClient.queryDevelopmentWorkbenchFacts
      ? (query, options) =>
          guarded(() => {
            if (query.input.warehouse.accountId !== accountId)
              throw new Error('养成事实输入不属于当前账户。')
            return queryClient.queryDevelopmentWorkbenchFacts!(query, options)
          })
      : undefined,
    queryDevelopmentDirectoryFacts: queryClient.queryDevelopmentDirectoryFacts
      ? (query, options) =>
          guarded(() => {
            if (query.input.warehouse.accountId !== accountId)
              throw new Error('养成目录事实输入不属于当前账户。')
            return queryClient.queryDevelopmentDirectoryFacts!(query, options)
          })
      : undefined,
    queryWarehouseActions: queryClient.queryWarehouseActions
      ? (query, options) =>
          queryRun(query.runId, () => queryClient.queryWarehouseActions!(query, options))
      : undefined,
    queryPlanningBenchmark32: queryClient.queryPlanningBenchmark32
      ? (query) => queryRun(query.runId, () => queryClient.queryPlanningBenchmark32!(query))
      : undefined,
    // Independent declarations can use their own request IDs without opening an account run.
    queryCommonAnomalySettlement32: queryClient.queryCommonAnomalySettlement32
      ? (query) => guarded(() => queryClient.queryCommonAnomalySettlement32!(query))
      : undefined,
    queryReviewedIncrementalEvent32: queryClient.queryReviewedIncrementalEvent32
      ? (query) => guarded(() => queryClient.queryReviewedIncrementalEvent32!(query))
      : undefined,
    queryWarehouseDiscTransitionUses: queryClient.queryWarehouseDiscTransitionUses
      ? (query, options) =>
          queryRun(query.runId, () => queryClient.queryWarehouseDiscTransitionUses!(query, options))
      : undefined,
  }
  function activate() {
    state.active = true
    return () => {
      state.active = false
      state.epoch += 1
      for (const id of state.runs) queryClient.releaseAccountDecisionRun?.(id)
      state.runs.clear()
      releaseScopedPersonalSessions(queryClient, state.personalSessions)
    }
  }
  return { client, activate }
}
