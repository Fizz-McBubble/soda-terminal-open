import { DevelopmentComparisonConditions } from './DevelopmentComparisonConditions'
import { hasDevelopmentComparisonConditions } from './developmentComparisonConditionAvailability'
import { normalizeReviewedEventConditionDeclarations32 } from '../calculation/reviewedEventConditionDeclarations32'
import type { AgentDevelopmentGoldenProps } from '../features/agentDevelopmentGolden/types'
import { matchPersonalWorkbench } from './personalWorkbenchMatch'
import { createPersonalWorkbenchSave } from './personalWorkbenchSave'
import { createDevelopmentCurrentRecordRefresh } from './developmentCurrentRecordRefresh'
import { useWorkbenchSaveFeedback } from './useWorkbenchSaveFeedback'
import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { CalculationQueryClientContext } from '../application/accountDecisionWorldHooks'
import { readSavedAgentComparisonContext } from '../application/readSavedAgentComparisonContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { contentHash } from '../application/contentHash'
import { developmentRefreshNotice } from './agentDevelopmentRefreshPresentation'
import { AgentDevelopmentGolden } from '../features/agentDevelopmentGolden'
import { AgentDevelopmentCurrentEditor } from './AgentDevelopmentCurrentEditor'
import { usePageOperationScope } from '../components/usePageOperationScope'
import type { Props } from './agentDevelopmentWorkbenchViewState'
import type { WarehouseAnalysisIntent } from '../features/agentDevelopmentGolden'
import { developmentWorkbenchFactsFingerprint } from '../application/publicDevelopmentWorkbenchFacts'
import { runDecisionWorldWorkbenchAnalysis } from './workbenchWarehouseAnalysis'
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
  analysisRefresh,
  saveRefresh,
  editingPresentation,
  decisionWorld,
  queryDevelopmentCandidateAlternatives,
  queryDevelopmentWorkbenchRoute,
  facts,
  candidates,
  candidateSnapshot,
  personalCapture,
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
  const personalClient = useContext(CalculationQueryClientContext)
  const location = useLocation()
  const currentEditReturnFocus = useRef<HTMLElement | null>(null)
  const candidateQueryAbort = useRef<AbortController | null>(null)
  const factsRequest = facts?.request
  const latestFactsRequest = useRef(factsRequest)
  useLayoutEffect(() => {
    latestFactsRequest.current = factsRequest
  }, [factsRequest])
  useEffect(
    () => () => {
      candidateQueryAbort.current?.abort()
      candidateQueryAbort.current = null
    },
    [],
  )
  const capturePageScope = usePageOperationScope(
    JSON.stringify([accountId, agentId, requestedPlanId]),
  )
  const captureAnalysisScope = usePageOperationScope(
    JSON.stringify([
      accountId,
      agentId,
      requestedPlanId,
      selectedCandidateRank,
      facts?.request
        ? developmentWorkbenchFactsFingerprint(facts.request)
        : decisionWorld.liveFingerprint,
    ]),
  )
  const currentRecordRefresh =
    saveRefresh?.kind === 'current_record' &&
    saveRefresh.accountId === accountId &&
    saveRefresh.agentId === agentId
      ? saveRefresh
      : null
  const saveRefreshNotice = currentRecordRefresh
    ? developmentRefreshNotice({
        stage: currentRecordRefresh.stage ?? 'panel',
        phase: currentRecordRefresh.phase ?? 'updating',
        error: currentRecordRefresh.error,
      })
    : null
  const analysisRefreshNotice =
    !currentRecordRefresh && analysisRefresh
      ? developmentRefreshNotice({
          stage: 'analysis',
          phase: analysisRefresh.phase,
          error: analysisRefresh.error,
        })
      : null
  const displayedWorkbenchData =
    currentRecordRefresh?.presentation ??
    (savingThisAgent
      ? saveRefresh?.presentation
      : editingThisAgent
        ? editingPresentation?.presentation
        : null) ??
    workbenchData
  const navigateForView = (view: 'overview' | 'workbench' | 'top10') => {
    if (view === 'overview') {
      navigate('/development')
      return
    }
    if (view === 'workbench') {
      navigate(
        requestedPlanId
          ? `/development/${agentId}?plan=${encodeURIComponent(requestedPlanId)}`
          : `/development/${agentId}?candidate=${workbenchData.selectedCandidateRank}`,
      )
      return
    }
    navigate(
      requestedPlanId
        ? `/development/${agentId}/loadouts`
        : `/development/${agentId}/loadouts?candidate=${workbenchData.selectedCandidateRank}`,
    )
  }
  const refreshSavedCurrentRecord = createDevelopmentCurrentRecordRefresh({
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
  })

  const { displayedSaveScope, onSavePlan } = useWorkbenchSaveFeedback({
    requestedPlanId,
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
    savingThisAgent,
    retainingDuringSave,
  })
  const savePersonalPlan = createPersonalWorkbenchSave({
    personalCapture,
    personalClient,
    candidateSnapshotStale,
    savingThisAgent,
    retainingDuringSave,
    accountId,
    agentId,
    workbenchData,
    setSaveRefresh,
    setAnalysisVersion,
    capturePageScope,
    navigate,
  })
  const analyzeWarehouse: AgentDevelopmentGoldenProps['onAnalyzeWarehouse'] =
    savingThisAgent || retainingDuringSave
      ? undefined
      : async (
          intent: WarehouseAnalysisIntent = 'generate',
          requestedParameters,
          requestedDeclarations,
        ) => {
          const comparisonRouteReady =
            intent === 'compare'
              ? import('./AgentLoadoutComparisonPage').catch(() => null)
              : Promise.resolve(null)
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
            inFlight: true,
            presentation: workbenchData,
          })
          candidateQueryAbort.current?.abort()
          const candidateController = new AbortController()
          candidateQueryAbort.current = candidateController
          let published = false
          try {
            const personalStatus = await matchPersonalWorkbench({
              client: personalClient,
              accountId,
              agentId,
              requestedPlanId,
              selectedRank: selectedCandidateRank,
              requestedParameters,
              requestedDeclarations,
              mode: intent,
              signal: candidateController.signal,
              canContinue,
              setAnalysisVersion,
            })
            if (personalStatus !== 'unsupported') {
              published = personalStatus === 'published'
              const search = new URLSearchParams(location.search)
              if (
                published &&
                intent === 'generate' &&
                !requestedPlanId &&
                search.get('candidate') === '0'
              ) {
                search.set('candidate', '1')
                navigate(
                  { pathname: location.pathname, search: search.toString(), hash: location.hash },
                  { replace: true },
                )
              }
              return
            }
            published = await runDecisionWorldWorkbenchAnalysis({
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
              signal: candidateController.signal,
              canContinue,
              setRouteRead,
              setLastRouteProjection,
              setAnalysisVersion,
              locationSearch: location.search,
              navigate,
            })
          } catch (error) {
            if (isCurrentPage()) throw error
          } finally {
            // A refreshed run can still be waiting for its default route. Keep
            // the same-input view available after failure so the error stays local.
            if (candidateQueryAbort.current === candidateController) {
              candidateQueryAbort.current = null
              if (isCurrentPage()) {
                if (published || candidateController.signal.aborted) setWarehouseRefresh(null)
                else if (!isCurrentAnalysis()) {
                  const retainUntilFacts = latestFactsRequest.current
                  setWarehouseRefresh((capture) =>
                    capture && retainUntilFacts
                      ? { ...capture, inFlight: false, retainUntilFacts }
                      : null,
                  )
                } else {
                  setWarehouseRefresh((capture) =>
                    capture ? { ...capture, inFlight: false } : null,
                  )
                }
              }
            }
          }
        }
  const cancelWarehouseAnalysis = () => {
    if (!candidateQueryAbort.current) return
    candidateQueryAbort.current.abort()
    candidateQueryAbort.current = null
    setWarehouseRefresh(null)
  }
  const comparisonContext = personalCapture?.result ?? candidateSnapshot
  const conditionPlan = requestedPlanId
    ? (personalCapture?.input.drafts ?? decisionWorld.run?.input.drafts ?? []).find(
        (plan) => plan.id === requestedPlanId && plan.accountId === accountId,
      )
    : undefined
  const savedConditions = conditionPlan
    ? readSavedAgentComparisonContext(conditionPlan, agentId).eventDeclarations
    : undefined
  const declarations = normalizeReviewedEventConditionDeclarations32(
    conditionPlan && personalCapture?.contextPlanId !== requestedPlanId
      ? savedConditions?.state === 'recorded'
        ? savedConditions.value.declarations
        : undefined
      : comparisonContext?.eventConditionDeclarationsByAgentId,
    [agentId],
  )
  const currentAgent = roster.agents.find((agent) => agent.agentId === agentId)
  const engineIds = [
    currentAgent?.wEngineDetails.id,
    displayedWorkbenchData.comparisonTarget?.wEngine?.engineId,
  ]
  const conditionsAvailable = hasDevelopmentComparisonConditions(agentId, engineIds)
  return (
    <>
      <AgentDevelopmentGolden
        onEditCurrent={
          savingThisAgent || retainingDuringSave
            ? undefined
            : () => {
                currentEditReturnFocus.current =
                  document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : document.querySelector<HTMLElement>('.edit-current')
                setEditingPresentation({
                  accountId,
                  presentation: displayedWorkbenchData,
                })
                setEditingCurrent(true)
              }
        }
        onContinueOptimization={() => navigate(`/development/${agentId}?candidate=0`)}
        initialView="workbench"
        onNavigate={navigateForView}
        scenario={
          savingThisAgent || editingThisAgent
            ? undefined
            : candidateSnapshotStale
              ? 'stale'
              : undefined
        }
        workbench={{
          ...displayedWorkbenchData,
          saveScopeKey: personalCapture
            ? contentHash([
                personalCapture.session.sessionId,
                personalCapture.result.generationIdentity,
              ])
            : displayedSaveScope,
        }}
        currentUpdate={
          currentRecordRefresh
            ? {
                message: saveRefreshNotice!.message,
                detail: saveRefreshNotice!.detail,
                tone: currentRecordRefresh.phase === 'failed' ? 'failed' : 'progress',
                onRetry:
                  currentRecordRefresh.phase === 'failed' && currentRecordRefresh.record
                    ? () =>
                        void refreshSavedCurrentRecord({
                          ...roster,
                          agents: roster.agents.map((agent) =>
                            agent.agentId === agentId ? currentRecordRefresh.record! : agent,
                          ),
                        })
                    : undefined,
              }
            : analysisRefresh
              ? {
                  message: analysisRefreshNotice!.message,
                  detail: analysisRefreshNotice!.detail,
                  tone: analysisRefresh.phase === 'failed' ? 'failed' : 'progress',
                  onRetry: analysisRefresh.phase === 'failed' ? analysisRefresh.onRetry : undefined,
                }
              : undefined
        }
        onAnalyzeWarehouse={analyzeWarehouse}
        onCancelWarehouseAnalysis={cancelWarehouseAnalysis}
        workbenchComparisonConditions={
          conditionsAvailable ? (
            <DevelopmentComparisonConditions
              key={JSON.stringify([accountId, agentId, engineIds, declarations, requestedPlanId])}
              agentId={agentId}
              engineIds={engineIds}
              declarations={declarations}
              pending={
                savingThisAgent || retainingDuringSave || analysisRefresh?.phase === 'updating'
              }
              onApply={async (next) => {
                await analyzeWarehouse?.('compare', undefined, next)
              }}
            />
          ) : undefined
        }
        onSavePlan={personalCapture ? savePersonalPlan : onSavePlan}
      />
      {editingThisAgent && (
        <AgentDevelopmentCurrentEditor
          key={`${accountId}:${agentId}`}
          accountId={accountId}
          agentId={agentId}
          roster={roster}
          onCancel={() => {
            const returnFocus = currentEditReturnFocus.current
            setEditingCurrent(false)
            requestAnimationFrame(() => returnFocus?.focus())
          }}
          onSaved={refreshSavedCurrentRecord}
        />
      )}
    </>
  )
}
