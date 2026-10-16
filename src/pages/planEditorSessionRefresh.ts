import type { AccountDecisionRun } from '../application/calculationQueryContract'
import { useEffect } from 'react'
import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'
import type { NavigateFunction } from 'react-router-dom'
import { acceptTeamOverviewPresentation } from './teamLoadoutPresentationDto'
import {
  currentTeamAnalysisSession,
  setCurrentTeamAnalysisSession,
  type LastCompleteAnalysis,
  type TeamAnalysisState,
} from './teamAnalysisSession'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'

// A display-only UI update may replace the session wrapper; its captured snapshot remains stable.
const savedRefreshSnapshots = new WeakSet<AccountDecisionRun['snapshot']>()

export function useSavedPlanEditorRefresh({
  analysis,
  account,
  world,
  releaseRun,
  setAnalysis,
  setLastCompleteAnalysis,
}: {
  analysis: TeamAnalysisState
  account: { accountId: string | null; appSessionId: string; hydrating: boolean } | null
  world: AccountDecisionWorldContextValue
  releaseRun: (runId: string) => void
  setAnalysis: (next: LastCompleteAnalysis) => void
  setLastCompleteAnalysis: (next: LastCompleteAnalysis) => void
}) {
  useEffect(() => {
    if (
      analysis.kind !== 'stale' ||
      !account?.accountId ||
      account.hydrating ||
      world.status !== 'current' ||
      world.calculationCancelled ||
      world.liveFingerprint !== world.run.inputFingerprint
    )
      return
    const next = adoptSavedPlanEditorRefresh(
      analysis,
      world.run,
      {
        accountId: account.accountId,
        appSessionId: account.appSessionId,
        liveFingerprint: world.liveFingerprint,
      },
      releaseRun,
    )
    if (next) {
      setAnalysis(next)
      setLastCompleteAnalysis(next)
    }
  }, [analysis, account, world, releaseRun, setAnalysis, setLastCompleteAnalysis])
}

export async function finishPlanEditorSave({
  kind,
  team,
  decisionWorld,
  navigate,
  setMessage,
  savedName,
  isCurrentSave = () => true,
  appSessionId,
}: {
  kind: 'agent' | 'team'
  team: DecisionTeamViewModel | undefined
  decisionWorld: AccountDecisionWorldContextValue
  releaseRun: (runId: string) => void
  navigate: NavigateFunction
  setMessage: (message: string) => void
  savedName: string
  isCurrentSave?: () => boolean
  appSessionId?: string
}) {
  if (!isCurrentSave()) return true // The write completed, but its originating page has left.
  if (kind === 'team' && team) {
    const previous = currentTeamAnalysisSession
    if (
      previous &&
      previous.result.appSessionId === appSessionId &&
      previous.result.warehouse.accountId === decisionWorld.run?.input.warehouse.accountId
    ) {
      savedRefreshSnapshots.add(previous.result.decisionSnapshot)
      setCurrentTeamAnalysisSession({ kind: 'stale', result: previous.result })
    }
    // Refresh reserves its existing cancellation generation synchronously. Never await it to navigate,
    // or update the departed editor from its result. TeamPicker adopts only a current matching run.
    void decisionWorld.refresh().then(
      (refreshed) => {
        if (!refreshed && previous) savedRefreshSnapshots.delete(previous.result.decisionSnapshot)
      },
      () => {
        if (previous) savedRefreshSnapshots.delete(previous.result.decisionSnapshot)
      },
    )
    navigate('/loadouts/team', { replace: true })
    return true
  }
  setMessage(`已保存“${savedName}”，刷新后可以继续调整。`)
  return true
}

/** Called by the visible picker, so a new analysis, account switch or cancellation cannot be replaced. */
export function adoptSavedPlanEditorRefresh(
  expected: LastCompleteAnalysis,
  refreshed: AccountDecisionRun,
  account: { accountId: string; appSessionId: string; liveFingerprint: string },
  releaseRun: (runId: string) => void,
) {
  const current = currentTeamAnalysisSession
  if (
    expected.kind !== 'stale' ||
    !savedRefreshSnapshots.has(expected.result.decisionSnapshot) ||
    current?.kind !== 'stale' ||
    current.result.decisionSnapshot !== expected.result.decisionSnapshot ||
    current.result.analysisRunId !== expected.result.analysisRunId ||
    current.result.sourceRunId !== expected.result.sourceRunId ||
    current.result.inputFingerprint !== expected.result.inputFingerprint ||
    current.result.appSessionId !== account.appSessionId ||
    expected.result.appSessionId !== account.appSessionId ||
    current.result.warehouse.accountId !== account.accountId ||
    refreshed.input.warehouse.accountId !== account.accountId ||
    refreshed.inputFingerprint !== account.liveFingerprint ||
    refreshed.snapshot.fingerprint.inputHash !== account.liveFingerprint ||
    refreshed.runId === expected.result.analysisRunId ||
    refreshed.runId === expected.result.sourceRunId
  )
    return null
  if (!refreshPlanEditorSession(refreshed, releaseRun)) return null
  savedRefreshSnapshots.delete(expected.result.decisionSnapshot)
  return currentTeamAnalysisSession
}

/** Replace the captured run after a successful save so later team queries use current facts. */
export function refreshPlanEditorSession(
  refreshed: AccountDecisionRun,
  releaseRun: (runId: string) => void,
) {
  if (!currentTeamAnalysisSession) return true
  const overviewModel = acceptTeamOverviewPresentation(refreshed.teamPresentation, {
    runId: refreshed.runId,
    accountId: refreshed.input.warehouse.accountId ?? '',
    inputFingerprint: refreshed.snapshot.fingerprint.inputHash,
    agentId: null,
    planId: null,
    discId: null,
  })?.overviewModel
  if (!overviewModel) return false
  const previous = currentTeamAnalysisSession.result
  if (previous.sourceRunId && previous.analysisRunId !== refreshed.runId)
    releaseRun(previous.analysisRunId)
  setCurrentTeamAnalysisSession({
    kind: 'complete',
    result: {
      ...previous,
      sourceRunId: undefined,
      reservations: undefined,
      analysisRunId: refreshed.runId,
      warehouse: refreshed.input.warehouse,
      decisionSnapshot: refreshed.snapshot,
      capturedAt: new Date(refreshed.capturedAt),
      inputFingerprint: refreshed.snapshot.fingerprint.inputHash,
      targetTeamFits: {},
      teamRoutePresentations: undefined,
      fitOverviewModel: undefined,
      presentationContext: { agentId: null, planId: null, discId: null },
      overviewModel,
    },
  })
  return true
}
