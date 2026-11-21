import type { CalculationQueryClient } from './calculationQueryContract'

/** Allows the pure fingerprint only until the player consents to online calculation. */
export function createOnlineCalculationConsentClient(
  client: CalculationQueryClient,
): CalculationQueryClient {
  const requireConsent = async (): Promise<never> => {
    throw new Error('请先阅读在线计算说明并允许本次页面发送必要计算事实。')
  }
  const ignore = () => undefined
  const unavailable = () => false
  return {
    fingerprintAccountDecisionInput: (input, runId) =>
      client.fingerprintAccountDecisionInput(input, runId),
    calculateAccountDecision: requireConsent,
    queryDecisionPortfolio: requireConsent,
    calculateTargetTeamWarehouseFit: requireConsent,
    queryTeamOverviewPresentation: requireConsent,
    queryTeamRoutePresentation: requireConsent,
    querySavedTeamPlanReplay: requireConsent,
    querySavedTeamSolutionComponents: requireConsent,
    queryDevelopmentCandidateAlternatives: requireConsent,
    queryDevelopmentWorkbenchRoute: requireConsent,
    queryDevelopmentDirectoryFacts: client.queryDevelopmentDirectoryFacts
      ? requireConsent
      : undefined,
    queryDevelopmentWorkbenchFacts: client.queryDevelopmentWorkbenchFacts
      ? requireConsent
      : undefined,
    queryWarehouseActions: client.queryWarehouseActions ? requireConsent : undefined,
    queryWarehouseDiscTransitionUses: client.queryWarehouseDiscTransitionUses
      ? requireConsent
      : undefined,
    queryCommonAnomalySettlement32: client.queryCommonAnomalySettlement32
      ? requireConsent
      : undefined,
    queryPlanningBenchmark32: client.queryPlanningBenchmark32 ? requireConsent : undefined,
    queryReviewedIncrementalEvent32: client.queryReviewedIncrementalEvent32
      ? requireConsent
      : undefined,
    openPersonalDevelopmentSession: client.openPersonalDevelopmentSession
      ? requireConsent
      : undefined,
    queryPersonalDevelopmentCandidates: client.queryPersonalDevelopmentCandidates
      ? requireConsent
      : undefined,
    queryPersonalDevelopmentRoute: client.queryPersonalDevelopmentRoute
      ? requireConsent
      : undefined,
    releaseAccountDecisionRun: client.releaseAccountDecisionRun ? ignore : undefined,
    cancelActiveQuery: client.cancelActiveQuery ? ignore : undefined,
    hasAccountDecisionRun: client.hasAccountDecisionRun ? unavailable : undefined,
    subscribeAccountDecisionRuns: client.subscribeAccountDecisionRuns ? () => ignore : undefined,
    releasePersonalDevelopmentSession: client.releasePersonalDevelopmentSession
      ? ignore
      : undefined,
    hasPersonalDevelopmentSession: client.hasPersonalDevelopmentSession ? unavailable : undefined,
  }
}
