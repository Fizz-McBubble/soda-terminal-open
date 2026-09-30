import type { AccountPlanningDraft } from '../accounts/types'
import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { DevelopmentWorkbenchEquipmentDecision } from '../application/publicDevelopmentWorkbenchPresentation'
import type { DevelopmentWorkbenchRoutePresentation } from '../application/publicDevelopmentWorkbenchRoute'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import {
  agentCatalog,
  getAgentName,
  getAgentSpecialtyLabel,
} from '../application/publicRosterNames'
import {
  developmentSkillLabels as skillLabels,
  developmentPanelSummary as currentPanelSummary,
  developmentRecordedDiscFacts,
  applyRecordedDevelopmentMetrics,
} from './agentDevelopmentPublicDisplay'
import { currentIndependentPlans, independentDiscConflicts } from './agentIndependentPlanReferences'
import type { CandidateSnapshot } from './agentDevelopmentCandidateSession'
import { agentDevelopmentMainStatDifferences } from './agentDevelopmentMainStatDifferences'
import {
  createAgentDevelopmentDecisionGuide,
  createAgentDevelopmentPanelFacts,
  createAgentDevelopmentWarehouseStatus,
} from './agentDevelopmentDecisionGuide'

type Candidate = CandidateSnapshot['candidates'][number]
type CandidateLoadout = Candidate['loadouts'][number]

export function createAgentDevelopmentWorkbenchData({
  agentId,
  agent,
  catalog,
  legacyCatalog,
  equipment,
  routeProjection,
  selectedDiscs,
  planningDrafts,
  accountId,
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
}: {
  agentId: string
  agent: RosterAgent
  catalog: (typeof publicDevelopmentDirectoryCatalog)[number]
  legacyCatalog: (typeof agentCatalog)[number] | undefined
  equipment: DevelopmentWorkbenchEquipmentDecision | null
  routeProjection: DevelopmentWorkbenchRoutePresentation | null
  selectedDiscs: DriveDisc[]
  planningDrafts: AccountPlanningDraft[]
  accountId: string
  requestedPlanId: string | null
  candidateSnapshot: CandidateSnapshot | null
  candidateSnapshotStale: boolean
  currentCandidateSnapshot: CandidateSnapshot | null
  selectedCandidateIndex: number
  candidates: CandidateSnapshot['candidates']
  selectedCandidate: Candidate | undefined
  candidateLoadout: CandidateLoadout | undefined
  candidateChoices: CandidateLoadout['discs']
  hasComparablePlan: boolean
  replacementCount: number | undefined
  analysisRequested: boolean
  savedAgentBuild: AccountPlanningDraft | undefined
}): GoldenWorkbenchData {
  const currentEngineName = equipment?.engine.name ?? agent.wEngineDetails.name ?? '未记录音擎'
  const targetPanel = equipment?.targetPanel ?? null
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
    currentIndependentPlans(planningDrafts, accountId),
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
  return {
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
}
