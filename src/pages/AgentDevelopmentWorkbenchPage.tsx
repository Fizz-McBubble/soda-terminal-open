import { workbenchCandidateIsStale } from './workbenchCandidateFreshness'
import { PersonalWorkbenchReadError } from './PersonalWorkbenchReadError'
import { useWorkbenchAnalysisRefresh } from './useWorkbenchAnalysisRefresh'
import { selectWorkbenchRun, usePersonalWorkbenchRead } from './usePersonalWorkbenchRead'
import { useDevelopmentCurrentRecordReconciliation } from './useDevelopmentCurrentRecordReconciliation'
import { useDevelopmentWorkbenchRouteRead } from './useDevelopmentWorkbenchRouteRead'
import { AppLoadingState } from '../components/AppEntryState'
import { readDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteCache'
import { useEffect, useMemo, useRef, useState } from 'react'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import { useParams, useSearchParams } from 'react-router-dom'
import { BackNavigation } from '../components/BackNavigation'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { AgentDevelopmentReadError } from './AgentDevelopmentReadError'
import { AgentDevelopmentRouteUnavailable } from './AgentDevelopmentRouteUnavailable'
import { agentCatalog } from '../application/publicRosterNames'
import { findCurrentDevelopmentWorkbenchEquipment } from '../application/publicDevelopmentWorkbenchPresentation'
import { contentHash } from '../application/contentHash'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import {
  useAccountDecisionWorld,
  useDevelopmentCandidateAlternativesCalculation,
  useDevelopmentWorkbenchRouteCalculation,
} from '../application/accountDecisionWorld'
import { resolveSavedAgentPlanRoute } from './agentDevelopmentSavedPlanRoute'
import { resolvePersonalReferenceDiscs } from '../accounts/personalCurrentReference'
import { SavedAgentPlanRouteError } from './AgentDevelopmentSavedPlanRouteError'
import { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'
import {
  isCurrentDevelopmentWorkbenchRoute,
  type DevelopmentWorkbenchRouteSelection,
} from '../application/publicDevelopmentWorkbenchRoute'
import { developmentPanelDiscFingerprint } from '../application/publicDevelopmentComparisonPanels'
import { createAgentDevelopmentWorkbenchData } from './createAgentDevelopmentWorkbenchData'
import { DevelopmentDiscCard } from '../features/agentDevelopmentGolden/DevelopmentDiscCard'
import { developmentRecordedDiscFacts } from './agentDevelopmentPublicDisplay'
import { AgentDevelopmentWorkbenchView } from './AgentDevelopmentWorkbenchView'
import {
  developmentAnalysisRecoveryDisplay,
  warehouseRefreshFor,
} from './developmentCommittedCurrentDisplay'
import type {
  AnalysisRefresh,
  SaveRefresh,
  WarehouseRefresh,
} from './agentDevelopmentWorkbenchViewState'
import { useDevelopmentWorkbenchFacts } from './useDevelopmentWorkbenchFacts'
import { isCurrentDevelopmentWorkbenchFacts } from '../application/publicDevelopmentWorkbenchFacts'

export function AgentDevelopmentWorkbenchPage() {
  const { agentId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const decisionWorld = useAccountDecisionWorld()
  const refreshDecisionWorld = decisionWorld.refresh
  const queryDevelopmentCandidateAlternatives = useDevelopmentCandidateAlternativesCalculation()
  const queryDevelopmentWorkbenchRoute = useDevelopmentWorkbenchRouteCalculation()
  const [analysisVersion, setAnalysisVersion] = useState(0)
  const [warehouseRefresh, setWarehouseRefresh] = useState<WarehouseRefresh | null>(null)
  const [editingCurrent, setEditingCurrent] = useState(false)
  const [editingPresentation, setEditingPresentation] = useState<{
    accountId: string
    presentation: GoldenWorkbenchData
  } | null>(null)
  const [saveRefresh, setSaveRefresh] = useState<SaveRefresh | null>(null)
  const [analysisRefresh, setAnalysisRefresh] = useState<AnalysisRefresh | null>(null)
  const analysisRefreshAttempt = useRef<string | null>(null)
  const analysisRefreshRequest = useRef(0)
  const pageActive = useRef(true)
  const requestedPlanId = searchParams.get('plan')
  const requestedCandidateRank = Number.parseInt(searchParams.get('candidate') ?? '1', 10)
  const preferEquipped = requestedCandidateRank === 0 && !requestedPlanId
  const facts = useDevelopmentWorkbenchFacts(agentId, requestedPlanId, preferEquipped)
  const pageAccountId =
    facts.input?.warehouse.accountId ??
    decisionWorld.liveInput?.warehouse.accountId ??
    decisionWorld.run?.input.warehouse.accountId
  const {
    personalCapture,
    personalInput,
    personalCurrent,
    personalRouteKey,
    personalRouteFailure,
    setPersonalRouteFailure,
    personalRoute,
    personalSnapshot,
  } = usePersonalWorkbenchRead({
    pageAccountId: pageAccountId ?? undefined,
    agentId,
    requestedPlanId,
    preferEquipped,
    analysisVersion,
    requestedCandidateRank,
  })
  const committedCurrentRecord =
    saveRefresh?.kind === 'current_record' &&
    saveRefresh.accountId === pageAccountId &&
    saveRefresh.agentId === agentId
  useEffect(() => {
    pageActive.current = true
    return () => {
      pageActive.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setSaveRefresh(null)
      setWarehouseRefresh(null)
      setEditingCurrent(false)
      setEditingPresentation(null)
      setAnalysisRefresh(null)
      analysisRefreshAttempt.current = null
    })
    return () => {
      active = false
    }
  }, [pageAccountId, agentId, requestedPlanId])
  const { selectedCandidateRank, currentRun, retainedRun } = selectWorkbenchRun(
    decisionWorld,
    requestedCandidateRank,
  )
  const staleRefreshKey =
    !facts.enabled &&
    decisionWorld.status === 'stale' &&
    decisionWorld.liveInput?.warehouse.accountId &&
    decisionWorld.liveFingerprint
      ? `${decisionWorld.liveInput.warehouse.accountId}\0${decisionWorld.liveFingerprint}\0${decisionWorld.run?.runId ?? 'missing'}`
      : null
  const runAnalysisRefresh = useWorkbenchAnalysisRefresh(
    refreshDecisionWorld,
    analysisRefreshAttempt,
    analysisRefreshRequest,
    pageActive,
    setAnalysisRefresh,
  )
  useEffect(() => {
    if (
      !staleRefreshKey ||
      !pageAccountId ||
      saveRefresh ||
      (warehouseRefresh && !warehouseRefresh.retainUntilFacts) ||
      editingCurrent ||
      (requestedPlanId && !committedCurrentRecord)
    )
      return
    void runAnalysisRefresh(staleRefreshKey, pageAccountId)
  }, [
    committedCurrentRecord,
    editingCurrent,
    pageAccountId,
    requestedPlanId,
    runAnalysisRefresh,
    saveRefresh,
    staleRefreshKey,
    warehouseRefresh,
  ])
  useEffect(() => {
    if (!currentRun || !analysisRefresh) return
    // Another request may have superseded this refresh and already produced a current run.
    analysisRefreshRequest.current += 1
    analysisRefreshAttempt.current = null
    let active = true
    queueMicrotask(() => {
      if (active) setAnalysisRefresh(null)
    })
    return () => {
      active = false
    }
  }, [analysisRefresh, currentRun])
  useDevelopmentCurrentRecordReconciliation(facts, saveRefresh, setSaveRefresh)
  const routeSnapshot =
    currentRun && !requestedPlanId && !preferEquipped
      ? readDevelopmentCandidateSnapshot(currentRun.input.warehouse.accountId ?? '', agentId)
      : null
  const routeSnapshotCurrent =
    routeSnapshot && routeSnapshot.inputFingerprint === currentRun?.inputFingerprint
  const routeCandidates = routeSnapshotCurrent ? routeSnapshot.candidates : []
  const routeCandidateIndex = Math.min(
    Math.max(selectedCandidateRank - 1, 0),
    Math.max(routeCandidates.length - 1, 0),
  )
  const routeLoadout = routeCandidates[routeCandidateIndex]?.loadouts[0]
  const routeLoadoutFingerprint = routeLoadout ? contentHash(routeLoadout) : null
  const routeSelection: DevelopmentWorkbenchRouteSelection = useMemo(
    () => ({
      agentId,
      requestedPlanId,
      ...(preferEquipped ? { preferEquipped: true as const } : {}),
      candidateRank: routeLoadoutFingerprint ? routeCandidateIndex + 1 : null,
      candidateLoadoutFingerprint: routeLoadoutFingerprint,
    }),
    [agentId, requestedPlanId, preferEquipped, routeCandidateIndex, routeLoadoutFingerprint],
  )
  const retainedRouteKey = retainedRun
    ? contentHash([retainedRun.runId, retainedRun.inputFingerprint, routeSelection])
    : null
  const routeKey = currentRun
    ? contentHash([currentRun.runId, currentRun.inputFingerprint, routeSelection])
    : null
  const {
    lastRouteProjection,
    setLastRouteProjection,
    routeRead,
    setRouteRead,
    routeFailureKey,
    setRouteFailureKey,
  } = useDevelopmentWorkbenchRouteRead({
    currentRun,
    routeKey,
    routeSelection,
    queryDevelopmentWorkbenchRoute,
    analysisVersion,
    agentId,
  })
  // A decision run is intentionally retained while the live account changes.
  // Use that run for derived authority only; current-page account facts must
  // switch to the live input immediately, otherwise a low level, missing
  // engine, or changed disc can be presented as the player's current state.
  const currentInput =
    personalCurrent && personalInput
      ? personalInput
      : facts.enabled && !currentRun
        ? (facts.input ?? undefined)
        : (decisionWorld.liveInput ?? decisionWorld.run?.input ?? undefined)
  // A saved plan is a local record. Reading it must not depend on a new online calculation.
  if (
    decisionWorld.status === 'error' &&
    (!facts.enabled ||
      decisionWorld.canRepairApplicationData ||
      decisionWorld.analysisIssue?.kind === 'runtime_unavailable') &&
    !committedCurrentRecord &&
    !(requestedPlanId && currentInput) &&
    !analysisRefresh
  )
    return (
      <AgentDevelopmentReadError
        message={decisionWorld.message}
        onRetry={
          staleRefreshKey && !requestedPlanId
            ? () => {
                const current = decisionWorld.liveInput
                if (current?.warehouse.accountId)
                  void runAnalysisRefresh(staleRefreshKey, current.warehouse.accountId, {
                    retry: true,
                  })
              }
            : undefined
        }
      />
    )
  if (facts.enabled && !currentInput && facts.error)
    return <AgentDevelopmentReadError message="当前养成资料暂未读取完整。" onRetry={facts.retry} />
  if (facts.enabled && !currentInput && facts.noAccount)
    return <AccountRequiredState title="先创建或选择账户" />
  if (!currentInput) {
    if (decisionWorld.status === 'loading' || (facts.enabled && facts.loading))
      return <AppLoadingState heading="代理人养成" title="正在读取当前账户…" compact />
    return <AccountRequiredState title="先创建或选择账户" />
  }
  const { account, roster, discs } = currentInput.warehouse
  if (!account)
    return <AgentDevelopmentReadError message="暂时无法读取当前账户资料，请重新加载后再试。" />
  const editingThisAgent =
    editingCurrent &&
    editingPresentation?.accountId === account.id &&
    editingPresentation.presentation.agentId === agentId
  const savePresentationThisAgent =
    saveRefresh?.accountId === account.id && saveRefresh.agentId === agentId
  const savingThisAgent = savePresentationThisAgent && saveRefresh.phase !== 'failed'
  const match = warehouseRefreshFor(warehouseRefresh, facts, account, agentId, decisionWorld)
  const agent = roster.agents.find((item) => item.agentId === agentId)
  const catalog = publicDevelopmentDirectoryCatalog.find(
    (item) => item.stableId === agentId && item.releaseState === 'released' && item.accountOwnable,
  )
  const legacyCatalog = agentCatalog.find((item) => item[0] === agentId)
  if (!agent || !catalog || !agent.owned)
    return (
      <section className="panel">
        <h1>代理人养成</h1>
        <p>只能打开当前账户中已拥有的代理人。</p>
        <BackNavigation to="/development" />
      </section>
    )

  const savedPlanResolution = preferEquipped
    ? { status: 'current' as const, plan: undefined }
    : resolveSavedAgentPlanRoute({
        requestedPlanId,
        agentId,
        activePlanId: currentInput.activePlanIds[agentId],
        planningDrafts: currentInput.drafts,
        discs,
      })
  if (
    savedPlanResolution.status === 'missing' ||
    savedPlanResolution.status === 'references_changed'
  )
    return <SavedAgentPlanRouteError status={savedPlanResolution.status} agentId={agentId} />
  const savedAgentBuild = savedPlanResolution.plan
  // A historical plan must remain its own recorded six-disc reference. Do not let a
  // previous candidate session replace it merely because that session is still cached.
  const legacyCandidateSnapshot =
    requestedPlanId || preferEquipped || personalCapture
      ? null
      : readDevelopmentCandidateSnapshot(account.id, agentId)
  const candidateSnapshot = personalSnapshot ?? legacyCandidateSnapshot
  const candidateSnapshotStale = workbenchCandidateIsStale(
    personalCapture,
    personalCurrent,
    decisionWorld,
    analysisRefresh,
    legacyCandidateSnapshot,
  )
  // A cached solve is evidence for its captured account fingerprint only. Once
  // the live warehouse changes, do not feed its IDs into the current panel or
  // six-disc cards: the same ID may now describe different disc facts. The
  // comparison route deliberately retains its embedded snapshot as historical
  // read-only evidence, but this workbench must return to live saved/equipped
  // identity until the user explicitly solves again.
  const currentCandidateSnapshot = candidateSnapshotStale ? null : candidateSnapshot
  const analysisRequested = Boolean(currentCandidateSnapshot)
  const candidates = currentCandidateSnapshot?.candidates ?? []
  const selectedCandidateIndex = Math.min(
    Math.max(selectedCandidateRank - 1, 0),
    Math.max(candidates.length - 1, 0),
  )
  const selectedCandidate = candidates[selectedCandidateIndex]
  const candidateLoadout = selectedCandidate?.loadouts[0]
  const candidateChoices = candidateLoadout?.discs ?? []
  const hasComparablePlan = candidateChoices.length === 6
  const currentDiscIds = agent.equippedDiscIds ?? []
  const currentDiscs = discs.filter((disc) => currentDiscIds.includes(disc.id))
  const replacementCount =
    hasComparablePlan &&
    currentDiscIds.length === 6 &&
    new Set(currentDiscIds).size === 6 &&
    currentDiscs.length === 6 &&
    new Set(currentDiscs.map((disc) => disc.slot)).size === 6
      ? candidateChoices.filter((choice) => !currentDiscIds.includes(choice.disc.id)).length
      : undefined
  const selectedDiscIds = hasComparablePlan
    ? candidateChoices.map((choice) => choice.disc.id)
    : ((savedAgentBuild
        ? resolvePersonalReferenceDiscs(savedAgentBuild, discs)?.map((disc) => disc.id)
        : undefined) ?? currentDiscIds)
  const selectedDiscs = discs.filter((disc) => selectedDiscIds.includes(disc.id))
  const cachedRouteValue = readDevelopmentWorkbenchRoute(routeKey)
  const cachedRoute = cachedRouteValue?.equipment ? cachedRouteValue : null
  const resolvedRoute = cachedRoute ?? (routeRead?.key === routeKey ? routeRead.value : null)
  const freshRouteProjection =
    resolvedRoute &&
    currentRun &&
    isCurrentDevelopmentWorkbenchRoute(
      resolvedRoute,
      {
        runId: currentRun.runId,
        accountId: account.id,
        inputFingerprint: currentRun.inputFingerprint,
        selection: routeSelection,
        selectedDiscs,
      },
      developmentPanelDiscFingerprint,
    )
      ? resolvedRoute
      : null
  const cachedRetainedRoute = retainedRouteKey
    ? readDevelopmentWorkbenchRoute(retainedRouteKey)
    : null
  const retainedRouteProjection =
    lastRouteProjection?.accountId === account.id && lastRouteProjection.agentId === agentId
      ? lastRouteProjection.value
      : cachedRetainedRoute
  const retainingDuringSave =
    !freshRouteProjection &&
    (savePresentationThisAgent || editingThisAgent) &&
    lastRouteProjection?.accountId === account.id &&
    lastRouteProjection.agentId === agentId
  const retainingDuringAnalysis =
    !freshRouteProjection &&
    !facts.enabled &&
    (decisionWorld.status === 'stale' || Boolean(analysisRefresh)) &&
    Boolean(retainedRouteProjection)
  const factsProjection =
    !routeLoadout &&
    facts.request &&
    facts.value &&
    isCurrentDevelopmentWorkbenchFacts(facts.value, facts.request, selectedDiscs)
      ? facts.value
      : null
  const routeProjection =
    personalRoute ??
    freshRouteProjection ??
    (retainingDuringSave ? lastRouteProjection!.value : null) ??
    (retainingDuringAnalysis ? retainedRouteProjection : null) ??
    factsProjection ??
    null
  const retainedRunEquipment =
    !facts.enabled && retainedRun?.input.warehouse.accountId === account.id
      ? findCurrentDevelopmentWorkbenchEquipment(retainedRun.developmentWorkbenchPresentation, {
          runId: retainedRun.runId,
          accountId: account.id,
          inputFingerprint: retainedRun.inputFingerprint,
          agentId,
        })
      : null
  const equipment = routeProjection?.equipment ?? retainedRunEquipment
  // Missing projection data is a loading/recovery state, never evidence that
  // the player has no engine or discs. A captured edit/save presentation is
  // already complete and may continue to be shown while it recovers.
  if (!equipment && !savePresentationThisAgent && !editingThisAgent && !match) {
    if (facts.enabled && facts.error)
      return (
        <AgentDevelopmentReadError message="当前养成资料暂未读取完整。" onRetry={facts.retry} />
      )
    if (decisionWorld.analysisIssue && !facts.enabled)
      return (
        <AgentDevelopmentReadError
          message={decisionWorld.analysisIssue.message}
          onRetry={() => {
            void decisionWorld.refresh()
          }}
        />
      )
    if (analysisRefresh?.phase === 'failed' || (decisionWorld.status === 'error' && !facts.enabled))
      return (
        <AgentDevelopmentReadError
          message={analysisRefresh?.error ?? '当前养成资料暂未更新。'}
          onRetry={
            analysisRefresh?.onRetry ??
            (() => {
              void decisionWorld.refresh()
            })
          }
        />
      )
    if (currentRun && (routeFailureKey === routeKey || routeRead?.key === routeKey))
      return (
        <AgentDevelopmentReadError
          message="当前养成资料暂未读取完整。"
          onRetry={() => {
            setRouteFailureKey(null)
            setRouteRead(null)
            setAnalysisVersion((version) => version + 1)
          }}
        />
      )
    if (
      facts.request?.input.warehouse.accountId === account.id &&
      facts.request.selection.agentId === agentId &&
      !requestedPlanId &&
      !savedAgentBuild &&
      !hasComparablePlan &&
      currentDiscs.length > 0
    ) {
      const recorded = developmentRecordedDiscFacts(agentId, currentDiscs).sort(
        (a, b) => a.slot - b.slot,
      )
      return (
        <section className="disc-section disc-section--workbench decision-loadout-result is-actual">
          <h1>{catalog.playerName} · 当前装备</h1>
          <p role="status">正在整理当前养成资料…</p>
          <div className="disc-grid decision-loadout-result__grid">
            {recorded.map((disc) => (
              <DevelopmentDiscCard key={disc.slot} disc={disc} showGrade={false} />
            ))}
          </div>
        </section>
      )
    }
    return <AppLoadingState heading="代理人养成" title="正在整理当前养成资料…" compact />
  }
  if (personalRouteKey && personalRouteFailure === personalRouteKey)
    return (
      <PersonalWorkbenchReadError
        onRetry={() => {
          setPersonalRouteFailure(null)
          setAnalysisVersion((version) => version + 1)
        }}
      />
    )

  if (
    decisionWorld.status === 'error' &&
    !facts.enabled &&
    !routeProjection &&
    !savePresentationThisAgent &&
    !editingThisAgent &&
    analysisRefresh
  )
    return (
      <AgentDevelopmentReadError
        message={analysisRefresh.error ?? decisionWorld.message}
        onRetry={analysisRefresh.onRetry}
      />
    )
  if (currentRun && !routeProjection && !match) {
    if (routeFailureKey === routeKey || routeRead?.key === routeKey)
      return <AgentDevelopmentRouteUnavailable failed={routeFailureKey === routeKey} />
    return <AppLoadingState heading="代理人养成" title="正在整理当前养成资料…" compact />
  }
  if (
    decisionWorld.status === 'stale' &&
    !facts.enabled &&
    !routeProjection &&
    !match &&
    !savePresentationThisAgent &&
    !editingThisAgent
  )
    return <AppLoadingState heading="代理人养成" title="正在按最新账户资料恢复养成建议…" compact />
  const baseWorkbenchData = createAgentDevelopmentWorkbenchData({
    agentId,
    agent,
    catalog,
    legacyCatalog,
    equipment,
    routeProjection,
    selectedDiscs,
    planningDrafts: currentInput.drafts,
    accountId: account.id,
    requestedPlanId,
    candidateSnapshot,
    candidateSnapshotStale,
    currentCandidateSnapshot,
    selectedCandidateIndex,
    candidates,
    selectedCandidate,
    candidateLoadout,
    candidateChoices,
    hasComparablePlan,
    replacementCount,
    analysisRequested,
    savedAgentBuild,
  })
  const workbenchData =
    match && (match.pending || !freshRouteProjection)
      ? match.presentation
      : analysisRefresh
        ? developmentAnalysisRecoveryDisplay(baseWorkbenchData, analysisRefresh.phase)
        : baseWorkbenchData
  return (
    <AgentDevelopmentWorkbenchView
      agentId={agentId}
      accountId={account.id}
      agentName={legacyCatalog?.[1] ?? catalog.playerName}
      roster={roster}
      workbenchData={workbenchData}
      savingThisAgent={savingThisAgent}
      editingThisAgent={editingThisAgent}
      candidateSnapshotStale={candidateSnapshotStale}
      retainingDuringSave={retainingDuringSave || Boolean(match?.pending)}
      analysisRefresh={analysisRefresh}
      saveRefresh={saveRefresh}
      editingPresentation={editingPresentation}
      decisionWorld={decisionWorld}
      queryDevelopmentCandidateAlternatives={queryDevelopmentCandidateAlternatives}
      queryDevelopmentWorkbenchRoute={queryDevelopmentWorkbenchRoute}
      facts={facts}
      candidates={candidates}
      candidateSnapshot={legacyCandidateSnapshot}
      personalCapture={personalSnapshot ? personalCapture : null}
      equipment={equipment}
      requestedPlanId={requestedPlanId}
      selectedCandidateRank={selectedCandidateRank}
      setAnalysisVersion={setAnalysisVersion}
      setWarehouseRefresh={setWarehouseRefresh}
      setEditingPresentation={setEditingPresentation}
      setEditingCurrent={setEditingCurrent}
      setSaveRefresh={setSaveRefresh}
      setRouteRead={setRouteRead}
      setLastRouteProjection={setLastRouteProjection}
    />
  )
}
