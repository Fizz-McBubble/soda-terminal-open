import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import { contentHash } from '../application/contentHash'
import {
  useAccountDecisionWorld,
  useDevelopmentCandidateAlternativesCalculation,
  useDevelopmentWorkbenchRouteCalculation,
} from '../application/accountDecisionWorld'
import { findCurrentDevelopmentWorkbenchEquipment } from '../application/publicDevelopmentWorkbenchPresentation'
import type {
  DevelopmentWorkbenchRoutePresentation,
  DevelopmentWorkbenchRouteSelection,
} from '../application/publicDevelopmentWorkbenchRoute'
import {
  AgentDevelopmentGolden,
  type GoldenWorkbenchData,
} from '../features/agentDevelopmentGolden'
import { AgentDevelopmentCurrentEditor } from './AgentDevelopmentCurrentEditor'
import {
  cacheDevelopmentCandidateSnapshot,
  readDevelopmentCandidateSnapshot,
  refreshDevelopmentCandidatesAfterSave,
} from './agentDevelopmentCandidateSession'
import { createAgentDevelopmentSavedPlan } from './agentDevelopmentSavedPlan'
import { rememberDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteCache'

type CandidateSnapshot = NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>
type EditingPresentation = { accountId: string; presentation: GoldenWorkbenchData }
type SaveRefresh = EditingPresentation & { agentId: string }
type RouteRead = { key: string; value: DevelopmentWorkbenchRoutePresentation }
type RouteProjection = {
  accountId: string
  agentId: string
  value: DevelopmentWorkbenchRoutePresentation
}

type Props = {
  agentId: string
  accountId: string
  agentName: string
  roster: ComponentProps<typeof AgentDevelopmentCurrentEditor>['roster']
  workbenchData: GoldenWorkbenchData
  savingThisAgent: boolean
  editingThisAgent: boolean
  candidateSnapshotStale: boolean
  retainingDuringSave: boolean
  saveRefresh: SaveRefresh | null
  editingPresentation: EditingPresentation | null
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  queryDevelopmentCandidateAlternatives: ReturnType<
    typeof useDevelopmentCandidateAlternativesCalculation
  >
  queryDevelopmentWorkbenchRoute: ReturnType<typeof useDevelopmentWorkbenchRouteCalculation>
  candidates: CandidateSnapshot['candidates']
  candidateSnapshot: CandidateSnapshot | null
  equipment: ReturnType<typeof findCurrentDevelopmentWorkbenchEquipment>
  requestedPlanId: string | null
  setAnalysisVersion: Dispatch<SetStateAction<number>>
  setEditingPresentation: Dispatch<SetStateAction<EditingPresentation | null>>
  setEditingCurrent: Dispatch<SetStateAction<boolean>>
  setSaveRefresh: Dispatch<SetStateAction<SaveRefresh | null>>
  setRouteRead: Dispatch<SetStateAction<RouteRead | null>>
  setLastRouteProjection: Dispatch<SetStateAction<RouteProjection | null>>
}

export function AgentDevelopmentWorkbenchView({
  agentId,
  accountId,
  agentName,
  roster,
  workbenchData,
  savingThisAgent,
  editingThisAgent,
  candidateSnapshotStale,
  retainingDuringSave,
  saveRefresh,
  editingPresentation,
  decisionWorld,
  queryDevelopmentCandidateAlternatives,
  queryDevelopmentWorkbenchRoute,
  candidates,
  candidateSnapshot,
  equipment,
  requestedPlanId,
  setAnalysisVersion,
  setEditingPresentation,
  setEditingCurrent,
  setSaveRefresh,
  setRouteRead,
  setLastRouteProjection,
}: Props) {
  const navigate = useNavigate()
  return (
    <>
      <AgentDevelopmentGolden
        onEditCurrent={
          savingThisAgent
            ? undefined
            : () => {
                setEditingPresentation({ accountId, presentation: workbenchData })
                setEditingCurrent(true)
              }
        }
        onContinueOptimization={() => navigate(`/development/${agentId}`)}
        initialView="workbench"
        scenario={
          savingThisAgent || editingThisAgent
            ? undefined
            : candidateSnapshotStale
              ? 'stale'
              : undefined
        }
        workbench={
          savingThisAgent
            ? (saveRefresh?.presentation ?? workbenchData)
            : editingThisAgent
              ? (editingPresentation?.presentation ?? workbenchData)
              : workbenchData
        }
        onNavigate={(view) =>
          navigate(view === 'overview' ? '/development' : `/development/${agentId}/loadouts`)
        }
        onAnalyzeWarehouse={
          savingThisAgent || retainingDuringSave
            ? undefined
            : async () => {
                const currentRun =
                  decisionWorld.status === 'current'
                    ? decisionWorld.run
                    : await decisionWorld.refresh()
                if (!currentRun) throw new Error('当前账户无法重新分析；请稍后重试。')
                const result = await queryDevelopmentCandidateAlternatives(
                  currentRun.runId,
                  agentId,
                )
                if (!cacheDevelopmentCandidateSnapshot(result))
                  throw new Error(result.gaps[0] ?? '当前账户无法生成完整的六张候选盘。')
                setAnalysisVersion((version) => version + 1)
              }
        }
        onSavePlan={
          candidateSnapshotStale || savingThisAgent || retainingDuringSave || !equipment
            ? undefined
            : async (candidateRank) => {
                if (decisionWorld.status === 'stale' || candidateSnapshotStale)
                  throw new Error('仓库或账户资料已更新，请先重新匹配；尚未保存。')
                const candidateIndex = candidateRank - 1
                const candidatePlan = candidates[candidateIndex]
                const candidate = candidatePlan?.loadouts[0]
                if (!candidate || candidate.discs.length !== 6)
                  throw new Error('所选仓库方案不可用，请重新匹配后再保存。')
                const discIds = candidate.discs.map((item) => item.disc.id)
                setSaveRefresh({ accountId, agentId, presentation: workbenchData })
                await saveCurrentAgentBuild(
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
                  setSaveRefresh(null)
                  throw error
                })
                const refreshedRank = await refreshDevelopmentCandidatesAfterSave({
                  accountId,
                  agentId,
                  discIds,
                  refresh: decisionWorld.refresh,
                  query: queryDevelopmentCandidateAlternatives,
                }).catch((error: unknown) => {
                  setSaveRefresh(null)
                  throw error
                })
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
                  const key = contentHash([snapshot.runId, snapshot.inputFingerprint, selection])
                  rememberDevelopmentWorkbenchRoute(key, projection)
                  setRouteRead({ key, value: projection })
                  setLastRouteProjection({ accountId, agentId, value: projection })
                } catch (error) {
                  setSaveRefresh(null)
                  throw error
                }
                setSaveRefresh(null)
                setAnalysisVersion((version) => version + 1)
                navigate(`/development/${agentId}?candidate=${refreshedRank}`, {
                  replace: true,
                  state: { preserveWorkbenchPosition: true },
                })
              }
        }
      />
      {editingThisAgent && (
        <AgentDevelopmentCurrentEditor
          key={`${accountId}:${agentId}`}
          accountId={accountId}
          agentId={agentId}
          roster={roster}
          onCancel={() => setEditingCurrent(false)}
          onSaved={async () => {
            const refreshed = await decisionWorld.refresh()
            if (!refreshed) throw new Error('资料已保存，但养成资料暂未更新，请稍后重试。')
            const selection = {
              agentId,
              requestedPlanId,
              candidateRank: null,
              candidateLoadoutFingerprint: null,
            }
            const projection = await queryDevelopmentWorkbenchRoute(refreshed.runId, selection)
            const key = contentHash([refreshed.runId, refreshed.inputFingerprint, selection])
            rememberDevelopmentWorkbenchRoute(key, projection)
            setRouteRead({ key, value: projection })
            setEditingCurrent(false)
          }}
        />
      )}
    </>
  )
}
