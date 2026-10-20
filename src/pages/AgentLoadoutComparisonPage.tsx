import { getCharacterPanelFields } from '../application/characterPanelFields'
import {
  agentComparisonSetSummary,
  projectAgentLoadoutComparisonDiscs,
} from './agentLoadoutComparisonDiscPresentation'
import { rebindComparisonParameters } from './rebindComparisonParameters'
import { staticPanelTargetDisplay } from '../gameDataPacks/targetPanelSemantics'
import { createComparisonSavedBuild } from './createComparisonSavedBuild'
import { TeamSchemeWEngineControl } from './TeamEquipmentParameterForm'
import {
  developmentWEngineComparisonSelection,
  selectedDevelopmentWEngineOptionKey,
  selectDevelopmentWEngineOption,
} from './developmentWEngineSelection'
import type { DevelopmentCandidateAlternativesQueryResult } from '../application/calculationQueryContract'
import { AppLoadingState } from '../components/AppEntryState'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackNavigation } from '../components/BackNavigation'
import type { AccountPlanningDraft } from '../accounts/types'
import { currentIndependentPlans, independentDiscConflicts } from './agentIndependentPlanReferences'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import { getAgentName } from '../application/publicRosterNames'
import {
  useAccountDecisionWorld,
  useDevelopmentCandidateAlternativesCalculation,
} from '../application/accountDecisionWorld'
import { agentDevelopmentMainStatDifferences } from './agentDevelopmentMainStatDifferences'
import { findDevelopmentComparisonPanel } from '../application/publicDevelopmentComparisonPanels'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import { AgentDevelopmentGolden, type GoldenTop10Data } from '../features/agentDevelopmentGolden'
import { percentageStats } from './comparisonStatUnits'
import {
  cacheDevelopmentCandidateSnapshot,
  refreshDevelopmentCandidatesAfterSave,
  isDevelopmentCandidateSnapshotStale,
  readDevelopmentCandidateSnapshot,
} from './agentDevelopmentCandidateSession'
import { usePageOperationScope } from '../components/usePageOperationScope'
import {
  defaultPlanningScenarioSelection32,
  type CurrentPlanningScenarioSelection32,
} from '../application/publicPlanningScenarioContract'

import {
  targetPanelMetricKeys,
  finiteComparisonPanelStats,
} from './agentLoadoutComparisonPanelValues'

