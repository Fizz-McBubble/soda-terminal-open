import { useEffect, useMemo } from 'react'
import { useState } from 'react'
import { formatCandidateSkillDirections } from '../application/publicCandidateLabels'
import {
  developmentSkillLabels as skillLabels,
  developmentPanelSummary as currentPanelSummary,
  developmentRecordedDiscFacts,
  applyRecordedDevelopmentMetrics,
} from './agentDevelopmentPublicDisplay'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import { publicVersionIdentity } from '../application/publicVersionIdentity'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackNavigation } from '../components/BackNavigation'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { AgentDevelopmentReadError } from './AgentDevelopmentReadError'
import { AgentDevelopmentCurrentEditor } from './AgentDevelopmentCurrentEditor'
import { currentIndependentPlans, independentDiscConflicts } from './agentIndependentPlanReferences'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import {
  agentCatalog,
  getAgentName,
  getAgentSpecialtyLabel,
} from '../application/publicRosterNames'
import { findCurrentDevelopmentWorkbenchEquipment } from '../application/publicDevelopmentWorkbenchPresentation'
import { contentHash } from '../application/contentHash'
import { valueBenchmarkSaveLabel } from '../application/valueBenchmarkSaveLabel'
import {
  AgentDevelopmentGolden,
  type GoldenWorkbenchData,
} from '../features/agentDevelopmentGolden'
import {
  useAccountDecisionWorld,
  useDevelopmentCandidateAlternativesCalculation,
  useDevelopmentWorkbenchRouteCalculation,
} from '../application/accountDecisionWorld'
import { resolveSavedAgentPlanRoute } from './agentDevelopmentSavedPlanRoute'
import { SavedAgentPlanRouteError } from './AgentDevelopmentSavedPlanRouteError'
import {
  cacheDevelopmentCandidateSnapshot,
  refreshDevelopmentCandidatesAfterSave,
  isDevelopmentCandidateSnapshotStale,
  readDevelopmentCandidateSnapshot,
} from './agentDevelopmentCandidateSession'
import {
  isCurrentDevelopmentWorkbenchRoute,
  type DevelopmentWorkbenchRoutePresentation,
  type DevelopmentWorkbenchRouteSelection,
} from '../application/publicDevelopmentWorkbenchRoute'
import { developmentPanelDiscFingerprint } from '../application/publicDevelopmentComparisonPanels'
import { agentDevelopmentMainStatDifferences } from './agentDevelopmentMainStatDifferences'
import {
  createAgentDevelopmentDecisionGuide,
  createAgentDevelopmentPanelFacts,
  createAgentDevelopmentWarehouseStatus,
} from './agentDevelopmentDecisionGuide'

