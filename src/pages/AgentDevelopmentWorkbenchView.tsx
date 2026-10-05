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
import { isCurrentDevelopmentWorkbenchRoute } from '../application/publicDevelopmentWorkbenchRoute'
import { developmentPanelDiscFingerprint } from '../application/publicDevelopmentComparisonPanels'
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
import { usePageOperationScope } from '../components/usePageOperationScope'

type CandidateSnapshot = NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>
type EditingPresentation = { accountId: string; presentation: GoldenWorkbenchData }
type SaveRefresh = EditingPresentation & { agentId: string }
type WarehouseRefresh = SaveRefresh & { inputFingerprint: string | null }
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
  selectedCandidateRank: number
  setAnalysisVersion: Dispatch<SetStateAction<number>>
  setWarehouseRefresh: Dispatch<SetStateAction<WarehouseRefresh | null>>
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
  selectedCandidateRank,
  setAnalysisVersion,
  setWarehouseRefresh,
  setEditingPresentation,
  setEditingCurrent,
  setSaveRefresh,
  setRouteRead,
  setLastRouteProjection,
}: Props) {
  const navigate = useNavigate()
  const capturePageScope = usePageOperationScope(
    JSON.stringify([accountId, agentId, requestedPlanId]),
  )
  const captureAnalysisScope = usePageOperationScope(
    JSON.stringify([
      accountId,
      agentId,
      requestedPlanId,
      selectedCandidateRank,
      decisionWorld.liveFingerprint,
    ]),
  )
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
                const isCurrentPage = capturePageScope()
                const isCurrentAnalysis = captureAnalysisScope()
                const canContinue = () => {
                  if (!isCurrentPage()) return false
                  if (!isCurrentAnalysis())
                    throw new Error('仓库或配装选择已变化，请重新搭配；尚未保存。')
                  return true
                }
                setWarehouseRefresh({
                  accountId,
                  agentId,
                  inputFingerprint: decisionWorld.liveFingerprint,
                  presentation: workbenchData,
                })
                let published = false
                try {
                  const currentRun =
                    decisionWorld.status === 'current'
                      ? decisionWorld.run
                      : await decisionWorld.refresh()
                  if (!canContinue()) return
                  if (!currentRun) throw new Error('当前账户无法重新分析；请稍后重试。')
                  const result = await queryDevelopmentCandidateAlternatives(
                    currentRun.runId,
                    agentId,
                  )
                  if (!canContinue()) return
                  if (
                    result.status !== 'ready' ||
                    result.accountId !== accountId ||
                    result.agentId !== agentId ||
                    result.runId !== currentRun.runId ||
                    result.inputFingerprint !== currentRun.inputFingerprint
                  )
                    throw new Error(result.gaps[0] ?? '当前账户无法生成完整的六张候选盘。')
                  const index = Math.min(
                    selectedCandidateRank - 1,
                    Math.max(result.candidates.length - 1, 0),
                  )
                  const loadout = requestedPlanId
                    ? undefined
                    : result.candidates[index]?.loadouts[0]
                  const selection: DevelopmentWorkbenchRouteSelection = {
                    agentId,
                    requestedPlanId,
                    candidateRank: loadout ? index + 1 : null,
                    candidateLoadoutFingerprint: loadout ? contentHash(loadout) : null,
                  }
                  // Prepare the matching panel before publishing its candidate. Publishing
                  // first changes the route key and replaces the whole workbench with loading.
                  const projection = await queryDevelopmentWorkbenchRoute(
                    currentRun.runId,
                    selection,
                  )
                  if (!canContinue()) return
                  const selectedIds =
                    loadout?.discs.map((choice) => choice.disc.id) ??
                    workbenchData.discs.map((disc) => disc.id)
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
                  if (!cacheDevelopmentCandidateSnapshot(result))
                    throw new Error(result.gaps[0] ?? '当前账户无法生成完整的六张候选盘。')
                  const key = contentHash([
                    currentRun.runId,
                    currentRun.inputFingerprint,
                    selection,
                  ])
                  rememberDevelopmentWorkbenchRoute(key, projection)
                  setRouteRead({ key, value: projection })
                  setLastRouteProjection({ accountId, agentId, value: projection })
                  setAnalysisVersion((version) => version + 1)
                  published = true
                } catch (error) {
                  if (isCurrentPage()) throw error
                } finally {
                  // A refreshed run can still be waiting for its default route. Keep
                  // the same-input view available after failure so the error stays local.
                  if (isCurrentPage() && (published || !isCurrentAnalysis()))
                    setWarehouseRefresh(null)
                }
              }
        }
        onSavePlan={
          candidateSnapshotStale || savingThisAgent || retainingDuringSave || !equipment
            ? undefined
            : async (candidateRank) => {
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
                  if (isCurrentPage()) setSaveRefresh(null)
                  throw error
                })
                if (!isCurrentPage()) return
                const refreshedRank = await refreshDevelopmentCandidatesAfterSave({
                  accountId,
                  agentId,
                  discIds,
                  refresh: decisionWorld.refresh,
                  query: queryDevelopmentCandidateAlternatives,
                }).catch((error: unknown) => {
                  if (isCurrentPage()) setSaveRefresh(null)
                  throw error
                })
                if (!isCurrentPage()) return
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
            const isCurrentPage = capturePageScope()
            const refreshed = await decisionWorld.refresh()
            if (!isCurrentPage()) return
            if (!refreshed) throw new Error('资料已保存，但养成资料暂未更新，请稍后重试。')
            const selection = {
              agentId,
              requestedPlanId,
              candidateRank: null,
              candidateLoadoutFingerprint: null,
            }
            const projection = await queryDevelopmentWorkbenchRoute(refreshed.runId, selection)
            if (!isCurrentPage()) return
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
