import type { AccountDecisionRun } from './calculationQueryContract'
import { contentHash } from './contentHash'
import { developmentPanelDiscFingerprint } from './publicDevelopmentComparisonPanels'
import type {
  DevelopmentWorkbenchRouteSelection,
  DevelopmentWorkbenchRoutePresentation,
} from './publicDevelopmentWorkbenchRoute'
import { resolveSavedAgentPlanRoute } from '../pages/agentDevelopmentSavedPlanRoute'
import { projectDevelopmentCandidateAlternatives } from '../decision/developmentCandidateAlternatives'
import { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'
import { createDevelopmentPanelContext } from '../pages/agentDevelopmentPanelContext'
import {
  getCurrentBuildProfile,
  getBuildRecommendation,
  getSelectedBuildBranchId,
} from '../assault/currentBuildProfiles'
import {
  getCandidateWarehouseConstraint,
  candidateSetPlansForConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { candidateDiscRecommendations } from '../pages/candidateDiscRecommendations'
import {
  evaluateDevelopmentRecordedDiscs,
  developmentDiscFacts,
} from '../pages/developmentRecordedDiscEvaluation'
import { createAgentDevelopmentWorkbenchViewModel } from '../pages/agentDevelopmentWorkbenchViewModel'
import { developmentGraduationTargets } from '../pages/developmentGraduationTargets'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'

/** Private route producer: candidate assertions are checked against a fresh solve of the same captured run. */
export function projectDevelopmentWorkbenchRoute(
  run: AccountDecisionRun,
  selection: DevelopmentWorkbenchRouteSelection,
): DevelopmentWorkbenchRoutePresentation {
  const warehouse = run.input.warehouse
  const base = {
    contract: 'soda-development-workbench-route/v1' as const,
    runId: run.runId,
    accountId: warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    selection,
  }
  const unavailable = (
    status: Exclude<DevelopmentWorkbenchRoutePresentation['status'], 'ready'>,
  ): DevelopmentWorkbenchRoutePresentation => ({
    ...base,
    status,
    selectedDiscFingerprint: null,
    source: null,
    panel: null,
    setRecommendations: [],
    recordedEvaluation: null,
    discFacts: [],
    workbench: null,
    graduationPanel: [],
  })
  const agent = warehouse.roster.agents.find((item) => item.agentId === selection.agentId)
  if (!agent?.owned || !warehouse.accountId) return unavailable('missing')
  if (selection.requestedPlanId && selection.candidateRank !== null)
    return unavailable('candidate_mismatch')
  const saved = resolveSavedAgentPlanRoute({
    requestedPlanId: selection.requestedPlanId,
    agentId: selection.agentId,
    activePlanId: run.input.activePlanIds[selection.agentId],
    planningDrafts: run.input.drafts,
    discs: warehouse.discs,
  })
  if (saved.status === 'missing' || saved.status === 'references_changed')
    return unavailable(saved.status)
  if (saved.plan && typeof saved.plan.name !== 'string') return unavailable('missing')
  let candidateChoices: NonNullable<
    ReturnType<typeof projectDevelopmentCandidateAlternatives>['candidates']
  >[number]['loadouts'][number]['discs'] = []
  if (selection.candidateRank !== null) {
    if (
      !Number.isSafeInteger(selection.candidateRank) ||
      selection.candidateRank < 1 ||
      !selection.candidateLoadoutFingerprint
    )
      return unavailable('candidate_mismatch')
    const projection = projectDevelopmentCandidateAlternatives(run.input, selection.agentId)
    const loadout = projection.candidates[selection.candidateRank - 1]?.loadouts[0]
    if (!loadout || contentHash(loadout) !== selection.candidateLoadoutFingerprint)
      return unavailable('candidate_mismatch')
    candidateChoices = loadout.discs
  } else if (selection.candidateLoadoutFingerprint !== null)
    return unavailable('candidate_mismatch')
  const hasComparablePlan = candidateChoices.length === 6
  const candidateIds = candidateChoices.map((choice) => choice.disc.id)
  const equippedIds = agent.equippedDiscIds ?? []
  const selectedIds = hasComparablePlan ? candidateIds : (saved.plan?.warehouseRefs ?? equippedIds)
  const selectedDiscs = warehouse.discs
    .filter((disc) => selectedIds.includes(disc.id))
    .toSorted((a, b) => a.slot - b.slot)
  const source = hasComparablePlan
    ? ('仓库候选' as const)
    : saved.plan
      ? ('当前方案' as const)
      : selectedDiscs.length === 6
        ? ('当前已装备' as const)
        : ('未关联实体盘' as const)
  const panelProjection = createAgentDevelopmentPanelProjection({
    agent,
    discs: warehouse.discs,
    candidateDiscIds: hasComparablePlan ? candidateIds : null,
    planDiscIds: saved.plan?.warehouseRefs,
  })
  const panelContext = createDevelopmentPanelContext({
    coreLevel: agent.skillLevels.core,
    panelProjection,
    hasComparablePlan,
    candidateChoices,
    savedAgentBuild: saved.plan,
    currentDiscIds: equippedIds,
    data: { discs: warehouse.discs },
  })
  const buildProfile = getCurrentBuildProfile(selection.agentId)
  const recommendation = buildProfile
    ? getBuildRecommendation(
        buildProfile,
        getSelectedBuildBranchId(agent) ?? buildProfile.defaultBranchId,
      )
    : null
  const constraint = getCandidateWarehouseConstraint(selection.agentId)
  const profileSets = candidateDiscRecommendations(
    (recommendation?.sets ?? []).map((plan) => ({
      pattern: plan.pattern,
      primarySetIds: plan.primary,
      secondarySetIds: plan.secondary,
    })),
    undefined,
    panelContext,
  )
  const constrainedSets = candidateDiscRecommendations(
    constraint ? candidateSetPlansForConstraint(constraint) : [],
    constraint,
    panelContext,
  )
  const recordedEvaluation = hasComparablePlan
    ? null
    : evaluateDevelopmentRecordedDiscs(selection.agentId, selectedDiscs)
  const discFacts = developmentDiscFacts(
    selection.agentId,
    hasComparablePlan ? candidateChoices.map((choice) => choice.disc) : selectedDiscs,
    hasComparablePlan ? candidateChoices : (recordedEvaluation?.choices ?? []),
  )
  const targetPanel = getCurrentBuildTargetPanel(selection.agentId)
  const workbench = createAgentDevelopmentWorkbenchViewModel({
    agent,
    profile: getProjectedBuildKnowledgeProfile(selection.agentId),
    activePlan: saved.plan ?? null,
    discs: warehouse.discs,
    targetPanel: targetPanel ? { value: targetPanel.value, status: targetPanel.status } : null,
    panel: panelProjection.result,
  })
  const graduationPanel = developmentGraduationTargets(
    workbench.slices.goalState.sourcedFacts,
    constraint,
  ).map((fact) => ({ name: fact.label, value: fact.target }))
  return {
    ...base,
    status: 'ready',
    selectedDiscFingerprint: developmentPanelDiscFingerprint(selectedDiscs),
    source,
    panel: { source: panelProjection.source, result: panelProjection.result },
    setRecommendations: constraint ? constrainedSets : profileSets,
    recordedEvaluation,
    discFacts,
    workbench,
    graduationPanel,
  }
}
