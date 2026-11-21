import type { NavigateFunction } from 'react-router-dom'
import { reviewedEventConditionDeclarationsIdentity32 } from '../calculation/reviewedEventConditionDeclarations32'
import { contentHash } from '../application/contentHash'
import {
  isCurrentDevelopmentWorkbenchRoute,
  type DevelopmentWorkbenchRouteSelection,
} from '../application/publicDevelopmentWorkbenchRoute'
import { developmentPanelDiscFingerprint } from '../application/publicDevelopmentComparisonPanels'
import { readSavedAgentComparisonContext } from '../application/readSavedAgentComparisonContext'
import { WarehouseMatchError } from '../application/warehouseMatchFeedback'
import type { WarehouseAnalysisIntent } from '../features/agentDevelopmentGolden'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmark'
import type { ReviewedEventConditionDeclarations32 } from '../calculation/reviewedEventConditionDeclarations32'
import {
  cacheDevelopmentCandidateSnapshot,
  readDevelopmentCandidateSnapshot,
} from './agentDevelopmentCandidateSession'
import {
  assertWorkbenchComparisonResultContext,
  developmentWorkbenchComparisonContext,
} from './developmentWorkbenchComparisonContext'
import { rememberDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteCache'
import type { Props } from './agentDevelopmentWorkbenchViewState'

export async function runDecisionWorldWorkbenchAnalysis({
  intent,
  requestedParameters,
  requestedDeclarations,
  accountId,
  agentId,
  requestedPlanId,
  selectedCandidateRank,
  candidateSnapshot,
  workbenchData,
  decisionWorld,
  queryDevelopmentCandidateAlternatives,
  queryDevelopmentWorkbenchRoute,
  comparisonRouteReady,
  signal,
  canContinue,
  setRouteRead,
  setLastRouteProjection,
  setAnalysisVersion,
  locationSearch,
  navigate,
}: {
  intent: WarehouseAnalysisIntent
  requestedParameters?: DevelopmentComparisonParameters
  requestedDeclarations?: ReviewedEventConditionDeclarations32
  accountId: string
  agentId: string
  requestedPlanId: string | null
  selectedCandidateRank: number
  candidateSnapshot: Props['candidateSnapshot']
  workbenchData: Props['workbenchData']
  decisionWorld: Props['decisionWorld']
  queryDevelopmentCandidateAlternatives: Props['queryDevelopmentCandidateAlternatives']
  queryDevelopmentWorkbenchRoute: Props['queryDevelopmentWorkbenchRoute']
  comparisonRouteReady: Promise<unknown>
  signal: AbortSignal
  canContinue: () => boolean
  setRouteRead: Props['setRouteRead']
  setLastRouteProjection: Props['setLastRouteProjection']
  setAnalysisVersion: Props['setAnalysisVersion']
  locationSearch: string
  navigate: NavigateFunction
}): Promise<boolean> {
  const currentRun =
    decisionWorld.status === 'current' && decisionWorld.analysisIssue?.kind !== 'run_lost'
      ? decisionWorld.run
      : await decisionWorld.refresh()
  signal.throwIfAborted()
  if (!canContinue()) return false
  if (!currentRun) throw new Error('当前账户无法重新分析；请稍后重试。')
  const savedPlan = requestedPlanId
    ? currentRun.input.drafts.find(
        (plan) =>
          plan.id === requestedPlanId &&
          plan.selection.agentIds.length === 1 &&
          plan.selection.agentIds[0] === agentId,
      )
    : undefined
  if (requestedPlanId && !savedPlan) throw new Error('已保存方案不可用，请重新选择。')
  const previousCandidateSnapshot =
    candidateSnapshot ?? readDevelopmentCandidateSnapshot(accountId, agentId)
  const saved = savedPlan ? readSavedAgentComparisonContext(savedPlan, agentId) : null
  if (saved?.replayBlocked) throw new Error('已保存方案的比较条件无效，请重新选择后比较。')
  const context = savedPlan ? null : previousCandidateSnapshot
  const scenarioSelection = saved
    ? saved.scenario.state === 'recorded'
      ? saved.scenario.value.selection
      : undefined
    : context?.scenarioSelection
  const resourceGrantDeclaration32 = saved
    ? saved.resourceGrant.state === 'recorded'
      ? saved.resourceGrant.value.declaration
      : undefined
    : context?.resourceGrantDeclaration32
  const { declarations, declarationIdentity, explicitParameters } =
    developmentWorkbenchComparisonContext(
      agentId,
      context,
      selectedCandidateRank,
      requestedParameters,
      previousCandidateSnapshot?.candidateParametersByRank,
      savedPlan,
      requestedDeclarations,
    )
  const result =
    declarations || scenarioSelection || explicitParameters || resourceGrantDeclaration32
      ? await queryDevelopmentCandidateAlternatives(
          currentRun.runId,
          agentId,
          explicitParameters ? { 1: explicitParameters } : undefined,
          scenarioSelection,
          declarations,
          resourceGrantDeclaration32,
          undefined,
          signal,
        )
      : await queryDevelopmentCandidateAlternatives(
          currentRun.runId,
          agentId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          signal,
        )
  if (
    result.eventConditionDeclarationsIdentity !== declarationIdentity ||
    reviewedEventConditionDeclarationsIdentity32(result.eventConditionDeclarationsByAgentId) !==
      declarationIdentity
  )
    throw new Error('技能事件声明未进入本次匹配结果，请重新比较。')
  assertWorkbenchComparisonResultContext(result, saved, resourceGrantDeclaration32)
  if (!canContinue()) return false
  if (
    result.status !== 'ready' ||
    result.accountId !== accountId ||
    result.agentId !== agentId ||
    result.runId !== currentRun.runId ||
    result.inputFingerprint !== currentRun.inputFingerprint
  )
    throw new WarehouseMatchError(result.gaps)
  const index = Math.min(
    explicitParameters ? 0 : selectedCandidateRank - 1,
    Math.max(result.candidates.length - 1, 0),
  )
  const loadout = requestedPlanId ? undefined : result.candidates[index]?.loadouts[0]
  const selection: DevelopmentWorkbenchRouteSelection = {
    agentId,
    requestedPlanId,
    candidateRank: loadout ? index + 1 : null,
    candidateLoadoutFingerprint: loadout ? contentHash(loadout) : null,
  }
  if (
    !requestedPlanId &&
    !explicitParameters &&
    !scenarioSelection &&
    !resourceGrantDeclaration32 &&
    intent === 'compare' &&
    !declarations &&
    loadout
  ) {
    const routeLoaded = await comparisonRouteReady
    signal.throwIfAborted()
    if (!canContinue()) return false
    if (routeLoaded) {
      // The Worker already retained this issued loadout for the route
      // query. Do not publish React route state before comparison;
      // that would queue the expensive route unnecessarily.
      if (!cacheDevelopmentCandidateSnapshot(result)) throw new WarehouseMatchError(result.gaps)
      return false
    }
  }
  // Prepare the matching panel before publishing its candidate. Publishing
  // first changes the route key and replaces the whole workbench with loading.
  signal.throwIfAborted()
  const projection = await queryDevelopmentWorkbenchRoute(currentRun.runId, selection)
  signal.throwIfAborted()
  if (!canContinue()) return false
  const selectedIds =
    loadout?.discs.map((choice) => choice.disc.id) ?? workbenchData.discs.map((disc) => disc.id)
  const selectedDiscs = currentRun.input.warehouse.discs.filter((disc) =>
    selectedIds.includes(disc.id),
  )
  if (
    !isCurrentDevelopmentWorkbenchRoute(
      projection,
      {
        runId: currentRun.runId,
        accountId,
        inputFingerprint: currentRun.inputFingerprint,
        selection,
        selectedDiscs,
      },
      developmentPanelDiscFingerprint,
    )
  )
    throw new Error('本次配装资料已变化，请重新搭配；尚未保存。')
  if (!cacheDevelopmentCandidateSnapshot(result)) throw new WarehouseMatchError(result.gaps)
  const key = contentHash([currentRun.runId, currentRun.inputFingerprint, selection])
  rememberDevelopmentWorkbenchRoute(key, projection)
  setRouteRead({ key, value: projection })
  setLastRouteProjection({
    accountId,
    agentId,
    value: projection,
  })
  setAnalysisVersion((version) => version + 1)
  if (new URLSearchParams(locationSearch).get('candidate') === '0')
    navigate(`/development/${agentId}?candidate=${index + 1}`, {
      replace: true,
    })
  return true
}
