import type { AccountPlanningDraft } from '../accounts/types'
import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { DevelopmentWorkbenchEquipmentDecision } from '../application/publicDevelopmentWorkbenchPresentation'
import type { DevelopmentWorkbenchRoutePresentation } from '../application/publicDevelopmentWorkbenchRoute'
import type { DevelopmentWorkbenchFactsPresentation } from '../application/publicDevelopmentWorkbenchFacts'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import { playerConditionLines } from '../application/playerDecisionPresentation'
import { graduationConditionPresentation } from '../features/agentDevelopmentGolden/graduationConditionPresentation'
import { workbenchPanelConditionPresentation } from '../features/agentDevelopmentGolden/workbenchPanelConditions'
import {
  agentCatalog,
  getAgentName,
  getAgentSpecialtyLabel,
  formatDevelopmentEntityText,
} from '../application/publicRosterNames'
import {
  developmentPanelSummary as currentPanelSummary,
  developmentRecordedDiscFacts,
} from './agentDevelopmentPublicDisplay'
import { currentIndependentPlans, independentDiscConflicts } from './agentIndependentPlanReferences'
import type { CandidateSnapshot } from './agentDevelopmentCandidateSession'
import type {
  PersonalDevelopmentCandidatesResult,
  PersonalDevelopmentRoute,
} from '../application/publicPersonalDevelopment'
import { agentDevelopmentMainStatDifferences } from './agentDevelopmentMainStatDifferences'
import { resolveWEngine } from '../decision/wEngineResolver'
import { getReviewedWorkbenchDiscReference33 } from '../gameDataPacks/reviewedWorkbenchDiscReferences33'
import { candidateDiscRecommendations } from './candidateDiscRecommendations'
import {
  createAgentDevelopmentDecisionGuide,
  createAgentDevelopmentPanelFacts,
  createAgentDevelopmentWarehouseStatus,
} from './agentDevelopmentDecisionGuide'

type DisplaySnapshot = CandidateSnapshot | PersonalDevelopmentCandidatesResult
type Candidate = DisplaySnapshot['candidates'][number]
type CandidateLoadout = Candidate['loadouts'][number]

function uniquePlayerConditionTexts(values: readonly string[]) {
  const seen = new Set<string>()
  return playerConditionLines(values).flatMap((line) => {
    if (seen.has(line.text)) return []
    seen.add(line.text)
    return [line.text]
  })
}

