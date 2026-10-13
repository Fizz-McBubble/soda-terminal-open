import type { DevelopmentCandidateAlternativesQueryResult } from '../application/calculationQueryContract'
import { hasDevelopmentComparisonPanels } from '../application/publicDevelopmentComparisonPanels'
import { resolveSavedPlanScenarioSelection } from './savedPlanIdentity'

type CandidateSnapshot = DevelopmentCandidateAlternativesQueryResult & { status: 'ready' }

const storagePrefix = 'soda:agent-development:candidates:v8:'

function hasPresentation(
  value: DevelopmentCandidateAlternativesQueryResult['presentation'],
): boolean {
  return Boolean(
    value?.contract === 'soda-development-candidate-presentation/v1' &&
    Array.isArray(value.preferredStatKeys) &&
    value.preferredStatKeys.every((key) => typeof key === 'string') &&
    Array.isArray(value.progressionDirections) &&
    value.progressionDirections.every((direction) => typeof direction === 'string') &&
    (['4', '5', '6'] as const).every(
      (slot) =>
        Array.isArray(value.recommendedMainStats?.[slot]) &&
        value.recommendedMainStats[slot].every((key) => typeof key === 'string'),
    ),
  )
}

function keyFor(accountId: string, agentId: string) {
  return `${storagePrefix}${accountId}:${agentId}`
}

export function readDevelopmentCandidateSnapshot(accountId: string, agentId: string) {
  try {
    const raw = sessionStorage.getItem(keyFor(accountId, agentId))
    if (!raw) return null
    const snapshot = JSON.parse(raw) as Partial<CandidateSnapshot>
    if (
      snapshot.contract !== 'soda-development-candidate-alternatives/v1' ||
      snapshot.status !== 'ready' ||
      snapshot.comparisonContract !== 'soda-explicit-development-comparison/v1' ||
      typeof snapshot.comparisonFingerprint !== 'string' ||
      snapshot.accountId !== accountId ||
      snapshot.agentId !== agentId ||
      typeof snapshot.runId !== 'string' ||
      typeof snapshot.inputFingerprint !== 'string' ||
      snapshot.buildIntent?.contract !== 'soda-build-intent/v1' ||
      snapshot.buildIntent.scope !== 'agent_independent' ||
      !Array.isArray(snapshot.baseline) ||
      !Array.isArray(snapshot.candidates) ||
      !hasPresentation(snapshot.presentation) ||
      !hasDevelopmentComparisonPanels(snapshot.panelPresentation, agentId)
    )
      return null
    resolveSavedPlanScenarioSelection(snapshot.scenarioSelection)
    if (snapshot.scenarioSelection?.id === 'declared-stun-comparison' && !snapshot.scenarioIdentity)
      return null
    return snapshot as CandidateSnapshot
  } catch {
    return null
  }
}

/** Browser storage is only a cached, successful Contract response and explicit analysis intent. */
export function cacheDevelopmentCandidateSnapshot(
  result: DevelopmentCandidateAlternativesQueryResult,
) {
  if (
    result.status !== 'ready' ||
    result.comparisonContract !== 'soda-explicit-development-comparison/v1' ||
    typeof result.comparisonFingerprint !== 'string' ||
    !hasPresentation(result.presentation) ||
    !hasDevelopmentComparisonPanels(result.panelPresentation, result.agentId)
  )
    return null
  try {
    resolveSavedPlanScenarioSelection(result.scenarioSelection)
  } catch {
    return null
  }
  if (result.scenarioSelection?.id === 'declared-stun-comparison' && !result.scenarioIdentity)
    return null
  sessionStorage.setItem(keyFor(result.accountId, result.agentId), JSON.stringify(result))
  return result
}

export function isDevelopmentCandidateSnapshotStale(
  snapshot: CandidateSnapshot,
  liveFingerprint: string | null,
) {
  return !liveFingerprint || snapshot.inputFingerprint !== liveFingerprint
}

/** Saving changes planning facts; refresh the candidates before continuing the same selection. */
export async function refreshDevelopmentCandidatesAfterSave({
  accountId,
  agentId,
  discIds,
  comparisonParameters,
  scenarioSelection,
  refresh,
  query,
}: {
  accountId: string
  agentId: string
  discIds: string[]
  comparisonParameters?: import('../decision/developmentValueBenchmark').DevelopmentComparisonParameters
  scenarioSelection?: import('../application/publicPlanningScenarioContract').CurrentPlanningScenarioSelection32
  refresh: () => Promise<{ runId: string } | null>
  query: (
    runId: string,
    agentId: string,
    parameters?: import('../application/calculationQueryContract').DevelopmentCandidateAlternativesQuery['candidateParametersByRank'],
    scenarioSelection?: import('../application/publicPlanningScenarioContract').CurrentPlanningScenarioSelection32,
  ) => Promise<DevelopmentCandidateAlternativesQueryResult>
}) {
  const previousSnapshot = readDevelopmentCandidateSnapshot(accountId, agentId)
  const effectiveScenario = scenarioSelection
    ? resolveSavedPlanScenarioSelection(scenarioSelection)
    : previousSnapshot?.scenarioSelection
      ? resolveSavedPlanScenarioSelection(previousSnapshot.scenarioSelection)
      : undefined

  const run = await refresh()
  if (!run) throw new Error('方案已保存，匹配结果暂未更新，请稍后重新匹配。')
  const matchesRequestedScenario = (value: DevelopmentCandidateAlternativesQueryResult) =>
    resolveSavedPlanScenarioSelection(value.scenarioSelection).id ===
    resolveSavedPlanScenarioSelection(effectiveScenario).id
  // The saved physical solution may exist only under its chosen parameters.
  // Search that scenario before matching IDs; an account-default search can omit it.
  const result = comparisonParameters
    ? effectiveScenario
      ? await query(run.runId, agentId, { 1: comparisonParameters }, effectiveScenario)
      : await query(run.runId, agentId, { 1: comparisonParameters })
    : effectiveScenario
      ? await query(run.runId, agentId, undefined, effectiveScenario)
      : await query(run.runId, agentId)
  if (
    result.accountId !== accountId ||
    result.agentId !== agentId ||
    result.runId !== run.runId ||
    !matchesRequestedScenario(result) ||
    !cacheDevelopmentCandidateSnapshot(result)
  )
    throw new Error('方案已保存，匹配结果暂未更新，请稍后重新匹配。')
  const selectedIds = JSON.stringify(discIds.toSorted())
  const rank =
    result.candidates.findIndex(
      (candidate) =>
        JSON.stringify(candidate.loadouts[0]?.discs.map((choice) => choice.disc.id).toSorted()) ===
        selectedIds,
    ) + 1
  if (!rank) throw new Error('方案已保存；当前推荐已有变化，请查看新的匹配结果。')
  if (comparisonParameters && rank !== 1) {
    const rebound = effectiveScenario
      ? await query(run.runId, agentId, { [rank]: comparisonParameters }, effectiveScenario)
      : await query(run.runId, agentId, { [rank]: comparisonParameters })
    if (
      rebound.accountId !== accountId ||
      rebound.agentId !== agentId ||
      rebound.runId !== run.runId ||
      !matchesRequestedScenario(rebound) ||
      !cacheDevelopmentCandidateSnapshot(rebound)
    )
      throw new Error('方案已保存；显式参数未能重新绑定到本次方案，请重新比较。')
  }
  return rank
}

export type { CandidateSnapshot }
