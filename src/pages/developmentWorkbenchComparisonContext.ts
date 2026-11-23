import { contentHash } from '../application/contentHash'
import type { SourceResourceGrantDeclaration32 } from '../calculation/sourceMechanismResourceGrantContract32'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmark'
import type { AccountPlanningDraft } from '../accounts/types'
import { readSavedAgentComparisonContext } from '../application/readSavedAgentComparisonContext'

/** Reuse the saved/selected personal context when changing just one explicit direction. */
export function developmentWorkbenchComparisonContext(
  agentId: string,
  context:
    | {
        eventConditionDeclarationsByAgentId?: unknown
        comparisonParameters?: DevelopmentComparisonParameters
        candidateParametersByRank?: Record<number, DevelopmentComparisonParameters>
      }
    | null
    | undefined,
  rank: number,
  requested?: DevelopmentComparisonParameters,
  fallbackParameters?: Record<number, DevelopmentComparisonParameters>,
  savedPlan?: AccountPlanningDraft,
  requestedDeclarations?: import('../calculation/reviewedEventConditionDeclarations32').ReviewedEventConditionDeclarations32,
) {
  if (savedPlan) {
    const saved = readSavedAgentComparisonContext(savedPlan, agentId)
    if (saved.replayBlocked) throw new Error('已保存方案的比较条件无效，请重新选择后比较。')
    const event =
      saved.eventDeclarations.state === 'recorded' ? saved.eventDeclarations.value : null
    const declarations =
      requestedDeclarations === undefined
        ? event?.declarations
        : normalizeReviewedEventConditionDeclarations32(requestedDeclarations, [agentId])
    const retained = saved.comparisonParameters
    return {
      declarations,
      declarationIdentity: reviewedEventConditionDeclarationsIdentity32(declarations),
      explicitParameters: requested ? { ...retained, ...requested } : retained,
    }
  }
  const declarations = normalizeReviewedEventConditionDeclarations32(
    requestedDeclarations ?? context?.eventConditionDeclarationsByAgentId,
    [agentId],
  )
  const retained =
    context?.comparisonParameters ??
    context?.candidateParametersByRank?.[rank] ??
    fallbackParameters?.[rank]
  return {
    declarations,
    declarationIdentity: reviewedEventConditionDeclarationsIdentity32(declarations),
    explicitParameters: requested ? { ...retained, ...requested } : retained,
  }
}

export function assertWorkbenchComparisonResultContext(
  result: {
    scenarioIdentity?: string
    resourceGrantDeclaration32?: SourceResourceGrantDeclaration32
  },
  saved: ReturnType<typeof readSavedAgentComparisonContext> | null,
  resourceGrant: SourceResourceGrantDeclaration32 | undefined,
) {
  if (
    saved?.scenario.state === 'recorded' &&
    saved.scenario.value.storedIdentity &&
    result.scenarioIdentity !== saved.scenario.value.storedIdentity
  )
    throw new Error('已保存方案的场景身份已变化，请重新选择后比较。')
  if (
    resourceGrant &&
    (!result.resourceGrantDeclaration32 ||
      contentHash(result.resourceGrantDeclaration32) !== contentHash(resourceGrant))
  )
    throw new Error('资源到账声明未进入本次匹配结果，请重新比较。')
}
