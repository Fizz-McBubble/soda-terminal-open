import { getComparisonViewIdentity, hasSixUniqueDiscs } from './agentComparisonPlanSave'
import { getCharacterPanelFields } from '../application/characterPanelFields'
import {
  agentComparisonSetSummary,
  projectAgentLoadoutComparisonDiscs,
} from './agentLoadoutComparisonDiscPresentation'
import { staticPanelTargetDisplay } from '../gameDataPacks/targetPanelSemantics'
import { currentIndependentPlans, independentDiscConflicts } from './agentIndependentPlanReferences'
import { getAgentName } from '../application/publicRosterNames'
import { agentDevelopmentMainStatDifferences } from './agentDevelopmentMainStatDifferences'
import { findDevelopmentComparisonPanel } from '../application/publicDevelopmentComparisonPanels'
import { currentComparisonConditions } from '../gameDataPacks/severianPlayerConditions33'
import { isDevelopmentDiscScore } from '../application/publicDevelopmentDiscScore'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import { percentageStats } from './comparisonStatUnits'
import {
  targetPanelMetricKeys,
  finiteComparisonPanelStats,
  comparisonStatDeltaSummary,
} from './agentLoadoutComparisonPanelValues'
import type { GoldenTop10Data } from '../features/agentDevelopmentGolden'
import type { AccountDecisionQueryInput } from '../application/calculationQueryContract'
import type { AccountPlanningDraft } from '../accounts/types'
import {
  isPersonalSavedAgentPlan,
  resolvePersonalReferenceDiscs,
} from '../accounts/personalCurrentReference'
import type { DevelopmentComparisonSnapshot } from './developmentComparisonSnapshot'

