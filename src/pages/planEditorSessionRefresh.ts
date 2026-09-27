import type { AccountDecisionRun } from '../application/calculationQueryContract'
import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'
import type { NavigateFunction } from 'react-router-dom'
import { acceptTeamOverviewPresentation } from './teamLoadoutPresentationDto'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'

export async function finishPlanEditorSave({
  kind,
  team,
  decisionWorld,
  releaseRun,
  navigate,
  setMessage,
  savedName,
}: {
  kind: 'agent' | 'team'
  team: DecisionTeamViewModel | undefined
  decisionWorld: AccountDecisionWorldContextValue
  releaseRun: (runId: string) => void
  navigate: NavigateFunction
  setMessage: (message: string) => void
  savedName: string
}) {
  if (kind === 'team' && team) {
    const refreshed = await decisionWorld.refresh()
    if (!refreshed) {
      setMessage('方案已保存，但账户分析尚未更新。请重新分析后继续调整；原方案会保留。')
      return true
    }
    if (!refreshPlanEditorSession(refreshed, releaseRun)) {
      setMessage('方案已保存，但队伍展示结果缺失或已过期。请重新分析后继续；原方案会保留。')
      return true
    }
    navigate('/loadouts/team', { replace: true })
    return true
  }
  setMessage(`已保存“${savedName}”，刷新后可以继续调整。`)
  return true
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
      fitOverviewModel: undefined,
      presentationContext: { agentId: null, planId: null, discId: null },
      overviewUiState: undefined,
      overviewModel,
    },
  })
  return true
}
