import { contentHash } from '../application/contentHash'
import { playerErrorMessage } from '../application/playerErrorMessage'
import {
  isCurrentDevelopmentWorkbenchRoute,
  developmentCurrentRecordAgent,
  developmentCurrentRecordBinding,
} from '../application/publicDevelopmentWorkbenchRoute'
import type { DevelopmentWorkbenchRoutePresentation } from '../application/publicDevelopmentWorkbenchRoute'
import { developmentPanelDiscFingerprint } from '../application/publicDevelopmentComparisonPanels'
import {
  developmentAnalysisRecoveryDisplay,
  developmentCommittedCurrentDisplay,
  developmentCommittedCurrentDisplayFailure,
} from './developmentCommittedCurrentDisplay'
import { rememberDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteCache'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { Props } from './agentDevelopmentWorkbenchViewState'

type CurrentRecordRefreshInput = Pick<
  Props,
  | 'accountId'
  | 'agentId'
  | 'requestedPlanId'
  | 'facts'
  | 'candidates'
  | 'decisionWorld'
  | 'queryDevelopmentWorkbenchRoute'
  | 'setEditingCurrent'
  | 'setEditingPresentation'
  | 'setSaveRefresh'
  | 'setRouteRead'
  | 'setLastRouteProjection'
> & {
  displayedWorkbenchData: GoldenWorkbenchData
  capturePageScope: () => () => boolean
}
export function createDevelopmentCurrentRecordRefresh({
  accountId,
  agentId,
  requestedPlanId,
  facts,
  candidates,
  decisionWorld,
  queryDevelopmentWorkbenchRoute,
  setEditingCurrent,
  setEditingPresentation,
  setSaveRefresh,
  setRouteRead,
  setLastRouteProjection,
  displayedWorkbenchData,
  capturePageScope,
}: CurrentRecordRefreshInput) {
  return async function refreshSavedCurrentRecord(savedRoster: Props['roster']) {
    const isCurrentPage = capturePageScope()
    // The database save has committed. Release the edit snapshot now so
    // live account facts can update while the full analysis is pending.
    setEditingCurrent(false)
    setEditingPresentation(null)
    const savedAgent = savedRoster.agents.find((agent) => agent.agentId === agentId)
    if (!savedAgent) throw new Error('代理人资料保存后未能重新读取。')
    let committedPresentation = developmentAnalysisRecoveryDisplay(
      displayedWorkbenchData,
      'updating',
    )
    let refreshStage: 'panel' | 'account' = 'panel'
    setSaveRefresh({
      accountId,
      agentId,
      kind: 'current_record',
      phase: 'updating',
      stage: refreshStage,
      record: savedAgent,
      presentation: committedPresentation,
    })
    const selection = {
      agentId,
      requestedPlanId,
      candidateRank: null,
      candidateLoadoutFingerprint: null,
    }
    try {
      committedPresentation = developmentCommittedCurrentDisplay(displayedWorkbenchData, savedAgent)
      setSaveRefresh({
        accountId,
        agentId,
        kind: 'current_record',
        phase: 'updating',
        stage: refreshStage,
        record: savedAgent,
        presentation: committedPresentation,
      })
      const currentAgent = developmentCurrentRecordAgent(savedAgent)
      const record = {
        accountId,
        agent: currentAgent,
        revision: contentHash(currentAgent),
        selectedDiscIds: displayedWorkbenchData.discs.map((disc) => disc.id),
      }
      if (facts?.enabled && candidates.length === 0) {
        const panel = await facts.readCurrentRecord(record)
        if (!isCurrentPage()) return
        if (
          panel.status !== 'ready' ||
          panel.currentRecordBinding !== developmentCurrentRecordBinding(record)
        )
          throw new Error('资料已保存，但当前面板暂未更新，请稍后重试。')
        committedPresentation = developmentCommittedCurrentDisplay(
          displayedWorkbenchData,
          savedAgent,
          panel as unknown as DevelopmentWorkbenchRoutePresentation,
        )
        setSaveRefresh({
          accountId,
          agentId,
          kind: 'current_record',
          phase: 'updating',
          stage: 'panel',
          record: savedAgent,
          presentation: committedPresentation,
        })
        return
      }
      const panelRun =
        (decisionWorld.analysisIssue?.kind !== 'run_lost' ? decisionWorld.run : null) ??
        (await decisionWorld.refresh())
      if (!isCurrentPage()) return
      if (!panelRun || panelRun.input.warehouse.accountId !== accountId)
        throw new Error('当前面板暂未更新。')
      // Refresh only this saved record's panel in the existing Worker run,
      // before queueing the much larger account-wide analysis.
      const currentPanel = await queryDevelopmentWorkbenchRoute(panelRun.runId, selection, record)
      if (!isCurrentPage()) return
      if (
        currentPanel.currentRecordBinding !== developmentCurrentRecordBinding(record) ||
        !isCurrentDevelopmentWorkbenchRoute(
          { ...currentPanel, currentRecordBinding: undefined },
          {
            runId: panelRun.runId,
            accountId,
            inputFingerprint: panelRun.inputFingerprint,
            selection,
            selectedDiscs: panelRun.input.warehouse.discs.filter((disc) =>
              record.selectedDiscIds.includes(disc.id),
            ),
          },
          developmentPanelDiscFingerprint,
        )
      )
        throw new Error('资料已保存，但当前面板暂未更新，请稍后重试。')
      committedPresentation = developmentCommittedCurrentDisplay(
        displayedWorkbenchData,
        savedAgent,
        currentPanel,
      )
      refreshStage = 'account'
      setSaveRefresh({
        accountId,
        agentId,
        kind: 'current_record',
        phase: 'updating',
        stage: refreshStage,
        record: savedAgent,
        presentation: committedPresentation,
      })
      const refreshed = await decisionWorld.refresh()
      if (!isCurrentPage()) return
      if (!refreshed) throw new Error('资料已保存，但养成资料暂未更新，请稍后重试。')
      const projection = await queryDevelopmentWorkbenchRoute(refreshed.runId, selection)
      if (!isCurrentPage()) return
      const key = contentHash([refreshed.runId, refreshed.inputFingerprint, selection])
      rememberDevelopmentWorkbenchRoute(key, projection)
      setRouteRead({ key, value: projection })
      setLastRouteProjection({ accountId, agentId, value: projection })
      setSaveRefresh(null)
    } catch (error) {
      if (isCurrentPage())
        setSaveRefresh({
          accountId,
          agentId,
          kind: 'current_record',
          phase: 'failed',
          stage: refreshStage,
          record: savedAgent,
          presentation: developmentCommittedCurrentDisplayFailure(committedPresentation),
          error: `资料已保存。${playerErrorMessage(error, '更新暂未完成，请稍后重试。')}`,
        })
    }
  }
}