export function AgentLoadoutComparisonPage() {
  const { agentId = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [, setSnapshotVersion] = useState(0)
  const [justSaved, setJustSaved] = useState<AccountPlanningDraft | null>(null)
  const [comparisonPending, setComparisonPending] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)
  const comparisonGeneration = useRef(0)
  const [equipmentRank, setEquipmentRank] = useState<number | null>(null)
  const equipmentRequest = useRef<string | null>(null)
  const decisionWorld = useAccountDecisionWorld()
  const queryDevelopmentCandidateAlternatives = useDevelopmentCandidateAlternativesCalculation()
  const pageAccountId =
    decisionWorld.status === 'stale'
      ? decisionWorld.liveInput?.warehouse.accountId
      : decisionWorld.run?.input.warehouse.accountId
  const capturePageScope = usePageOperationScope(JSON.stringify([pageAccountId, agentId]))
  const captureEquipmentScope = usePageOperationScope(
    JSON.stringify([pageAccountId, agentId, decisionWorld.liveFingerprint]),
  )
  if (decisionWorld.status === 'loading')
    return <AppLoadingState title="正在读取账户配装…" compact />
  if (decisionWorld.status !== 'current' && decisionWorld.status !== 'stale')
    return (
      <section className="panel">
        <h1>无法打开方案比较</h1>
        <BackNavigation to="/development" />
      </section>
    )
  // The retained run is historical while the account decision world is stale.
  // Read the live warehouse before resolving the account/session key so a
  // comparison from a previously selected account cannot be presented as this
  // account's current match.
  const warehouse =
    decisionWorld.status === 'stale'
      ? decisionWorld.liveInput?.warehouse
      : decisionWorld.run.input.warehouse
  if (!warehouse) return <AppLoadingState title="正在读取当前账户配装…" compact />
  const agent = warehouse.roster.agents.find((item) => item.agentId === agentId)
  if (!warehouse.accountId || !agent?.owned)
    return (
      <section className="panel">
        <h1>无法打开方案比较</h1>
        <BackNavigation to="/development" />
      </section>
    )
  const accountId = warehouse.accountId
  const candidateSnapshot = readDevelopmentCandidateSnapshot(accountId, agentId)
  if (!candidateSnapshot)
    return (
      <section className="panel">
        <h1>本次匹配记录不可用</h1>
        <p>请回到养成页重新搭配驱动盘，再比较搭配。已保存的方案仍然保留。</p>
        <Link className="button button--primary" to={`/development/${agentId}`}>
          返回养成，重新搭配
        </Link>
      </section>
    )
  const candidatePresentation = candidateSnapshot.presentation!
  const snapshotStale =
    decisionWorld.status === 'stale' ||
    isDevelopmentCandidateSnapshotStale(candidateSnapshot, decisionWorld.liveFingerprint)
  const currentInput = decisionWorld.liveInput ?? decisionWorld.run.input
  const drafts = currentInput.drafts ?? []
  const plans = currentIndependentPlans(
    justSaved?.accountId === accountId ? [...drafts, justSaved] : drafts,
    accountId,
  )
  const currentPlan = plans.get(agentId)
  const currentPlanDiscs = (warehouse.discs ?? [])
    .filter((disc) => currentPlan?.warehouseRefs.includes(disc.id))
    .toSorted((left, right) => left.slot - right.slot)
  const comparisonSource = candidateSnapshot.valueBenchmarks?.[0]?.comparisonBasis.baselineSource
  const savedBaselinePlan = comparisonSource
    ? drafts.find(
        (draft) =>
          draft.id === comparisonSource.referenceId &&
          draft.accountId === accountId &&
          draft.kind === 'agent' &&
          draft.state === 'saved' &&
          draft.selection.agentIds.length === 1 &&
          draft.selection.agentIds[0] === agentId,
      )
    : currentPlan
  const savedBaselineDiscs = (warehouse.discs ?? [])
    .filter((disc) => savedBaselinePlan?.warehouseRefs.includes(disc.id))
    .toSorted((left, right) => left.slot - right.slot)
  const conflicts = independentDiscConflicts(plans, agentId)
  const alternatives = candidateSnapshot.candidates
  const baseline = candidateSnapshot.baseline
  const baselineComplete =
    baseline.length === 6 &&
    new Set(baseline.map((disc) => disc.id)).size === 6 &&
    new Set(baseline.map((disc) => disc.slot)).size === 6 &&
    baseline.every((disc) => disc.slot >= 1 && disc.slot <= 6)
  const savedBaselineComplete =
    savedBaselineDiscs.length === 6 &&
    new Set(savedBaselineDiscs.map((disc) => disc.id)).size === 6 &&
    new Set(savedBaselineDiscs.map((disc) => disc.slot)).size === 6
  const generatedBaseline = alternatives[0]?.loadouts[0]?.discs.map((item) => item.disc) ?? []
  const generatedBaselineComplete =
    generatedBaseline.length === 6 &&
    new Set(generatedBaseline.map((disc) => disc.id)).size === 6 &&
    new Set(generatedBaseline.map((disc) => disc.slot)).size === 6
  const baselineKind = comparisonSource
    ? comparisonSource.kind === 'actual' && baselineComplete
      ? 'actual'
      : comparisonSource.kind === 'saved' && savedBaselineComplete
        ? 'saved'
        : comparisonSource.kind === 'candidate' && generatedBaselineComplete
          ? 'candidate'
          : 'none'
    : baselineComplete
      ? 'actual'
      : savedBaselineComplete
        ? 'saved'
        : generatedBaselineComplete && alternatives.length > 1
          ? 'candidate'
          : 'none'
  const comparisonDiscs =
    baselineKind === 'actual'
      ? baseline
      : baselineKind === 'saved'
        ? savedBaselineDiscs
        : baselineKind === 'candidate'
          ? generatedBaseline
          : []
  const baselineLabel =
    candidateSnapshot.valueBenchmarks?.[0]?.comparisonBasis.baselineLabel ??
    (baselineKind === 'actual'
      ? '游戏当前实装'
      : baselineKind === 'saved'
        ? `已保存方案${savedBaselinePlan?.name ? ` · ${savedBaselinePlan.name}` : ''}`
        : baselineKind === 'candidate'
          ? '方案 1'
          : '尚无比较基线')
  const preferredStatKeys = candidatePresentation.preferredStatKeys
  const allCandidateDiscs = [
    ...baseline,
    ...currentPlanDiscs,
    ...alternatives.flatMap((plan) => plan.loadouts[0]?.discs.map((item) => item.disc) ?? []),
  ]
  const observedStatKeys = [
    ...new Set(allCandidateDiscs.flatMap((disc) => disc.subStats.map((subStat) => subStat.stat))),
  ].toSorted()
  let allStats: GoldenTop10Data['allStats'] = [
    ...preferredStatKeys,
    ...observedStatKeys.filter((key) => !preferredStatKeys.includes(key)),
  ].map((key) => ({
    key,
    label: getCandidateStatLabels([key], '副词条')[0] ?? key,
    unit: percentageStats.has(key) ? ('%' as const) : ('' as const),
    highlight: preferredStatKeys.includes(key),
  }))
  let coreStats = allStats.filter((stat) => stat.highlight).slice(0, 5)
  let defaultStats = coreStats.length ? coreStats : allStats.slice(0, 5)
  let finalStatsFor: (
    discs: Parameters<typeof findDevelopmentComparisonPanel>[1],
    rank?: number,
  ) => Record<string, number> = (discs) =>
    Object.fromEntries(
      allStats.map((stat) => [
        stat.key,
        discs.reduce(
          (total, disc) =>
            total +
            disc.subStats
              .filter((subStat) => subStat.stat === stat.key)
              .reduce((subTotal, subStat) => subTotal + subStat.value, 0),
          0,
        ),
      ]),
    )
  // The captured private Query projects every displayed six-disc panel.
  // Never mix final panel values and substat contributions in one comparison.
  const panelFor = (discs: typeof warehouse.discs, rank?: number) =>
    snapshotStale
      ? null
      : findDevelopmentComparisonPanel(
          candidateSnapshot.panelPresentation,
          discs,
          rank === -1
            ? currentPlan?.solutionContext?.comparisonParameters
            : rank
              ? candidateSnapshot.candidateParametersByRank?.[rank]
              : baselineKind === 'saved'
                ? savedBaselinePlan?.solutionContext?.comparisonParameters
                : baselineKind === 'candidate'
                  ? candidateSnapshot.candidateParametersByRank?.[1]
                  : undefined,
        )
  const candidatePanels = alternatives.map((plan, index) =>
    panelFor(plan.loadouts[0]?.discs.map((item) => item.disc) ?? [], index + 1),
  )
  const baselinePanel = panelFor(comparisonDiscs)
  const hasStaticPanels =
    candidatePanels.length > 0 &&
    candidatePanels.every((panel) => panel?.status === 'ok') &&
    (baselineKind === 'none' || baselinePanel?.status === 'ok') &&
    (!currentPlan || panelFor(currentPlanDiscs, -1)?.status === 'ok')
  if (hasStaticPanels) {
    allStats = getCharacterPanelFields(agentId).map((field) => ({
      key: field.key,
      label: field.label,
      unit: field.unit,
      detail: field.detail,
      group: field.group,
      highlight:
        Boolean(field.presentationPriority) ||
        Boolean(field.weightKey && preferredStatKeys.includes(field.weightKey)),
    }))
    coreStats = allStats.filter((stat) => stat.highlight).slice(0, 5)
    defaultStats = coreStats.length ? coreStats : allStats.slice(0, 5)
    finalStatsFor = (discs, rank) => finiteComparisonPanelStats(panelFor(discs, rank)?.values)
  }
  const baselineFinalStats = finalStatsFor(comparisonDiscs)
  const discs = projectAgentLoadoutComparisonDiscs({
    agentId,
    baseline,
    savedBaselineDiscs,
    currentPlanDiscs,
    alternatives,
    conflicts,
  })
  const row = (
    rank: number,
    plan: (typeof alternatives)[number] | undefined,
    label: string,
    savedDiscs?: typeof baseline,
  ) => {
    const loadout = plan?.loadouts[0]
    const selectedDiscs = savedDiscs ?? loadout?.discs.map((item) => item.disc) ?? comparisonDiscs
    const ids = selectedDiscs.map((disc) => disc.id)
    const finalStats =
      savedDiscs === baseline && hasStaticPanels && !snapshotStale
        ? finiteComparisonPanelStats(
            findDevelopmentComparisonPanel(candidateSnapshot.panelPresentation, baseline)?.values,
          )
        : finalStatsFor(selectedDiscs, savedDiscs ? -1 : rank)
    const statDeltaSummary = defaultStats
      .map((stat) => ({
        stat,
        delta:
          Number.isFinite(finalStats[stat.key]) && Number.isFinite(baselineFinalStats[stat.key])
            ? finalStats[stat.key]! - baselineFinalStats[stat.key]!
            : null,
      }))
      .filter(
        (item): item is typeof item & { delta: number } => item.delta !== null && item.delta !== 0,
      )
      .slice(0, 2)
      .map((item) => {
        const rounded = Math.round(item.delta * 10) / 10
        const prefix = rounded > 0 ? '+' : ''
        return `${item.stat.label} ${prefix}${rounded}${item.stat.unit}`
      })
      .join(' · ')
    const swaps = loadout
      ? baselineKind !== 'none'
        ? loadout.discs.filter((item) => !comparisonDiscs.some((disc) => disc.id === item.disc.id))
            .length
        : null
      : 0
    return {
      rank,
      label: plan?.inventoryTransition ? `${label} · 副套待补齐` : label,
      fit: plan ? plan.totalScore.toFixed(2) : '比较基准',
      panel: loadout?.setPattern === 'scattered' ? '散搭' : (loadout?.setPattern ?? '当前方案'),
      sets: agentComparisonSetSummary(selectedDiscs, loadout?.setPattern),
      effective: loadout
        ? String(loadout.discs.reduce((total, item) => total + item.effectiveRolls, 0))
        : '—',
      swaps,
      conflict: [...new Set(ids.flatMap((id) => conflicts.get(id) ?? []))]
        .map(
          (ownerId) =>
            `${selectedDiscs
              .filter((disc) => conflicts.get(disc.id)?.includes(ownerId))
              .map((disc) => disc.slot)
              .join('、')}号盘已用于${getAgentName(ownerId)}的养成方案`,
        )
        .join('；'),
      cost: swaps === null ? '尚无比较基线' : swaps ? `${swaps} 张不同` : '相同方案',
      staticDps: null,
      statDeltaSummary: rank === 0 ? '—' : statDeltaSummary || '无变化',
      finalStats,
      mainStatDifferences: agentDevelopmentMainStatDifferences(
        candidatePresentation.recommendedMainStats,
        selectedDiscs,
      ),
      discIds: ids.slice(0, 6) as [string, string, string, string, string, string],
    }
  }
  const selectedCandidateRank =
    params.get('candidate') === '-1' && baselineComplete && currentPlan
      ? -1
      : params.get('candidate') === '0' && (baselineComplete || currentPlan)
        ? 0
        : alternatives.length
          ? Math.max(
              1,
              Math.min(
                Number.parseInt(params.get('candidate') ?? '1', 10) || 1,
                alternatives.length,
              ),
            )
          : undefined
  const top10: GoldenTop10Data = {
    panelScopeKey: JSON.stringify([accountId, agentId]),
    agentName: getAgentName(agentId),
    candidateSearch: candidateSnapshot.candidateSearch,
    candidateSearchByRank: candidateSnapshot.candidateSearchByRank,
    currentLoadout: baselineComplete ? row(0, undefined, '保留当前实装', baseline) : undefined,
    baseline: row(0, undefined, baselineLabel),
    currentPlan: currentPlan
      ? {
          ...row(baselineComplete ? -1 : 0, undefined, '已保存方案', currentPlanDiscs),
          fit: currentPlan.candidateWarehouse?.totalScore.toFixed(2) ?? '—',
          effective: String(currentPlan.candidateWarehouse?.loadouts[0]?.effectiveRolls ?? '—'),
        }
      : undefined,
    candidates: alternatives.map((plan, index) => row(index + 1, plan, `方案 ${index + 1}`)),
    valueBenchmarks: candidateSnapshot.valueBenchmarks,
    discs,
    coreStats: defaultStats,
    targetConditionsByLabel: hasStaticPanels
      ? candidateSnapshot.panelPresentation?.targetConditionsByLabel
      : undefined,
    allStats: allStats.map((stat) => {
      return {
        ...stat,
        target: staticPanelTargetDisplay(
          hasStaticPanels && targetPanelMetricKeys.has(stat.key)
            ? candidateSnapshot.panelPresentation?.targetDisplayByLabel[stat.label]
            : undefined,
        ),
      }
    }),
    statPresentation: hasStaticPanels ? 'static_panel' : 'disc_contribution',
    baselineAvailability: baselineKind === 'none' ? 'unavailable' : 'available',
    baselineKind,
    baselineLabel,
    snapshot: { capturedAt: candidateSnapshot.capturedAt, stale: snapshotStale },
    selectedCandidateRank,
  }
  const persist = async (rank: number) => {
    const isCurrentPage = capturePageScope()
    if (comparisonPending) throw new Error('场景仍在计算，请稍后保存。')
    if (snapshotStale) throw new Error('仓库资料已更新，请先重新搭配；尚未保存。')
    if (decisionWorld.status === 'stale')
      throw new Error('账户资料已更新，请重新分析后再保存方案。')
    const candidate = alternatives[rank - 1]?.loadouts[0]
    const candidatePlan = alternatives[rank - 1]
    if (!candidate || !candidatePlan) return
    const generation = ++comparisonGeneration.current
    const active = () => isCurrentPage() && generation === comparisonGeneration.current
    const discIds = candidate.discs.map((item) => item.disc.id)
    const saved = await saveCurrentAgentBuild(
      accountId,
      createComparisonSavedBuild(agentId, rank, candidateSnapshot),
    )
    if (!active()) return
    setJustSaved(saved)
    const refreshedRank = await refreshDevelopmentCandidatesAfterSave({
      accountId,
      agentId,
      discIds,
      comparisonParameters: candidateSnapshot.candidateParametersByRank?.[rank],
      scenarioSelection: candidateSnapshot.scenarioSelection ?? defaultPlanningScenarioSelection32,
      eventConditionDeclarationsByAgentId: candidateSnapshot.eventConditionDeclarationsByAgentId,
      isCurrent: active,
      refresh: decisionWorld.refresh,
      query: queryDevelopmentCandidateAlternatives,
    })
    if (refreshedRank === null || !active()) return
    setSnapshotVersion((version) => version + 1)
    const next = new URLSearchParams(params)
    next.set('candidate', String(refreshedRank))
    setParams(next, { replace: true })
  }
  const recalculateEquipment = async (
    rank: number,
    parameters = candidateSnapshot.candidateParametersByRank,
    comparePool = false,
  ) => {
    if (snapshotStale) return
    const binding = developmentWEngineComparisonSelection(candidateSnapshot, rank)
    const key = JSON.stringify([
      candidateSnapshot.comparisonFingerprint,
      binding,
      parameters,
      comparePool,
    ])
    if (equipmentRequest.current === key) return
    equipmentRequest.current = key
    const isCurrentPage = captureEquipmentScope()
    const generation = ++comparisonGeneration.current
    const active = () => isCurrentPage() && generation === comparisonGeneration.current
    setComparisonPending(true)
    setComparisonError(null)
    try {
      const changed =
        JSON.stringify(parameters ?? {}) !==
        JSON.stringify(candidateSnapshot.candidateParametersByRank ?? {})
      let result = await queryDevelopmentCandidateAlternatives(
        candidateSnapshot.runId,
        agentId,
        parameters,
        candidateSnapshot.scenarioSelection ?? defaultPlanningScenarioSelection32,
        candidateSnapshot.eventConditionDeclarationsByAgentId,
        candidateSnapshot.resourceGrantDeclaration32,
        comparePool && !changed ? binding : undefined,
      )
      if (!active()) return
      if (comparePool && changed) {
        result = await queryDevelopmentCandidateAlternatives(
          result.runId,
          agentId,
          parameters,
          result.scenarioSelection ?? defaultPlanningScenarioSelection32,
          result.eventConditionDeclarationsByAgentId,
          result.resourceGrantDeclaration32,
          developmentWEngineComparisonSelection(result, rank),
        )
        if (!active()) return
      }
      const liveSnapshot = readDevelopmentCandidateSnapshot(accountId, agentId)
      if (
        liveSnapshot?.comparisonFingerprint !== candidateSnapshot.comparisonFingerprint ||
        result.inputFingerprint !== binding.inputFingerprint ||
        result.runId !== candidateSnapshot.runId ||
        (!changed &&
          developmentWEngineComparisonSelection(result, rank).loadoutFingerprint !==
            binding.loadoutFingerprint)
      )
        throw new Error('音擎对应的账户或六盘方案已变化，请重新比较。')
      if (!cacheDevelopmentCandidateSnapshot(result))
        throw new Error('音擎参数未进入有效的配装结果，请重试。')
      setSnapshotVersion((version) => version + 1)
    } catch (error) {
      if (active())
        setComparisonError(error instanceof Error ? error.message : '音擎计算失败，请重试。')
    } finally {
      if (active()) {
        setComparisonPending(false)
        equipmentRequest.current = null
      }
    }
  }
  const showEquipment = (rank: number) => {
    if (rank <= 0 || snapshotStale || comparisonPending) return
    setEquipmentRank(rank)
    if (candidateSnapshot.wEngineComparison?.candidateRank !== rank)
      void recalculateEquipment(rank, undefined, true)
  }
  const chooseEquipment = (optionKey: string) => {
    if (!equipmentRank || comparisonPending) return
    try {
      const parameters = selectDevelopmentWEngineOption(candidateSnapshot, {
        runId: candidateSnapshot.runId,
        comparisonFingerprint: candidateSnapshot.comparisonFingerprint!,
        candidateRank: equipmentRank,
        optionKey,
      })
      void recalculateEquipment(equipmentRank, parameters, true)
    } catch (error) {
      setComparisonError(error instanceof Error ? error.message : '音擎选项已过期。')
    }
  }
  const changeRefinement = (refinement: number) => {
    if (
      !equipmentRank ||
      comparisonPending ||
      !Number.isInteger(refinement) ||
      refinement < 1 ||
      refinement > 5
    )
      return
    const current = candidateSnapshot.candidateParametersByRank?.[equipmentRank]
    if (!current?.wEngine) return
    const parameters: DevelopmentCandidateAlternativesQueryResult['candidateParametersByRank'] = {
      ...structuredClone(candidateSnapshot.candidateParametersByRank),
      [equipmentRank]: { ...structuredClone(current), wEngine: { ...current.wEngine, refinement } },
    }
    void recalculateEquipment(equipmentRank, parameters, true)
  }
  const recalculateComparison = async (selection: CurrentPlanningScenarioSelection32) => {
    const isCurrentPage = capturePageScope()
    const generation = ++comparisonGeneration.current
    const active = () => isCurrentPage() && generation === comparisonGeneration.current
    setComparisonPending(true)
    setComparisonError(null)
    try {
      const currentRun =
        decisionWorld.status === 'stale' ? await decisionWorld.refresh() : decisionWorld.run
      if (!active()) return
      if (!currentRun) throw new Error('当前账户无法重新分析；请稍后重试。')
      let result = await queryDevelopmentCandidateAlternatives(
        currentRun.runId,
        agentId,
        undefined,
        selection,
        candidateSnapshot.eventConditionDeclarationsByAgentId,
      )
      if (!active()) return
      const rebound = rebindComparisonParameters(candidateSnapshot, result)
      if (Object.keys(rebound).length)
        result = await queryDevelopmentCandidateAlternatives(
          currentRun.runId,
          agentId,
          rebound,
          selection,
          candidateSnapshot.eventConditionDeclarationsByAgentId,
        )
      if (!active()) return
      if (result.scenarioSelection?.id !== selection.id || !result.scenarioIdentity)
        throw new Error('比较场景未进入计算结果，请重试。')
      if (!cacheDevelopmentCandidateSnapshot(result))
        throw new Error(result.gaps[0] ?? '当前账户无法生成完整的六张候选盘。')
      setSnapshotVersion((version) => version + 1)
    } catch (error) {
      if (!active()) return
      setComparisonError(error instanceof Error ? error.message : '场景计算失败，请重试。')
      throw error
    } finally {
      if (active()) setComparisonPending(false)
    }
  }
  return (
    <>
      {comparisonError && (
        <p role="alert" className="planning-scenario-error">
          {comparisonError}
        </p>
      )}
      <AgentDevelopmentGolden
        initialView="top10"
        top10={top10}
        onNavigate={(view) => {
          if (view === 'overview') {
            navigate('/development')
            return
          }
          navigate(
            (selectedCandidateRank === -1 || (selectedCandidateRank === 0 && !baselineComplete)) &&
              currentPlan
              ? `/development/${agentId}?plan=${encodeURIComponent(currentPlan.id)}`
              : selectedCandidateRank === undefined
                ? `/development/${agentId}`
                : `/development/${agentId}?candidate=${selectedCandidateRank}`,
          )
        }}
        onSavePlan={persist}
        onComparisonDetailsOpen={showEquipment}
        comparisonEquipmentControl={
          equipmentRank === selectedCandidateRank && !snapshotStale ? (
            <>
              <TeamSchemeWEngineControl
                agentId={agentId}
                pending={comparisonPending}
                comparison={{
                  entries:
                    candidateSnapshot.wEngineComparison?.candidateRank === equipmentRank
                      ? candidateSnapshot.wEngineComparison.entries
                      : [],
                  selectedOptionKey: selectedDevelopmentWEngineOptionKey(
                    candidateSnapshot,
                    equipmentRank,
                  ),
                  parameters: candidateSnapshot.candidateParametersByRank?.[equipmentRank]?.wEngine,
                  onSelect: chooseEquipment,
                  onRefinement: changeRefinement,
                }}
              />
              {comparisonPending ? <p role="status">正在计算音擎参数…</p> : null}
            </>
          ) : null
        }
        onSelectCandidatePlan={(rank) => {
          ++comparisonGeneration.current
          equipmentRequest.current = null
          setComparisonPending(false)
          setEquipmentRank(null)
          setComparisonError(null)
          const next = new URLSearchParams(params)
          next.set('candidate', String(rank))
          setParams(next, { replace: true })
        }}
        onReanalyzeWarehouse={() => recalculateComparison(defaultPlanningScenarioSelection32)}
      />
    </>
  )
}
