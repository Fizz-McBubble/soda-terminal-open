import { AppLoadingState } from '../components/AppEntryState'
import {
  readDevelopmentWorkbenchRoute,
  rememberDevelopmentWorkbenchRoute,
} from './developmentWorkbenchRouteCache'
import { useEffect, useMemo } from 'react'
import { useState } from 'react'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import { useParams, useSearchParams } from 'react-router-dom'
import { BackNavigation } from '../components/BackNavigation'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { AgentDevelopmentReadError } from './AgentDevelopmentReadError'
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
import { SavedAgentPlanRouteError } from './AgentDevelopmentSavedPlanRouteError'
import {
  isDevelopmentCandidateSnapshotStale,
  readDevelopmentCandidateSnapshot,
} from './agentDevelopmentCandidateSession'
import {
  isCurrentDevelopmentWorkbenchRoute,
  type DevelopmentWorkbenchRoutePresentation,
  type DevelopmentWorkbenchRouteSelection,
} from '../application/publicDevelopmentWorkbenchRoute'
import { developmentPanelDiscFingerprint } from '../application/publicDevelopmentComparisonPanels'
import { createAgentDevelopmentWorkbenchData } from './createAgentDevelopmentWorkbenchData'
import { AgentDevelopmentWorkbenchView } from './AgentDevelopmentWorkbenchView'