export function presentAgentDevelopmentGraduationConditions({
  panelConditions,
  engineConditions,
}: {
  panelConditions: readonly string[]
  engineConditions: readonly string[]
}) {
  const presentedPanelConditions = graduationConditionPresentation(panelConditions)
  const panelConditionTexts = new Set(presentedPanelConditions)
  return {
    panelConditions: presentedPanelConditions,
    engineConditions: uniquePlayerConditionTexts(engineConditions).filter(
      (condition) => !panelConditionTexts.has(condition),
    ),
  }
}

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
  routeProjection:
    | DevelopmentWorkbenchRoutePresentation
    | DevelopmentWorkbenchFactsPresentation
    | PersonalDevelopmentRoute
    | null
  selectedDiscs: DriveDisc[]
  planningDrafts: AccountPlanningDraft[]
  accountId: string
  requestedPlanId: string | null
  candidateSnapshot: DisplaySnapshot | null
  candidateSnapshotStale: boolean
  currentCandidateSnapshot: DisplaySnapshot | null
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
  const resolvedCurrentEngine = resolveWEngine({ agent }).current
  // Fresh local edits (including explicit unknowns/removal) outrank an older
  // captured route. Only an existing copy link may use its resolved inventory
  // facts; recommended defaults never fill the current equipment slot.
  const linkedEngine =
    !agent.wEngineDetails.id && agent.wEngineCopyId ? equipment?.engine : undefined
  const currentEngineId =
    agent.wEngineDetails.id || resolvedCurrentEngine?.engineId || linkedEngine?.currentId
  const currentEngineName =
    resolvedCurrentEngine?.name ||
    agent.wEngineDetails.name ||
    linkedEngine?.name ||
    (agent.wEngineDetails.id ? '音擎名称待确认' : '未记录音擎')
  const targetPanel = equipment?.targetPanel ?? null
  const panelSourceNotes = equipment?.panelSourceNotes ?? []
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
    priorityGroups: skillPriorityGroups,
    skills: recommendationSkills,
  } = equipment?.skillRecommendation ?? {
    targets: {},
    priority: [],
    priorityGroups: [],
    skills: [],
  }
  const primarySkills = recommendationSkills
    .filter((skill) => skill.priority)
    .map((skill) => skill.label)
  const skillGuidanceEvidence =
    primarySkills.length || skillPriority.length
      ? ('priority_available' as const)
      : equipment?.hasMechanicsWithoutPriority
        ? ('mechanics_without_priority' as const)
        : ('unavailable' as const)
  const mainStats = (equipment?.graduationDisplay.mainStats ?? []).flatMap((stat) => {
    const values = stat.value
      .split(/\s*\/\s*/)
      .filter((value) => value && !value.includes('资料待补齐'))
    return values.length ? [{ ...stat, value: values.join(' / ') }] : []
  })
  const subStats = equipment?.graduationDisplay.subStats
  const visibleSubStats = subStats && !subStats.includes('资料待补齐') ? subStats : ''
  const displayedGraduationTeams = equipment?.graduationTeams ?? []
  const graduationEngines = (equipment?.graduationEngines ?? [])
    .filter((engine) => !engine.name.includes('资料待补齐'))
    .map((engine) => ({
      ...engine,
      name: formatDevelopmentEntityText(engine.name),
      bonus: formatDevelopmentEntityText(engine.bonus),
    }))
  const sourceDiscSets = routeProjection?.setRecommendations ?? []
  const workbenchDiscReference = sourceDiscSets.length
    ? getReviewedWorkbenchDiscReference33(agentId, equipment?.potential ?? agent.potentialImage)
    : undefined
  const graduationDiscSets = [
    ...sourceDiscSets,
    ...(workbenchDiscReference?.plans.flatMap((plan, index) =>
      candidateDiscRecommendations([plan]).map((set) => ({
        ...set,
        recommendationConditionHint:
          workbenchDiscReference.planHints?.[index] ?? set.recommendationConditionHint,
      })),
    ) ?? []),
  ]
  const historicalDiscReferences = equipment?.historicalDiscReferences ?? []
  const discSetConditions = equipment?.discSetConditions ?? []
  const presentedConditions = presentAgentDevelopmentGraduationConditions({
    panelConditions: [
      ...new Set([
        ...(targetPanel?.conditions ?? []),
        ...(workbench?.slices.currentPanel.facts
          .filter((fact) => graduationPanel.some((target) => target.name === fact.label))
          .flatMap((fact) => fact.targetConditions ?? []) ?? []),
      ]),
    ].filter(
      (condition) =>
        !panelSourceNotes.includes(condition) &&
        !graduationPanel.some(
          (target) => condition.trim() === `${target.name} ${target.value}`.trim(),
        ),
    ),
    engineConditions: equipment?.engineConditions ?? [],
  })
  const warehouseAnalysis = createAgentDevelopmentWarehouseStatus({
    inventoryTransition: selectedCandidate?.inventoryTransition,
    savedInventoryTransition: savedAgentBuild?.candidateWarehouse?.inventoryTransition,
    requested: analysisRequested,
    comparable: hasComparablePlan,
    evaluation: recordedEvaluation,
    replacementCount,
    gap: selectedCandidate?.gaps[0],
  })
  return {
    panelScopeKey: JSON.stringify([accountId, agentId]),
    agentId,
    name: legacyCatalog?.[1] ?? catalog.playerName,
    rarity: legacyCatalog?.[4] ?? catalog.rarity ?? '',
    specialty: getAgentSpecialtyLabel(legacyCatalog?.[2] ?? catalog.specialty),
    level: agent.level,
    mindscape: agent.mindscape,
    supportsPotential,
    potential: equipment?.potential ?? agent.potentialImage ?? undefined,
    engine: {
      ...(equipment?.engine ?? {
        detail: '',
        copyLabel: '当前音擎 · 代理人维护共享',
        copyId: null,
        copies: [],
        options: [],
      }),
      name: currentEngineName,
      currentId: currentEngineId || null,
      level: linkedEngine ? linkedEngine.level : agent.wEngineDetails.level,
      refinement: linkedEngine ? linkedEngine.refinement : agent.wEngineDetails.refinement,
      visual:
        currentEngineId && currentEngineName !== '未记录音擎'
          ? { entityId: currentEngineId, name: currentEngineName }
          : undefined,
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
      skillPriority: primarySkills,
      skillPriorityGroups: skillPriorityGroups.map((group) =>
        group.map((key) => recommendationSkills.find((skill) => skill.key === key)?.label ?? key),
      ),
      panel: graduationPanel,
      panelDirection: graduationPanel.length ? undefined : visibleSubStats || undefined,
      panelConditions: workbenchPanelConditionPresentation(presentedConditions.panelConditions),
      panelSourceNotes,
      teams: displayedGraduationTeams,
      engines: graduationEngines,
      engineConditions: presentedConditions.engineConditions,
      discs: {
        sets: graduationDiscSets,
        historicalReferences: historicalDiscReferences,
        directionNote: graduationDiscSets.length
          ? [
              ...discSetConditions,
              ...(workbenchDiscReference?.primaryNote ? [workbenchDiscReference.primaryNote] : []),
            ].join('；') || undefined
          : undefined,
        unavailableReason: undefined,
        mainStats,
        mainStatAlternatives: equipment?.graduationDisplay.mainStatAlternatives,
        subStats: visibleSubStats,
      },
    },
    decisionGuide: createAgentDevelopmentDecisionGuide({
      level: agent.level,
      mindscape: agent.mindscape,
      currentEngineName,
      discSource: visibleDiscSource,
      skillPriority: primarySkills,
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
      graduationPanel.filter((target) => target.placement !== 'reference'),
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
    comparisonTarget: routeProjection?.comparisonTarget,
    discSource: visibleDiscSource,
    discs: visibleDiscs,
  }
}
