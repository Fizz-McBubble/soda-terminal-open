import type { Dispatch, SetStateAction } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import type { AccountPlanningDraft } from '../accounts/types'
import type { DevelopmentCandidateAlternativesQueryResult } from '../application/calculationQueryContract'
import { contentHash } from '../application/contentHash'
import {
  useAccountDecisionWorld,
  useDevelopmentCandidateAlternativesCalculation,
} from '../application/accountDecisionWorld'
import { defaultPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import { createComparisonSavedBuild } from './createComparisonSavedBuild'
import {
  readDevelopmentCandidateSnapshot,
  refreshDevelopmentCandidatesAfterSave,
} from './agentDevelopmentCandidateSession'
import { resolveSavedPlanScenarioSelection } from './savedPlanIdentity'
import {
  developmentComparisonIdentity,
  type DevelopmentComparisonSnapshot,
} from './developmentComparisonSnapshot'
import type { CalculationQueryClient } from '../application/calculationQueryContract'
import type { PersonalDevelopmentCapture } from './personalDevelopmentSessionStore'
import {
  createPersonalSavedBuild,
  refreshPersonalAfterSave,
} from './personalDevelopmentComparisonActions'
import { loadPersonalDevelopmentInput } from '../application/personalDevelopmentInput'
import { isCurrentPersonalDevelopmentCapture } from './personalDevelopmentSessionStore'

export function comparisonSaveScope(snapshot: DevelopmentComparisonSnapshot) {
  return contentHash([
    developmentComparisonIdentity(snapshot),
    snapshot.inputFingerprint,
    snapshot.comparisonFingerprint,
    snapshot.candidateParametersByRank,
    snapshot.scenarioSelection,
    snapshot.eventConditionDeclarationsByAgentId,
    snapshot.resourceGrantDeclaration32,
  ])
}

export function displayedComparisonSaveScope(
  snapshot: DevelopmentComparisonSnapshot,
  alias: { next: string; previous: string } | null,
) {
  const scope = comparisonSaveScope(snapshot)
  return alias?.next === scope ? alias.previous : scope
}

type Options = {
  capturePageScope: () => () => boolean
  comparisonPending: boolean
  snapshotStale: boolean
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  alternatives: DevelopmentCandidateAlternativesQueryResult['candidates']
  startComparisonGeneration: () => () => boolean
  accountId: string
  agentId: string
  candidateSnapshot: NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>
  setJustSaved: Dispatch<SetStateAction<AccountPlanningDraft | null>>
  queryDevelopmentCandidateAlternatives: ReturnType<
    typeof useDevelopmentCandidateAlternativesCalculation
  >
  setSaveRefreshScope: Dispatch<SetStateAction<{ next: string; previous: string } | null>>
  displayedSaveScope: string
  setSnapshotVersion: Dispatch<SetStateAction<number>>
  params: URLSearchParams
  setParams: SetURLSearchParams
}

export function createComparisonPlanSave({
  capturePageScope,
  comparisonPending,
  snapshotStale,
  decisionWorld,
  alternatives,
  startComparisonGeneration,
  accountId,
  agentId,
  candidateSnapshot,
  setJustSaved,
  queryDevelopmentCandidateAlternatives,
  setSaveRefreshScope,
  displayedSaveScope,
  setSnapshotVersion,
  params,
  setParams,
}: Options) {
  return async (rank: number) => {
    const isCurrentPage = capturePageScope()
    if (comparisonPending) throw new Error('场景仍在计算，请稍后保存。')
    if (snapshotStale) throw new Error('仓库资料已更新，请先重新搭配；尚未保存。')
    if (decisionWorld.status === 'stale')
      throw new Error('账户资料已更新，请重新分析后再保存方案。')
    const candidate = alternatives[rank - 1]?.loadouts[0]
    const candidatePlan = alternatives[rank - 1]
    if (!candidate || !candidatePlan) return
    const isCurrentGeneration = startComparisonGeneration()
    const active = () => isCurrentPage() && isCurrentGeneration()
    const discIds = candidate.discs.map((item) => item.disc.id)
    const saved = await saveCurrentAgentBuild(
      accountId,
      createComparisonSavedBuild(agentId, rank, candidateSnapshot),
    )
    if (!active()) return
    setJustSaved(saved)
    const pending = () => ({
      savedPlanId: saved.id,
      refreshPending: true as const,
      savedPlanUrl: `/development/${agentId}?plan=${encodeURIComponent(saved.id)}`,
    })
    let refreshedRank: number | null
    try {
      refreshedRank = await refreshDevelopmentCandidatesAfterSave({
        accountId,
        agentId,
        discIds,
        comparisonParameters: candidateSnapshot.candidateParametersByRank?.[rank],
        scenarioSelection:
          candidateSnapshot.scenarioSelection ?? defaultPlanningScenarioSelection32,
        eventConditionDeclarationsByAgentId: candidateSnapshot.eventConditionDeclarationsByAgentId,
        resourceGrantDeclaration32: candidateSnapshot.resourceGrantDeclaration32,
        isCurrent: active,
        refresh: decisionWorld.refresh,
        query: queryDevelopmentCandidateAlternatives,
      })
    } catch {
      return active() ? pending() : undefined
    }
    if (!active()) return
    if (refreshedRank === null) return pending()
    const refreshed = readDevelopmentCandidateSnapshot(accountId, agentId)
    if (
      refreshed &&
      contentHash([
        candidateSnapshot.candidateParametersByRank?.[rank],
        resolveSavedPlanScenarioSelection(candidateSnapshot.scenarioSelection),
        candidateSnapshot.eventConditionDeclarationsByAgentId,
        candidateSnapshot.resourceGrantDeclaration32,
      ]) ===
        contentHash([
          refreshed.candidateParametersByRank?.[refreshedRank],
          resolveSavedPlanScenarioSelection(refreshed.scenarioSelection),
          refreshed.eventConditionDeclarationsByAgentId,
          refreshed.resourceGrantDeclaration32,
        ])
    )
      setSaveRefreshScope({
        next: comparisonSaveScope(refreshed),
        previous: displayedSaveScope,
      })
    setSnapshotVersion((version) => version + 1)
    const next = new URLSearchParams(params)
    next.set('candidate', String(refreshedRank))
    setParams(next, { replace: true })
  }
}

export function createPersonalComparisonPlanSave(input: {
  client: CalculationQueryClient
  capture: PersonalDevelopmentCapture
  capturePageScope: () => () => boolean
  comparisonPending: boolean
  snapshotStale: boolean
  startComparisonGeneration: () => () => boolean
  setJustSaved: Dispatch<SetStateAction<AccountPlanningDraft | null>>
  setSaveRefreshScope: Options['setSaveRefreshScope']
  displayedSaveScope: string
  setSnapshotVersion: Options['setSnapshotVersion']
  params: URLSearchParams
  setParams: SetURLSearchParams
}) {
  return async (rank: number) => {
    const page = input.capturePageScope()
    if (input.comparisonPending) throw new Error('场景仍在计算，请稍后保存。')
    if (input.snapshotStale) throw new Error('仓库资料已更新，请先重新搭配；尚未保存。')
    const operation = input.startComparisonGeneration()
    const active = () => page() && operation()
    const candidate = input.capture.result.candidates[rank - 1]?.loadouts[0]
    if (!candidate) return
    const live = await loadPersonalDevelopmentInput()
    if (!active()) return
    if (
      !isCurrentPersonalDevelopmentCapture(input.capture, live) ||
      input.client.hasPersonalDevelopmentSession?.(input.capture.session.sessionId) === false
    )
      throw new Error('账户或仓库已变化，尚未保存。')
    const accountId = input.capture.session.accountId,
      agentId = input.capture.result.agentId
    const saved = await saveCurrentAgentBuild(
      accountId,
      createPersonalSavedBuild(agentId, rank, input.capture),
    )
    if (!active()) return
    input.setJustSaved(saved)
    const pending = () => ({
      savedPlanId: saved.id,
      refreshPending: true as const,
      savedPlanUrl: `/development/${agentId}?plan=${encodeURIComponent(saved.id)}`,
    })
    let next: Awaited<ReturnType<typeof refreshPersonalAfterSave>>
    try {
      next = await refreshPersonalAfterSave({
        client: input.client,
        capture: input.capture,
        rank,
        discIds: candidate.discs.map((row) => row.disc.id),
        isCurrent: active,
      })
    } catch {
      return active() ? pending() : undefined
    }
    if (!active()) return
    if (!next) return pending()
    if (
      contentHash([
        input.capture.result.candidateParametersByRank?.[rank],
        input.capture.result.scenarioSelection,
        input.capture.result.eventConditionDeclarationsByAgentId,
        input.capture.result.resourceGrantDeclaration32,
      ]) ===
      contentHash([
        next.capture.result.candidateParametersByRank?.[next.rank],
        next.capture.result.scenarioSelection,
        next.capture.result.eventConditionDeclarationsByAgentId,
        next.capture.result.resourceGrantDeclaration32,
      ])
    )
      input.setSaveRefreshScope({
        next: comparisonSaveScope(next.capture.result),
        previous: input.displayedSaveScope,
      })
    input.setSnapshotVersion((value) => value + 1)
    const params = new URLSearchParams(input.params)
    params.set('candidate', String(next.rank))
    input.setParams(params, { replace: true })
  }
}

/** Preserve the comparison route's selected candidate when rebuilding its view. */
export function selectComparisonCandidateRank(
  params: URLSearchParams,
  baselineComplete: boolean,
  hasCurrentPlan: boolean,
  candidateCount: number,
) {
  return params.get('candidate') === '-1' && baselineComplete && hasCurrentPlan
    ? -1
    : params.get('candidate') === '0' && (baselineComplete || hasCurrentPlan)
      ? 0
      : candidateCount
        ? Math.max(
            1,
            Math.min(Number.parseInt(params.get('candidate') ?? '1', 10) || 1, candidateCount),
          )
        : undefined
}

export function getComparisonViewIdentity(input: {
  params: URLSearchParams
  baselineComplete: boolean
  hasCurrentPlan: boolean
  candidateCount: number
  candidateSnapshot: DevelopmentComparisonSnapshot
  alias: { next: string; previous: string } | null
  snapshotStale: boolean
  staleReason?: 'input_changed' | 'session_unavailable'
}) {
  return {
    selectedCandidateRank: selectComparisonCandidateRank(
      input.params,
      input.baselineComplete,
      input.hasCurrentPlan,
      input.candidateCount,
    ),
    displayedSaveScope: displayedComparisonSaveScope(input.candidateSnapshot, input.alias),
    snapshot: {
      capturedAt: input.candidateSnapshot.capturedAt,
      stale: input.snapshotStale,
      ...(input.staleReason ? { staleReason: input.staleReason } : {}),
    },
  }
}

export function hasSixUniqueDiscs(discs: ReadonlyArray<{ id: string; slot: number }>) {
  return (
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(discs.map((disc) => disc.slot)).size === 6
  )
}