export function AgentDevelopmentWorkbenchPage() {
  const { agentId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const decisionWorld = useAccountDecisionWorld()
  const queryDevelopmentCandidateAlternatives = useDevelopmentCandidateAlternativesCalculation()
  const queryDevelopmentWorkbenchRoute = useDevelopmentWorkbenchRouteCalculation()
  const [analysisVersion, setAnalysisVersion] = useState(0)
  const [editingCurrent, setEditingCurrent] = useState(false)
  const [editingPresentation, setEditingPresentation] = useState<{
    accountId: string
    presentation: GoldenWorkbenchData
  } | null>(null)
  const [saveRefresh, setSaveRefresh] = useState<{
    accountId: string
    agentId: string
    presentation: GoldenWorkbenchData
  } | null>(null)
  const [lastRouteProjection, setLastRouteProjection] = useState<{
    accountId: string
    agentId: string
    value: DevelopmentWorkbenchRoutePresentation
  } | null>(null)
  const [routeRead, setRouteRead] = useState<{
    key: string
    value: DevelopmentWorkbenchRoutePresentation
  } | null>(null)
  const [routeFailureKey, setRouteFailureKey] = useState<string | null>(null)
  const requestedPlanId = searchParams.get('plan')
  const pageAccountId =
    decisionWorld.liveInput?.warehouse.accountId ?? decisionWorld.run?.input.warehouse.accountId
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setSaveRefresh(null)
      setEditingCurrent(false)
      setEditingPresentation(null)
    })
    return () => {
      active = false
    }
  }, [pageAccountId, agentId, requestedPlanId])
  const requestedCandidateRank = Number.parseInt(searchParams.get('candidate') ?? '1', 10)
  const selectedCandidateRank =
    Number.isFinite(requestedCandidateRank) && requestedCandidateRank > 0
      ? requestedCandidateRank
      : 1
  const currentRun = decisionWorld.status === 'current' ? decisionWorld.run : null
  const routeSnapshot =
    currentRun && !requestedPlanId
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
      candidateRank: routeLoadoutFingerprint ? routeCandidateIndex + 1 : null,
      candidateLoadoutFingerprint: routeLoadoutFingerprint,
    }),
    [agentId, requestedPlanId, routeCandidateIndex, routeLoadoutFingerprint],
  )
  const routeKey = currentRun
    ? contentHash([currentRun.runId, currentRun.inputFingerprint, routeSelection])
    : null
  useEffect(() => {
    if (!currentRun || !routeKey) return
    let active = true
    const cached = readDevelopmentWorkbenchRoute(routeKey)
    void (
      cached
        ? Promise.resolve(cached)
        : queryDevelopmentWorkbenchRoute(currentRun.runId, routeSelection)
    )
      .then((value) => {
        if (active) {
          rememberDevelopmentWorkbenchRoute(routeKey, value)
          setRouteFailureKey(null)
          setRouteRead({ key: routeKey, value })
          setLastRouteProjection({
            accountId: currentRun.input.warehouse.accountId ?? '',
            agentId,
            value,
          })
        }
      })
      .catch(() => {
        if (active) {
          setRouteFailureKey(routeKey)
        }
      })
    return () => {
      active = false
    }
  }, [
    currentRun,
    routeKey,
    routeSelection,
    queryDevelopmentWorkbenchRoute,
    analysisVersion,
    agentId,
  ])
  // A decision run is intentionally retained while the live account changes.
  // Use that run for derived authority only; current-page account facts must
  // switch to the live input immediately, otherwise a low level, missing
  // engine, or changed disc can be presented as the player's current state.
  const currentInput =
    decisionWorld.status === 'stale'
      ? decisionWorld.liveInput
      : (decisionWorld.run?.input ?? (requestedPlanId ? decisionWorld.liveInput : undefined))
  const data = currentInput
    ? {
        account: currentInput.warehouse.account,
        roster: currentInput.warehouse.roster,
        discs: currentInput.warehouse.discs,
        planningDrafts: currentInput.drafts,
        activePlans: currentInput.activePlanIds,
      }
    : decisionWorld.status === 'loading'
      ? undefined
      : null
  // A saved plan is a local record. Reading it must not depend on a new online calculation.
  if (decisionWorld.status === 'error' && !(requestedPlanId && currentInput))
    return <AgentDevelopmentReadError message={decisionWorld.message} />
  if (data === undefined) return <AppLoadingState title="正在读取当前账户…" compact />
  if (!data) return <AccountRequiredState title="先创建或选择账户" />
  if (!data.account) return <p role="status">暂时无法整理养成建议，请刷新页面重试。</p>
  const account = data.account
  const editingThisAgent =
    editingCurrent &&
    editingPresentation?.accountId === account.id &&
    editingPresentation.presentation.agentId === agentId
  const savingThisAgent = saveRefresh?.accountId === account.id && saveRefresh.agentId === agentId
  const agent = data.roster.agents.find((item) => item.agentId === agentId)
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

  const equipment =
    decisionWorld.status === 'current'
      ? findCurrentDevelopmentWorkbenchEquipment(
          decisionWorld.run.developmentWorkbenchPresentation,
          {
            runId: decisionWorld.run.runId,
            accountId: account.id,
            inputFingerprint: decisionWorld.run.inputFingerprint,
            agentId,
          },
        )
      : null

  const savedPlanResolution = resolveSavedAgentPlanRoute({
    requestedPlanId,
    agentId,
    activePlanId: data.activePlans[agentId],
    planningDrafts: data.planningDrafts,
    discs: data.discs,
  })
  if (
    savedPlanResolution.status === 'missing' ||
    savedPlanResolution.status === 'references_changed'
  )
    return <SavedAgentPlanRouteError status={savedPlanResolution.status} agentId={agentId} />
  const savedAgentBuild = savedPlanResolution.plan
  // A historical plan must remain its own recorded six-disc reference. Do not let a
  // previous candidate session replace it merely because that session is still cached.
  const candidateSnapshot = requestedPlanId
    ? null
    : readDevelopmentCandidateSnapshot(account.id, agentId)
  const candidateSnapshotStale =
    decisionWorld.status === 'stale' ||
    (candidateSnapshot
      ? isDevelopmentCandidateSnapshotStale(candidateSnapshot, decisionWorld.liveFingerprint)
      : false)
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
  const replacementCount =
    hasComparablePlan && currentDiscIds.length === 6
      ? candidateChoices.filter((choice) => !currentDiscIds.includes(choice.disc.id)).length
      : undefined
  const selectedDiscIds = hasComparablePlan
    ? candidateChoices.map((choice) => choice.disc.id)
    : (savedAgentBuild?.warehouseRefs ?? currentDiscIds)
  const selectedDiscs = data.discs.filter((disc) => selectedDiscIds.includes(disc.id))
  const cachedRoute = readDevelopmentWorkbenchRoute(routeKey)
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
  const retainingDuringSave =
    !freshRouteProjection &&
    (savingThisAgent || editingThisAgent) &&
    lastRouteProjection?.accountId === account.id &&
    lastRouteProjection.agentId === agentId
  const routeProjection =
    freshRouteProjection ?? (retainingDuringSave ? lastRouteProjection!.value : null)
  if (currentRun && !routeProjection) {
    if (routeFailureKey === routeKey)
      return (
        <section className="panel">
          <h1>暂时无法读取本次养成资料</h1>
          <p>请刷新页面重试；已保存的方案仍然保留。</p>
          <BackNavigation to="/development" />
        </section>
      )
    if (routeRead?.key === routeKey)
      return (
        <section className="panel">
          <h1>本次养成资料已变化</h1>
          <p>请重新打开当前代理人或重新搭配驱动盘；已保存的方案仍然保留。</p>
          <BackNavigation to="/development" />
        </section>
      )
    return <AppLoadingState title="正在整理当前养成资料…" compact />
  }
  const workbenchData = createAgentDevelopmentWorkbenchData({
    agentId,
    agent,
    catalog,
    legacyCatalog,
    equipment,
    routeProjection,
    selectedDiscs,
    planningDrafts: data.planningDrafts,
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
  return (
    <AgentDevelopmentWorkbenchView
      agentId={agentId}
      accountId={account.id}
      agentName={legacyCatalog?.[1] ?? catalog.playerName}
      roster={data.roster}
      workbenchData={workbenchData}
      savingThisAgent={savingThisAgent}
      editingThisAgent={editingThisAgent}
      candidateSnapshotStale={candidateSnapshotStale}
      retainingDuringSave={retainingDuringSave}
      saveRefresh={saveRefresh}
      editingPresentation={editingPresentation}
      decisionWorld={decisionWorld}
      queryDevelopmentCandidateAlternatives={queryDevelopmentCandidateAlternatives}
      queryDevelopmentWorkbenchRoute={queryDevelopmentWorkbenchRoute}
      candidates={candidates}
      candidateSnapshot={candidateSnapshot}
      equipment={equipment}
      requestedPlanId={requestedPlanId}
      setAnalysisVersion={setAnalysisVersion}
      setEditingPresentation={setEditingPresentation}
      setEditingCurrent={setEditingCurrent}
      setSaveRefresh={setSaveRefresh}
      setRouteRead={setRouteRead}
      setLastRouteProjection={setLastRouteProjection}
    />
  )
}
