import { useState } from 'react'
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
import { publicVersionIdentity } from '../application/publicVersionIdentity'
import { agentDevelopmentMainStatDifferences } from './agentDevelopmentMainStatDifferences'
import { contentHash } from '../application/contentHash'
import { findDevelopmentComparisonPanel } from '../application/publicDevelopmentComparisonPanels'
import { valueBenchmarkSaveLabel } from '../application/valueBenchmarkSaveLabel'
import {
  formatCandidateSkillDirections,
  getCandidateStatLabels,
} from '../application/publicCandidateLabels'
import { AgentDevelopmentGolden, type GoldenTop10Data } from '../features/agentDevelopmentGolden'
import { presentDiscFactFromChoice } from './discFactPresentation'
import { displayDiscMainValue, displayDriveDiscSet } from './publicDiscFacts'
import { percentageStats } from './comparisonStatUnits'
import {
  cacheDevelopmentCandidateSnapshot,
  refreshDevelopmentCandidatesAfterSave,
  isDevelopmentCandidateSnapshotStale,
  readDevelopmentCandidateSnapshot,
} from './agentDevelopmentCandidateSession'

export function AgentLoadoutComparisonPage() {
  const { agentId = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [, setSnapshotVersion] = useState(0)
  const [justSaved, setJustSaved] = useState<AccountPlanningDraft | null>(null)
  const decisionWorld = useAccountDecisionWorld()
  const queryDevelopmentCandidateAlternatives = useDevelopmentCandidateAlternativesCalculation()
  if (decisionWorld.status === 'loading') return <p role="status">正在读取账户配装…</p>
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
  if (!warehouse) return <p role="status">正在读取当前账户配装…</p>
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
    new Set(baseline.map((disc) => disc.slot)).size === 6
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
  let allStats = [
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
  let finalStatsFor = (discs: typeof warehouse.discs) =>
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
  const panelFor = (discs: typeof warehouse.discs) =>
    snapshotStale
      ? null
      : findDevelopmentComparisonPanel(candidateSnapshot.panelPresentation, discs)
  const candidatePanels = alternatives.map((plan) =>
    panelFor(plan.loadouts[0]?.discs.map((item) => item.disc) ?? []),
  )
  const baselinePanel = panelFor(comparisonDiscs)
  const hasStaticPanels =
    candidatePanels.length > 0 &&
    candidatePanels.every((panel) => panel?.status === 'ok') &&
    (baselineKind === 'none' || baselinePanel?.status === 'ok')
  if (hasStaticPanels) {
    const panelStats = [
      ['hp', '生命值', '', 'hp_percent'],
      ['atk', '攻击力', '', 'atk_percent'],
      ['def', '防御力', '', 'def_percent'],
      ['impact', '冲击力', '', 'impact'],
      ['critRate', '暴击率', '%', 'crit_rate'],
      ['critDamage', '暴击伤害', '%', 'crit_dmg'],
      ['anomalyMastery', '异常掌控', '', 'anomaly_mastery'],
      ['anomalyProficiency', '异常精通', '', 'anomaly_proficiency'],
      ['penRatio', '穿透率', '%', 'pen_ratio'],
      ['energyRegen', '能量自动回复', '', 'energy_regen'],
    ] as const
    allStats = panelStats.map(([key, label, unit, weightKey]) => ({
      key,
      label,
      unit,
      highlight: preferredStatKeys.includes(weightKey),
    }))
    coreStats = allStats.filter((stat) => stat.highlight).slice(0, 5)
    defaultStats = coreStats.length ? coreStats : allStats.slice(0, 5)
    finalStatsFor = (discs) => ({ ...panelFor(discs)?.values })
  }
  const setSummaryFor = (discs: typeof warehouse.discs, pattern?: '4+2' | '2+2+2') => {
    const counts = new Map<string, number>()
    for (const disc of discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    const pieces = [...counts.entries()]
      .toSorted(([, left], [, right]) => right - left)
      .map(([setId, count]) => `${displayDriveDiscSet(setId)} ${count}件`)
    return pattern ? `${pattern}：${pieces.join(' + ')}` : pieces.join(' + ')
  }
  const baselineFinalStats = finalStatsFor(comparisonDiscs)
  const allDiscIds = [
    ...new Set([
      ...baseline.map((disc) => disc.id),
      ...savedBaselineDiscs.map((disc) => disc.id),
      ...currentPlanDiscs.map((disc) => disc.id),
      ...alternatives.flatMap((plan) => plan.loadouts[0]?.discs.map((item) => item.disc.id) ?? []),
    ]),
  ]
  const snapshotDiscById = new Map(
    [
      ...baseline,
      ...savedBaselineDiscs,
      ...currentPlanDiscs,
      ...alternatives.flatMap((plan) => plan.loadouts[0]?.discs.map((item) => item.disc) ?? []),
    ].map((disc) => [disc.id, disc]),
  )
  const discs = allDiscIds.flatMap((id) => {
    const disc = snapshotDiscById.get(id)
    if (!disc) return []
    const set = displayDriveDiscSet(disc.setId)
    const choice =
      alternatives
        .flatMap((plan) => plan.loadouts[0]?.discs ?? [])
        .find((item) => item.disc.id === id) ?? null
    return [
      {
        ...presentDiscFactFromChoice({
          agentId,
          disc,
          choice,
          set,
          mainValue: displayDiscMainValue(disc),
        }),
        conflicts: (conflicts.get(id) ?? []).map((ownerId) => ({
          agentId: ownerId,
          name: getAgentName(ownerId),
        })),
      },
    ]
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
    const finalStats = finalStatsFor(selectedDiscs)
    const statDeltaSummary = defaultStats
      .map((stat) => ({
        stat,
        delta: (finalStats[stat.key] ?? 0) - (baselineFinalStats[stat.key] ?? 0),
      }))
      .filter((item) => item.delta !== 0)
      .toSorted((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
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
      panel: loadout?.setPattern ?? '当前方案',
      sets: setSummaryFor(selectedDiscs, loadout?.setPattern),
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
    params.get('candidate') === '0' && currentPlan
      ? 0
      : alternatives.length
        ? Math.max(
            1,
            Math.min(Number.parseInt(params.get('candidate') ?? '1', 10) || 1, alternatives.length),
          )
        : undefined
  const top10: GoldenTop10Data = {
    agentName: getAgentName(agentId),
    baseline: row(0, undefined, baselineLabel),
    currentPlan: currentPlan
      ? {
          ...row(0, undefined, '已保存方案', currentPlanDiscs),
          fit: currentPlan.candidateWarehouse?.totalScore.toFixed(2) ?? '—',
          effective: String(currentPlan.candidateWarehouse?.loadouts[0]?.effectiveRolls ?? '—'),
        }
      : undefined,
    candidates: alternatives.map((plan, index) => row(index + 1, plan, `方案 ${index + 1}`)),
    valueBenchmarks: candidateSnapshot.valueBenchmarks,
    discs,
    coreStats: defaultStats,
    allStats: allStats.map((stat) => {
      return {
        ...stat,
        target: hasStaticPanels
          ? candidateSnapshot.panelPresentation?.targetDisplayByLabel[stat.label]
          : undefined,
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
    if (snapshotStale) throw new Error('仓库资料已更新，请先重新搭配；尚未保存。')
    if (decisionWorld.status === 'stale')
      throw new Error('账户资料已更新，请重新分析后再保存方案。')
    const candidate = alternatives[rank - 1]?.loadouts[0]
    const candidatePlan = alternatives[rank - 1]
    if (!candidate || !candidatePlan) return
    const valueBenchmark = candidateSnapshot.valueBenchmarks?.[rank - 1]
    const benchmarkDisposition = valueBenchmarkSaveLabel(valueBenchmark)
    const knowledge = candidateSnapshot.panelPresentation!.saveKnowledge
    const discIds = candidate.discs.map((item) => item.disc.id)
    const saved = await saveCurrentAgentBuild(accountId, {
      name: `${getAgentName(agentId)} · 养成方案`,
      selection: { agentIds: [agentId], bangbooId: null, scenario: knowledge.scenario },
      manualOverrides: {
        wEngineDirection: knowledge.currentEngineRecorded
          ? '沿用我的资产中已记录的当前音擎'
          : '当前音擎未记录；本方案仅保存实体驱动盘',
        discDirection: `仓库候选（${benchmarkDisposition}）`,
        progressionDirection: formatCandidateSkillDirections(
          candidatePresentation.progressionDirections,
        ),
        notes: '养成配装方案；驱动盘可供其他代理人或队伍搭配。',
      },
      knowledgeRefs: [
        {
          profileId: knowledge.profileId,
          status: knowledge.status,
          version: knowledge.version,
          source: knowledge.source,
        },
      ],
      warehouseRefs: discIds,
      solutionContext: {
        contract: 'soda-solution-context/v1',
        scope: 'agent_independent',
        resourcePolicy: 'advisory',
        sourceCandidateId: `development:${agentId}:${contentHash(discIds.toSorted())}`,
        inputFingerprint: contentHash([
          candidateSnapshot.inputFingerprint,
          candidateSnapshot.buildIntent.fingerprint,
        ]),
        solverMethod: candidatePlan.solver?.method ?? 'bounded_heuristic',
        gameVersion: publicVersionIdentity.gameVersion,
        knowledgeVersion: knowledge.version,
        exactVariantKey: null,
      },
      candidateWarehouse: {
        ...(candidatePlan.inventoryTransition ? { inventoryTransition: true as const } : {}),
        scope: 'agent',
        totalScore: candidatePlan.totalScore,
        loadouts: [
          {
            agentId,
            totalScore: candidate.totalScore,
            discIds: candidate.discs.map((item) => item.disc.id),
            effectiveRolls: candidate.discs.reduce((total, item) => total + item.effectiveRolls, 0),
            setPattern: candidate.setPattern,
            degraded: candidate.degraded,
          },
        ],
        boundary: candidatePlan.boundary,
      },
      comparisonCapability: knowledge.status === 'formal' ? 'formal' : 'direction',
    })
    setJustSaved(saved)
    const refreshedRank = await refreshDevelopmentCandidatesAfterSave({
      accountId,
      agentId,
      discIds,
      refresh: decisionWorld.refresh,
      query: queryDevelopmentCandidateAlternatives,
    })
    setSnapshotVersion((version) => version + 1)
    const next = new URLSearchParams(params)
    next.set('candidate', String(refreshedRank))
    setParams(next, { replace: true })
  }
  return (
    <AgentDevelopmentGolden
      initialView="top10"
      top10={top10}
      onNavigate={(view) => {
        if (view === 'overview') {
          navigate('/development')
          return
        }
        navigate(
          selectedCandidateRank === undefined
            ? `/development/${agentId}`
            : `/development/${agentId}?candidate=${selectedCandidateRank}`,
        )
      }}
      onSavePlan={persist}
      onSelectCandidatePlan={(rank) => {
        const next = new URLSearchParams(params)
        next.set('candidate', String(rank))
        setParams(next, { replace: true })
      }}
      onReanalyzeWarehouse={async () => {
        const currentRun =
          decisionWorld.status === 'stale' ? await decisionWorld.refresh() : decisionWorld.run
        if (!currentRun) throw new Error('当前账户无法重新分析；请稍后重试。')
        const result = await queryDevelopmentCandidateAlternatives(currentRun.runId, agentId)
        if (!cacheDevelopmentCandidateSnapshot(result))
          throw new Error(result.gaps[0] ?? '当前账户无法生成完整的六张候选盘。')
        setSnapshotVersion((version) => version + 1)
      }}
    />
  )
}