export function AgentDevelopmentWorkbenchPage() {
  const { agentId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const decisionWorld = useAccountDecisionWorld()
  const queryDevelopmentCandidateAlternatives = useDevelopmentCandidateAlternativesCalculation()
  const queryDevelopmentWorkbenchRoute = useDevelopmentWorkbenchRouteCalculation()
  const [analysisVersion, setAnalysisVersion] = useState(0)
  const [editingCurrent, setEditingCurrent] = useState(false)
  const [saveRefresh, setSaveRefresh] = useState<{
    accountId: string
    agentId: string
    completedAnalysisVersion: number | null
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
  const routeSelection: DevelopmentWorkbenchRouteSelection = useMemo(
    () => ({
      agentId,
      requestedPlanId,
      candidateRank: routeLoadout ? routeCandidateIndex + 1 : null,
      candidateLoadoutFingerprint: routeLoadout ? contentHash(routeLoadout) : null,
    }),
    [agentId, requestedPlanId, routeCandidateIndex, routeLoadout],
  )
  const routeKey = currentRun
    ? contentHash([currentRun.runId, currentRun.inputFingerprint, routeSelection])
    : null
  useEffect(() => {
    if (!currentRun || !routeKey) return
    let active = true
    void queryDevelopmentWorkbenchRoute(currentRun.runId, routeSelection)
      .then((value) => {
        if (active) {
          setRouteFailureKey(null)
          setRouteRead({ key: routeKey, value })
          setLastRouteProjection({
            accountId: currentRun.input.warehouse.accountId ?? '',
            agentId,
            value,
          })
          setSaveRefresh((pending) =>
            pending &&
            pending.completedAnalysisVersion !== null &&
            analysisVersion >= pending.completedAnalysisVersion
              ? null
              : pending,
          )
        }
      })
      .catch(() => {
        if (active) {
          setRouteFailureKey(routeKey)
          setSaveRefresh((pending) =>
            pending &&
            pending.completedAnalysisVersion !== null &&
            analysisVersion >= pending.completedAnalysisVersion
              ? null
              : pending,
          )
        }
      })
    return () => {
      active = false
    }
  }, [currentRun, routeKey, routeSelection, queryDevelopmentWorkbenchRoute, analysisVersion])
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
  if (data === undefined) return <p role="status">正在读取当前账户…</p>
  if (!data) return <AccountRequiredState title="先创建或选择账户" />
  if (!data.account) return <p role="status">暂时无法整理养成建议，请刷新页面重试。</p>
  const account = data.account
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

  if (editingCurrent)
    return (
      <AgentDevelopmentCurrentEditor
        accountId={account.id}
        agentId={agentId}
        roster={data.roster}
        onCancel={() => setEditingCurrent(false)}
        onSaved={async () => {
          const refreshed = await decisionWorld.refresh()
          if (!refreshed) throw new Error('资料已保存，但养成分析暂未刷新；请稍后重新打开。')
          setEditingCurrent(false)
        }}
      />
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
  const currentEngineName = equipment?.engine.name ?? agent.wEngineDetails.name ?? '未记录音擎'

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
  const profileSave = equipment?.profileSave
  const targetPanel = equipment?.targetPanel ?? null
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
  const freshRouteProjection =
    routeRead?.key === routeKey &&
    routeRead &&
    currentRun &&
    isCurrentDevelopmentWorkbenchRoute(
      routeRead.value,
      {
        runId: currentRun.runId,
        accountId: account.id,
        inputFingerprint: currentRun.inputFingerprint,
        selection: routeSelection,
        selectedDiscs,
      },
      developmentPanelDiscFingerprint,
    )
      ? routeRead.value
      : null
  const retainingDuringSave =
    !freshRouteProjection &&
    saveRefresh?.accountId === account.id &&
    saveRefresh.agentId === agentId &&
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
    return <p role="status">正在整理当前养成资料…</p>
  }
  const panelProjection = routeProjection?.panel ?? null
  const workbench = routeProjection?.workbench ?? null
  const supportsPotential = equipment?.supportsPotential ?? false
  const recordedEvaluation = routeProjection?.recordedEvaluation ?? null
  const visibleDiscSource: GoldenWorkbenchData['discSource'] = hasComparablePlan
    ? '仓库候选'
    : (workbench?.discSource ?? '未关联实体盘')
  const visibleDiscs = (
    routeProjection?.discFacts ?? developmentRecordedDiscFacts(agentId, selectedDiscs)
  ).map((disc) => ({ ...disc }))
  const discConflicts = independentDiscConflicts(
    currentIndependentPlans(data.planningDrafts, account.id),
    agentId,
  )
  for (const disc of visibleDiscs) {
    disc.conflicts = discConflicts
      .get(disc.id)
      ?.map((owner) => ({ agentId: owner, name: getAgentName(owner) }))
  }
  const graduationPanel = routeProjection?.graduationPanel ?? []
  const {
    targets: sourcedSkillTargets,
    priority: skillPriority,
    skills: recommendationSkills,
  } = equipment?.skillRecommendation ?? { targets: {}, priority: [], skills: [] }
  const skillGuidanceEvidence = skillPriority.length
    ? ('priority_available' as const)
    : equipment?.hasMechanicsWithoutPriority
      ? ('mechanics_without_priority' as const)
      : ('unavailable' as const)
  const mainStats = equipment?.graduationDisplay.mainStats ?? []
  const displayedGraduationTeams = equipment?.graduationTeams ?? []
  const graduationEngines = equipment?.graduationEngines ?? [
    {
      tier: '候选方向' as const,
      name: '音擎方向资料待刷新',
      bonus: '请刷新当前账户的养成分析。',
    },
  ]
  const graduationDiscSets = routeProjection?.setRecommendations ?? []
  const historicalDiscReferences = equipment?.historicalDiscReferences ?? []
  const discSetConditions = equipment?.discSetConditions ?? []
  const warehouseAnalysis = createAgentDevelopmentWarehouseStatus({
    inventoryTransition: selectedCandidate?.inventoryTransition,
    savedInventoryTransition: savedAgentBuild?.candidateWarehouse?.inventoryTransition,
    requested: analysisRequested,
    comparable: hasComparablePlan,
    totalScore: candidateLoadout?.totalScore,
    choices: candidateChoices,
    replacementCount,
    gap: selectedCandidate?.gaps[0],
  })
  if (!hasComparablePlan) applyRecordedDevelopmentMetrics(warehouseAnalysis, recordedEvaluation)
  const workbenchData: GoldenWorkbenchData = {
    agentId,
    name: legacyCatalog?.[1] ?? catalog.playerName,
    rarity: legacyCatalog?.[4] ?? catalog.rarity ?? '资料待补齐',
    specialty: getAgentSpecialtyLabel(legacyCatalog?.[2] ?? catalog.specialty),
    level: agent.level,
    mindscape: agent.mindscape,
    supportsPotential,
    potential: equipment?.potential ?? agent.potentialImage ?? undefined,
    engine: equipment?.engine ?? {
      name: currentEngineName,
      detail: '当前音擎匹配资料待刷新',
      copyLabel: '当前音擎 · 代理人维护共享',
      copyId: null,
      copies: [],
      currentId: agent.wEngineDetails.id || null,
      level: agent.wEngineDetails.level,
      refinement: agent.wEngineDetails.refinement,
      options: [],
    },
    skills: [
      ['普', '普攻', agent.skillLevels.basic],
      ['闪', '闪避', agent.skillLevels.dodge],
      ['支', '支援', agent.skillLevels.assist],
      ['特', '特殊', agent.skillLevels.special],
      ['连', '连携', agent.skillLevels.chain],
      ['核', '核心', agent.skillLevels.core],
    ].map(([short, label, value]) => ({
      short: String(short),
      label: String(label),
      value: value as number | null,
    })),
    hasComparablePlan,
    candidatePlanCount: candidates.filter((candidate) => candidate.loadouts[0]?.discs.length === 6)
      .length,
    selectedCandidateRank: selectedCandidateIndex + 1,
    graduation: {
      skills: recommendationSkills,
      potentialSkillReference: equipment?.potentialSkillReference ?? undefined,
      skillPriority: skillPriority.length
        ? skillPriority.map((key) => skillLabels[key])
        : ['资料待补齐'],
      panel: graduationPanel.length ? graduationPanel : [{ name: '毕业面板', value: '资料待补齐' }],
      panelConditions: targetPanel?.conditions,
      teams: displayedGraduationTeams.length
        ? displayedGraduationTeams
        : [{ label: '队伍方向资料待补齐', members: catalog.playerName, visuals: [] }],
      engines: graduationEngines,
      engineConditions: equipment?.engineConditions ?? [],
      discs: {
        sets: graduationDiscSets,
        historicalReferences: historicalDiscReferences,
        directionNote: graduationDiscSets.length
          ? [
              ...discSetConditions,
              ...(equipment?.graduationDisplay.unresolvedSetDirections.length
                ? [
                    `另有方向尚待确认完整搭配：${equipment.graduationDisplay.unresolvedSetDirections.join('；')}`,
                  ]
                : []),
            ].join('；') || undefined
          : undefined,
        unavailableReason: graduationDiscSets.length
          ? undefined
          : (equipment?.graduationDisplay.setUnavailableReason ?? '完整套装搭配资料待补齐。'),
        mainStats,
        mainStatAlternatives: equipment?.graduationDisplay.mainStatAlternatives,
        subStats: equipment?.graduationDisplay.subStats ?? '资料待补齐',
      },
    },
    decisionGuide: createAgentDevelopmentDecisionGuide({
      level: agent.level,
      mindscape: agent.mindscape,
      currentEngineName,
      discSource: visibleDiscSource,
      skillPriority: skillPriority.map((key) => skillLabels[key]),
      skillTargetCount: Object.keys(sourcedSkillTargets).length,
      skillGuidanceEvidence,
      engines: graduationEngines,
      discSets: graduationDiscSets,
      teamCount: displayedGraduationTeams.length,
      panelCount: graduationPanel.length,
      gaps: equipment?.graduationDisplay.gaps ?? [],
      sources: equipment?.graduationDisplay.sources ?? [],
      constraintSources: equipment?.graduationDisplay.constraintSources ?? [],
    }),
    panelFacts: createAgentDevelopmentPanelFacts(
      workbench?.slices.currentPanel.facts ?? [],
      graduationPanel,
    ),
    currentPanel: {
      availability: workbench?.slices.currentPanel.availability ?? 'unavailable',
      summary: currentPanelSummary(panelProjection),
      title: '当前面板',
    },
    valueBenchmark: candidateSnapshot?.valueBenchmarks?.[selectedCandidateIndex]
      ? {
          comparison: candidateSnapshot.valueBenchmarks[selectedCandidateIndex],
          stale: candidateSnapshotStale,
        }
      : undefined,
    warehouseAnalysis,
    candidateDifferences: hasComparablePlan
      ? agentDevelopmentMainStatDifferences(
          currentCandidateSnapshot!.presentation!.recommendedMainStats,
          candidateChoices.map((choice) => choice.disc),
        )
      : [],
    mode: requestedPlanId ? 'saved' : 'current',
    discSource: visibleDiscSource,
    discs: visibleDiscs,
  }
  return (
    <>
      <AgentDevelopmentGolden
        onEditCurrent={() => setEditingCurrent(true)}
        onContinueOptimization={() => navigate(`/development/${agentId}`)}
        initialView="workbench"
        scenario={candidateSnapshotStale || retainingDuringSave ? 'stale' : undefined}
        workbench={workbenchData}
        onNavigate={(view) =>
          navigate(view === 'overview' ? '/development' : `/development/${agentId}/loadouts`)
        }
        onAnalyzeWarehouse={
          retainingDuringSave
            ? undefined
            : async () => {
                // A solve must use a run captured from the same live account
                // that supplies the current panel. Refresh first rather than
                // sending the retained stale run ID back into the solver.
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
          candidateSnapshotStale || retainingDuringSave || !equipment
            ? undefined
            : async (candidateRank) => {
                if (decisionWorld.status === 'stale' || candidateSnapshotStale)
                  throw new Error('仓库或账户资料已更新，请先重新匹配；尚未保存。')
                const candidateIndex = candidateRank - 1
                const candidatePlan = candidates[candidateIndex]
                const candidate = candidatePlan?.loadouts[0]
                if (!candidate || candidate.discs.length !== 6)
                  throw new Error('所选仓库方案不可用，请重新匹配后再保存。')
                const valueBenchmark = candidateSnapshot?.valueBenchmarks?.[candidateIndex]
                const benchmarkDisposition = valueBenchmarkSaveLabel(valueBenchmark)
                const agentName = legacyCatalog?.[1] ?? catalog.playerName
                const discIds = candidate.discs.map((item) => item.disc.id)
                setSaveRefresh({
                  accountId: account.id,
                  agentId,
                  completedAnalysisVersion: null,
                })
                await saveCurrentAgentBuild(account.id, {
                  name: `${agentName} · 养成方案`,
                  selection: {
                    agentIds: [agentId],
                    bangbooId: null,
                    scenario: profileSave!.scenario,
                  },
                  manualOverrides: {
                    wEngineDirection: equipment.engine.currentId
                      ? '沿用我的资产中记录的当前音擎'
                      : '当前音擎未记录；本方案仅保存实体驱动盘',
                    discDirection: `仓库候选（${benchmarkDisposition}）`,
                    progressionDirection: formatCandidateSkillDirections(
                      profileSave!.progressionDirections,
                    ),
                    notes: '单人参考方案；会保留用盘提示，但不会锁定驱动盘或限制队伍配装。',
                  },
                  knowledgeRefs: [
                    {
                      profileId: profileSave!.profileId,
                      status: profileSave!.status,
                      version: profileSave!.version,
                      source: profileSave!.source,
                    },
                  ],
                  warehouseRefs: discIds,
                  solutionContext: {
                    contract: 'soda-solution-context/v1',
                    scope: 'agent_independent',
                    resourcePolicy: 'advisory',
                    sourceCandidateId: `development:${agentId}:${contentHash(discIds.toSorted())}`,
                    inputFingerprint: candidateSnapshot
                      ? contentHash([
                          candidateSnapshot.inputFingerprint,
                          candidateSnapshot.buildIntent.fingerprint,
                        ])
                      : 'unavailable',
                    solverMethod: candidatePlan.solver?.method ?? 'bounded_heuristic',
                    gameVersion: publicVersionIdentity.gameVersion,
                    knowledgeVersion: profileSave!.version,
                    exactVariantKey: null,
                  },
                  candidateWarehouse: {
                    ...(candidatePlan.inventoryTransition
                      ? { inventoryTransition: true as const }
                      : {}),
                    scope: 'agent',
                    totalScore: candidatePlan.totalScore,
                    loadouts: [
                      {
                        agentId,
                        totalScore: candidate.totalScore,
                        discIds: candidate.discs.map((item) => item.disc.id),
                        effectiveRolls: candidate.discs.reduce(
                          (total, item) => total + item.effectiveRolls,
                          0,
                        ),
                        setPattern: candidate.setPattern,
                        degraded: candidate.degraded,
                      },
                    ],
                    boundary: candidatePlan.boundary,
                  },
                  comparisonCapability: profileSave!.status === 'formal' ? 'formal' : 'direction',
                }).catch((error: unknown) => {
                  setSaveRefresh(null)
                  throw error
                })
                const refreshedRank = await refreshDevelopmentCandidatesAfterSave({
                  accountId: account.id,
                  agentId,
                  discIds,
                  refresh: decisionWorld.refresh,
                  query: queryDevelopmentCandidateAlternatives,
                }).catch((error: unknown) => {
                  setSaveRefresh(null)
                  throw error
                })
                setSaveRefresh((pending) =>
                  pending ? { ...pending, completedAnalysisVersion: analysisVersion + 1 } : null,
                )
                setAnalysisVersion((version) => version + 1)
                navigate(`/development/${agentId}?candidate=${refreshedRank}`, { replace: true })
              }
        }
      />
    </>
  )
}
