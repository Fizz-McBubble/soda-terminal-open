import type { useDevelopmentCandidateAlternativesCalculation } from '../application/accountDecisionWorld'
import type {
  AccountDecisionRun,
  DevelopmentCandidateAlternativesQueryResult,
} from '../application/calculationQueryContract'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
  type ReviewedEventConditionDeclarations32,
} from '../calculation/reviewedEventConditionDeclarations32'
import { rebindComparisonParameters } from './rebindComparisonParameters'

type Query = ReturnType<typeof useDevelopmentCandidateAlternativesCalculation>

/** Recompute and validate one comparison without publishing or owning UI lifecycle. */
export async function recalculateDevelopmentComparison(input: {
  snapshot: DevelopmentCandidateAlternativesQueryResult & { status: 'ready' }
  run: AccountDecisionRun
  accountId: string
  agentId: string
  selection: CurrentPlanningScenarioSelection32
  requestedDeclarations?: ReviewedEventConditionDeclarations32
  snapshotStale: boolean
  readCurrentFingerprint: () => string | undefined
  query: Query
  signal: AbortSignal
  isCurrent: () => boolean
}): Promise<DevelopmentCandidateAlternativesQueryResult | null> {
  const { snapshot, run, accountId, agentId, selection, signal, isCurrent } = input
  const conditionChange = input.requestedDeclarations !== undefined
  const declarations = normalizeReviewedEventConditionDeclarations32(
    input.requestedDeclarations ?? snapshot.eventConditionDeclarationsByAgentId,
    [agentId],
  )
  const declarationIdentity = reviewedEventConditionDeclarationsIdentity32(declarations)
  const priorParameters = snapshot.candidateParametersByRank
  const hasDirection =
    !!snapshot.buildIntent.independentDirection ||
    Object.values(priorParameters ?? {}).some((p) => p.independentDirection)
  if (hasDirection && !Object.values(priorParameters ?? {}).some((p) => p.independentDirection))
    throw new Error('个人方向参数缺失，请重新搭配。')
  const firstParameters = hasDirection ? priorParameters : undefined
  const request = (parameters: typeof priorParameters) =>
    input.query(
      run.runId,
      agentId,
      parameters,
      selection,
      declarations,
      snapshot.resourceGrantDeclaration32,
      undefined,
      signal,
    )
  let result = await request(firstParameters)
  if (!isCurrent()) return null
  if (result.status !== 'ready') throw new Error(result.gaps[0] ?? '当前仓库暂不能生成完整候选。')
  const rebound = rebindComparisonParameters(snapshot, result)
  if (
    (conditionChange || hasDirection) &&
    Object.keys(rebound).length !== Object.keys(priorParameters ?? {}).length
  )
    throw new Error('原方案参数无法绑定到当前候选，请重新比较。')
  if (
    Object.keys(rebound).length &&
    JSON.stringify(firstParameters ?? {}) !== JSON.stringify(rebound)
  ) {
    result = await request(rebound)
    if (!isCurrent()) return null
  }
  if (result.scenarioSelection?.id !== selection.id || !result.scenarioIdentity)
    throw new Error('比较场景未进入计算结果，请重试。')
  const actualParameters = result.candidateParametersByRank ?? {}
  const direction =
    snapshot.buildIntent.independentDirection ??
    Object.values(priorParameters ?? {}).find((p) => p.independentDirection)?.independentDirection
  const parametersMatch = hasDirection
    ? Object.entries(rebound).every(
        ([rank, parameters]) =>
          JSON.stringify(actualParameters[Number(rank)]) === JSON.stringify(parameters),
      ) &&
      Object.values(actualParameters).every(
        (parameters) =>
          JSON.stringify(parameters.independentDirection) === JSON.stringify(direction),
      )
    : JSON.stringify(actualParameters) === JSON.stringify(rebound)
  if (
    result.accountId !== accountId ||
    result.agentId !== agentId ||
    result.runId !== run.runId ||
    result.inputFingerprint !== run.inputFingerprint ||
    result.eventConditionDeclarationsIdentity !== declarationIdentity ||
    reviewedEventConditionDeclarationsIdentity32(result.eventConditionDeclarationsByAgentId) !==
      declarationIdentity ||
    ((conditionChange || hasDirection) && !parametersMatch) ||
    JSON.stringify(result.resourceGrantDeclaration32 ?? null) !==
      JSON.stringify(snapshot.resourceGrantDeclaration32 ?? null) ||
    (!input.snapshotStale && input.readCurrentFingerprint() !== snapshot.comparisonFingerprint)
  )
    throw new Error('比较条件或账户已变化，请重新比较。')
  return result
}
