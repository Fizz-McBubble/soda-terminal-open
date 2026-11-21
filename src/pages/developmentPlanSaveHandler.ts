import type { NavigateFunction } from 'react-router-dom'
import type { Props } from './agentDevelopmentWorkbenchViewState'
import type { DevelopmentWorkbenchRouteSelection } from '../application/publicDevelopmentWorkbenchRoute'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import { createAgentDevelopmentSavedPlan } from './agentDevelopmentSavedPlan'
import {
  readDevelopmentCandidateSnapshot,
  refreshDevelopmentCandidatesAfterSave,
} from './agentDevelopmentCandidateSession'
import { rememberDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteCache'
import { contentHash } from '../application/contentHash'

type Input = Pick<
  Props,
  | 'accountId'
  | 'agentId'
  | 'agentName'
  | 'candidateSnapshotStale'
  | 'decisionWorld'
  | 'candidates'
  | 'candidateSnapshot'
  | 'workbenchData'
  | 'setSaveRefresh'
  | 'setRouteRead'
  | 'setLastRouteProjection'
  | 'setAnalysisVersion'
  | 'queryDevelopmentCandidateAlternatives'
  | 'queryDevelopmentWorkbenchRoute'
> & {
  equipment: NonNullable<Props['equipment']>
  capturePageScope: () => () => boolean
  navigate: NavigateFunction
}
export function createDevelopmentPlanSaveHandler({
  accountId,
  agentId,
  agentName,
  candidateSnapshotStale,
  decisionWorld,
  candidates,
  candidateSnapshot,
  equipment,
  workbenchData,
  setSaveRefresh,
  setRouteRead,
  setLastRouteProjection,
  setAnalysisVersion,
  queryDevelopmentCandidateAlternatives,
  queryDevelopmentWorkbenchRoute,
  capturePageScope,
  navigate,
}: Input) {
  return async (candidateRank: number) => {
    const isCurrentPage = capturePageScope()
    if (decisionWorld.status === 'stale' || candidateSnapshotStale)
      throw new Error('仓库或账户资料已更新，请先重新匹配；尚未保存。')
    const candidateIndex = candidateRank - 1
    const candidatePlan = candidates[candidateIndex]
    const candidate = candidatePlan?.loadouts[0]
    if (!candidate || candidate.discs.length !== 6)
      throw new Error('所选仓库方案不可用，请重新匹配后再保存。')
    const discIds = candidate.discs.map((item) => item.disc.id)
    setSaveRefresh({ accountId, agentId, presentation: workbenchData })
    const saved = await saveCurrentAgentBuild(
      accountId,
      createAgentDevelopmentSavedPlan({
        agentId,
        agentName,
        candidatePlan,
        candidateSnapshot,
        candidateIndex,
        equipment,
      }),
    ).catch((error: unknown) => {
      if (isCurrentPage()) setSaveRefresh(null)
      throw error
    })
    if (!isCurrentPage()) return
    try {
      const refreshedRank = await refreshDevelopmentCandidatesAfterSave({
        accountId,
        agentId,
        discIds,
        comparisonParameters: candidateSnapshot?.candidateParametersByRank?.[candidateRank],
        scenarioSelection: candidateSnapshot?.scenarioSelection,
        eventConditionDeclarationsByAgentId: candidateSnapshot?.eventConditionDeclarationsByAgentId,
        resourceGrantDeclaration32: candidateSnapshot?.resourceGrantDeclaration32,
        isCurrent: isCurrentPage,
        refresh: decisionWorld.refresh,
        query: queryDevelopmentCandidateAlternatives,
      })
      if (!isCurrentPage()) return
      if (refreshedRank === null) throw new Error('方案已保存，匹配结果暂未更新。')
      try {
        const snapshot = readDevelopmentCandidateSnapshot(accountId, agentId)
        const loadout = snapshot?.candidates[refreshedRank - 1]?.loadouts[0]
        if (!snapshot || !loadout) throw new Error('方案已保存，匹配结果暂未更新。')
        const selection: DevelopmentWorkbenchRouteSelection = {
          agentId,
          requestedPlanId: null,
          candidateRank: refreshedRank,
          candidateLoadoutFingerprint: contentHash(loadout),
        }
        const projection = await queryDevelopmentWorkbenchRoute(snapshot.runId, selection)
        if (!isCurrentPage()) return
        const key = contentHash([snapshot.runId, snapshot.inputFingerprint, selection])
        rememberDevelopmentWorkbenchRoute(key, projection)
        setRouteRead({ key, value: projection })
        setLastRouteProjection({ accountId, agentId, value: projection })
      } catch (error) {
        if (isCurrentPage()) setSaveRefresh(null)
        throw error
      }
      setSaveRefresh(null)
      setAnalysisVersion((version) => version + 1)
      navigate(`/development/${agentId}?candidate=${refreshedRank}`, {
        replace: true,
        state: { preserveWorkbenchPosition: true },
      })
    } catch {
      if (!isCurrentPage()) return
      setSaveRefresh(null)
      return { savedPlanId: saved.id, refreshPending: true as const }
    }
  }
}