/** One presentation projector serves personal sessions and the existing account-query transport. */
export function projectDevelopmentComparisonView(input: {
  accountId: string
  agentId: string
  currentInput: AccountDecisionQueryInput
  justSaved: AccountPlanningDraft | null
  candidateSnapshot: DevelopmentComparisonSnapshot
  params: URLSearchParams
  saveRefreshScope: { next: string; previous: string } | null
  snapshotStale: boolean
  staleReason?: 'input_changed' | 'session_unavailable'
}) {
  const {
    accountId,
    agentId,
    currentInput,
    justSaved,
    candidateSnapshot,
    params,
    saveRefreshScope,
    snapshotStale,
    staleReason,
  } = input
  const warehouse = currentInput.warehouse
  const candidatePresentation = candidateSnapshot.presentation!
  const drafts = currentInput.drafts ?? []
  const plans = currentIndependentPlans(
    justSaved?.accountId === accountId ? [...drafts, justSaved] : drafts,
    accountId,
  )
  const currentPlan = plans.get(agentId)
  const currentPlanDiscs = currentPlan
    ? (resolvePersonalReferenceDiscs(currentPlan, warehouse.discs) ?? []).toSorted(
        (left, right) => left.slot - right.slot,
      )
    : []
  const comparisonSource = candidateSnapshot.valueBenchmarks?.[0]?.comparisonBasis.baselineSource
  const savedBaselinePlan = comparisonSource
    ? drafts.find(
        (draft) =>
          draft.id === comparisonSource.referenceId &&
          draft.accountId === accountId &&
          isPersonalSavedAgentPlan(draft, agentId),
      )
    : currentPlan
  const savedBaselineDiscs = savedBaselinePlan
    ? (resolvePersonalReferenceDiscs(savedBaselinePlan, warehouse.discs) ?? []).toSorted(
        (left, right) => left.slot - right.slot,
      )
    : []
  const conflicts = independentDiscConflicts(plans, agentId)
  const alternatives = candidateSnapshot.candidates
  const baseline = candidateSnapshot.baseline
  const baselineComplete =
    baseline.length === 6 &&
    new Set(baseline.map((disc) => disc.id)).size === 6 &&
    new Set(baseline.map((disc) => disc.slot)).size === 6 &&
    baseline.every((disc) => disc.slot >= 1 && disc.slot <= 6)
  const savedBaselineComplete = hasSixUniqueDiscs(savedBaselineDiscs)
  const generatedBaseline = alternatives[0]?.loadouts[0]?.discs.map((item) => item.disc) ?? []
  const generatedBaselineComplete = hasSixUniqueDiscs(generatedBaseline)
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
      ? '游戏当前装备'
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
    finalStatsFor = (discs, rank) => finiteComparisonPanelStats(panelFor(discs, rank))
  }
  const baselineFinalStats = finalStatsFor(comparisonDiscs)
  const discs = projectAgentLoadoutComparisonDiscs({
    agentId,
    baseline,
    savedBaselineDiscs,
    currentPlanDiscs,
    alternatives,
    conflicts,
  }).map((disc) => ({
    ...disc,
    // A shared ID can occur under different directions; an old candidate choice
    // cannot supply a context-bound score for this card.
    score: undefined,
    grade: '未评定' as const,
  }))
  const row = (
    rank: number,
    plan: (typeof alternatives)[number] | undefined,
    label: string,
    savedDiscs?: typeof baseline,
  ) => {
    const loadout = plan?.loadouts[0]
    const selectedDiscs = savedDiscs ?? loadout?.discs.map((item) => item.disc) ?? comparisonDiscs
    const ids = selectedDiscs.map((disc) => disc.id)
    const scorePanel =
      savedDiscs === baseline
        ? snapshotStale
          ? null
          : findDevelopmentComparisonPanel(candidateSnapshot.panelPresentation, baseline)
        : savedDiscs
          ? panelFor(savedDiscs, -1)
          : plan
            ? panelFor(selectedDiscs, rank)
            : baselinePanel
    const score = scorePanel?.discScore
    const eligible = isDevelopmentDiscScore(score) && score?.complete
    const finalStats =
      savedDiscs === baseline && hasStaticPanels && !snapshotStale
        ? finiteComparisonPanelStats(
            findDevelopmentComparisonPanel(candidateSnapshot.panelPresentation, baseline),
          )
        : finalStatsFor(selectedDiscs, savedDiscs ? -1 : rank)
    const statDeltaSummary = comparisonStatDeltaSummary(
      defaultStats,
      baselineFinalStats,
      finalStats,
      baselineKind !== 'none',
    )
    const swaps = loadout
      ? baselineKind !== 'none'
        ? loadout.discs.filter((item) => !comparisonDiscs.some((disc) => disc.id === item.disc.id))
            .length
        : null
      : 0
    return {
      rank,
      label: plan?.inventoryTransition ? `${label} · 过渡搭配` : label,
      fit: eligible && score?.totalScore !== undefined ? score.totalScore.toFixed(2) : '—',
      panel: loadout?.setPattern === 'scattered' ? '散搭' : (loadout?.setPattern ?? '当前方案'),
      sets: agentComparisonSetSummary(selectedDiscs, loadout?.setPattern),
      effective:
        eligible && score?.effectiveLines !== undefined && score.effectiveEnhancements !== undefined
          ? String(score.effectiveLines + score.effectiveEnhancements)
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
      statDeltaSummary: rank === 0 ? '—' : statDeltaSummary,
      finalStats,
      mainStatDifferences: agentDevelopmentMainStatDifferences(
        candidatePresentation.recommendedMainStats,
        selectedDiscs,
      ),
      discIds: ids.slice(0, 6) as [string, string, string, string, string, string],
    }
  }
  const { selectedCandidateRank, displayedSaveScope, snapshot } = getComparisonViewIdentity({
    params,
    baselineComplete,
    hasCurrentPlan: Boolean(currentPlan),
    candidateCount: alternatives.length,
    candidateSnapshot,
    alias: saveRefreshScope,
    snapshotStale,
    staleReason,
  })
  const top10: GoldenTop10Data = {
    panelScopeKey: JSON.stringify([accountId, agentId]),
    saveScopeKey: displayedSaveScope,
    agentName: getAgentName(agentId),
    candidateSearch: candidateSnapshot.candidateSearch,
    candidateSearchByRank: candidateSnapshot.candidateSearchByRank,
    currentLoadout: baselineComplete ? row(0, undefined, '保留当前装备', baseline) : undefined,
    baseline: row(0, undefined, baselineLabel),
    currentPlan: currentPlan
      ? {
          ...row(baselineComplete ? -1 : 0, undefined, '已保存方案', currentPlanDiscs),
        }
      : undefined,
    candidates: alternatives.map((plan, index) => row(index + 1, plan, `方案 ${index + 1}`)),
    valueBenchmarks: candidateSnapshot.valueBenchmarks,
    discs,
    coreStats: defaultStats,
    targetConditionsByLabel: hasStaticPanels
      ? currentComparisonConditions(candidateSnapshot.panelPresentation)
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
    snapshot,
    selectedCandidateRank,
  }
  return {
    top10,
    alternatives,
    displayedSaveScope,
    selectedCandidateRank,
    baselineComplete,
    currentPlan,
  }
}
