import { developmentBuildContext } from './developmentBuildContext'
import { contentHash } from './contentHash'
import { developmentPanelDiscFingerprint } from './publicDevelopmentComparisonPanels'
import type {
  DevelopmentWorkbenchRoutePresentation,
  DevelopmentCurrentRecord,
} from './publicDevelopmentWorkbenchRoute'
import { developmentCurrentRecordBinding } from './publicDevelopmentWorkbenchRoute'
import { resolveSavedAgentPlanRoute } from '../pages/agentDevelopmentSavedPlanRoute'
import { readSavedAgentComparisonContext } from './readSavedAgentComparisonContext'
import { developmentComparisonParametersSchema } from '../accounts/developmentComparisonParametersSchema'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
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
import { resolvePersonalReferenceDiscs } from '../accounts/personalCurrentReference'
import { developmentGraduationTargets } from '../pages/developmentGraduationTargets'
import { developmentPanelTargetPresentation } from '../pages/developmentPanelTargetPresentation'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'
import { resolveWEngine } from '../decision/wEngineResolver'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import type {
  DevelopmentWorkbenchFactsInput,
  DevelopmentWorkbenchFactsPresentation,
} from './publicDevelopmentWorkbenchFacts'
import type { DevelopmentWorkbenchEquipmentDecision } from './publicDevelopmentWorkbenchPresentation'
import type { PersonalDevelopmentRoute } from './publicPersonalDevelopment'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmarkProjection'

type RouteBody = Omit<
  DevelopmentWorkbenchRoutePresentation,
  'contract' | 'runId' | 'accountId' | 'inputFingerprint' | 'selection'
>
type ReadBase =
  | Pick<
      DevelopmentWorkbenchRoutePresentation,
      'contract' | 'runId' | 'accountId' | 'inputFingerprint' | 'selection'
    >
  | Pick<
      DevelopmentWorkbenchFactsPresentation,
      'contract' | 'authority' | 'accountId' | 'inputFingerprint' | 'selection'
    >
  | Pick<
      PersonalDevelopmentRoute,
      | 'contract'
      | 'sessionId'
      | 'generationIdentity'
      | 'accountId'
      | 'inputFingerprint'
      | 'selection'
    >
type CandidateLoadout = CandidateWarehousePlan['loadouts'][number]

/** Shared real-fact projection; candidate resolution is injected only by the run-backed route. */
export function projectDevelopmentWorkbenchReadProjection<T extends ReadBase>({
  input,
  base,
  currentRecord,
  equipment,
  resolveCandidate,
  scoringParameters,
}: {
  input: DevelopmentWorkbenchFactsInput
  base: T
  currentRecord?: DevelopmentCurrentRecord
  equipment: (
    agent: NonNullable<DevelopmentWorkbenchFactsInput['warehouse']['roster']['agents'][number]>,
  ) => DevelopmentWorkbenchEquipmentDecision | null
  resolveCandidate?: () => CandidateLoadout | undefined
  scoringParameters?: DevelopmentComparisonParameters
}): T & RouteBody {
  const warehouse = input.warehouse
  const selection = base.selection
  const unavailable = (
    status: Exclude<DevelopmentWorkbenchRoutePresentation['status'], 'ready'>,
  ): T & RouteBody => ({
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
  const capturedAgent = warehouse.roster.agents.find((item) => item.agentId === selection.agentId)
  if (!capturedAgent?.owned || !warehouse.accountId) return unavailable('missing')
  if (
    currentRecord &&
    (currentRecord.accountId !== warehouse.accountId ||
      currentRecord.agent.agentId !== selection.agentId ||
      !currentRecord.agent.owned ||
      currentRecord.revision !== contentHash(currentRecord.agent) ||
      selection.candidateRank !== null ||
      selection.candidateLoadoutFingerprint !== null ||
      currentRecord.selectedDiscIds.length > 6 ||
      new Set(currentRecord.selectedDiscIds).size !== currentRecord.selectedDiscIds.length ||
      currentRecord.selectedDiscIds.some((id) => !warehouse.discs.some((disc) => disc.id === id)))
  )
    return unavailable('references_changed')
  const agent = currentRecord ? { ...capturedAgent, ...currentRecord.agent } : capturedAgent
  if (
    (selection.preferEquipped && (selection.requestedPlanId || selection.candidateRank !== null)) ||
    (selection.requestedPlanId && selection.candidateRank !== null)
  )
    return unavailable('candidate_mismatch')
  const saved = selection.preferEquipped
    ? { status: 'current' as const, plan: undefined }
    : resolveSavedAgentPlanRoute({
        requestedPlanId: selection.requestedPlanId,
        agentId: selection.agentId,
        activePlanId: input.activePlanIds[selection.agentId],
        planningDrafts: input.drafts,
        discs: warehouse.discs,
      })
  if (saved.status === 'missing' || saved.status === 'references_changed')
    return unavailable(saved.status)
  if (saved.plan && typeof saved.plan.name !== 'string') return unavailable('missing')
  const equipmentResult = equipment(agent)
  const savedContext =
    saved.plan && selection.candidateRank === null
      ? readSavedAgentComparisonContext(saved.plan, selection.agentId)
      : null
  // Candidate parameters are rank-bound. Omitted dimensions use the same
  // current-account basis as the solver; historical saved omissions stay unknown.
  const parsedCandidate =
    selection.candidateRank !== null && scoringParameters !== undefined
      ? developmentComparisonParametersSchema.safeParse(scoringParameters)
      : null
  if (
    parsedCandidate &&
    (!parsedCandidate.success ||
      (parsedCandidate.data.potential !== undefined && !supportsPotentialImage(selection.agentId)))
  )
    return unavailable('candidate_mismatch')
  if (
    savedContext &&
    (savedContext.parameters.wEngine.state === 'invalid' ||
      savedContext.parameters.potential.state === 'invalid')
  )
    return unavailable('references_changed')
  const candidateParameters = parsedCandidate?.success ? parsedCandidate.data : undefined
  const currentEngine = resolveWEngine({ agent, legacyWEngines: warehouse.roster.wEngines }).current
  const currentPotential = developmentComparisonParametersSchema.shape.potential.safeParse(
    agent.potentialImage,
  )
  const comparison = savedContext
    ? {
        source: 'saved_plan' as const,
        wEngine:
          savedContext.parameters.wEngine.state === 'recorded'
            ? savedContext.parameters.wEngine.value
            : null,
        potential:
          savedContext.parameters.potential.state === 'recorded'
            ? savedContext.parameters.potential.value
            : null,
      }
    : selection.candidateRank !== null
      ? {
          source: 'candidate' as const,
          wEngine: candidateParameters?.wEngine ?? currentEngine ?? null,
          potential:
            candidateParameters?.potential ??
            (currentPotential.success ? (currentPotential.data ?? null) : null),
        }
      : null
  const appliedEngine = savedContext ? comparison?.wEngine : candidateParameters?.wEngine
  const appliedPotential = savedContext ? comparison?.potential : candidateParameters?.potential
  const comparisonAgent =
    appliedEngine != null || appliedPotential != null
      ? {
          ...agent,
          ...(appliedPotential == null ? {} : { potentialImage: appliedPotential }),
          ...(appliedEngine
            ? {
                wEngineDetails: {
                  id: appliedEngine.engineId,
                  name: null,
                  level: appliedEngine.level,
                  ascension: appliedEngine.ascension,
                  refinement: appliedEngine.refinement,
                },
              }
            : {}),
        }
      : agent
  const resolvedTargetEngine = comparison?.wEngine
    ? resolveWEngine({ agent: comparisonAgent, legacyWEngines: warehouse.roster.wEngines }).current
    : null
  const comparisonTarget = comparison
    ? {
        source: comparison.source,
        wEngine: comparison.wEngine
          ? {
              engineId: comparison.wEngine.engineId,
              name: resolvedTargetEngine?.name ?? comparison.wEngine.engineId,
              level: comparison.wEngine.level,
              ...(comparison.wEngine.ascension === undefined
                ? {}
                : { ascension: comparison.wEngine.ascension }),
              refinement: comparison.wEngine.refinement,
            }
          : null,
        potential: comparison.potential,
      }
    : null
  let candidateChoices: CandidateLoadout['discs'] = []
  if (selection.candidateRank !== null) {
    if (
      !Number.isSafeInteger(selection.candidateRank) ||
      selection.candidateRank < 1 ||
      !selection.candidateLoadoutFingerprint
    )
      return unavailable('candidate_mismatch')
    const loadout = resolveCandidate?.()
    if (
      !loadout ||
      loadout.agentId !== selection.agentId ||
      contentHash(loadout) !== selection.candidateLoadoutFingerprint
    )
      return unavailable('candidate_mismatch')
    candidateChoices = loadout.discs
  } else if (selection.candidateLoadoutFingerprint !== null)
    return unavailable('candidate_mismatch')
  const hasComparablePlan = candidateChoices.length === 6
  const candidateIds = candidateChoices.map((choice) => choice.disc.id)
  const equippedIds = agent.equippedDiscIds ?? []
  const savedIds = saved.plan
    ? resolvePersonalReferenceDiscs(saved.plan, warehouse.discs)?.map((disc) => disc.id)
    : undefined
  const selectedIds =
    currentRecord?.selectedDiscIds ?? (hasComparablePlan ? candidateIds : (savedIds ?? equippedIds))
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
    agent: comparisonAgent,
    discs: warehouse.discs,
    candidateDiscIds: hasComparablePlan ? candidateIds : null,
    planDiscIds: currentRecord?.selectedDiscIds ?? savedIds,
  })
  const panelContext = createDevelopmentPanelContext({
    coreLevel: agent.skillLevels.core,
    mindscape: agent.mindscape,
    panelProjection,
    hasComparablePlan,
    candidateChoices,
    savedDiscIds: savedIds,
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
  const setRecommendations = constraint
    ? candidateDiscRecommendations(
        candidateSetPlansForConstraint(constraint),
        constraint,
        panelContext,
      )
    : candidateDiscRecommendations(
        (recommendation?.sets ?? []).map((plan) => ({
          pattern: plan.pattern,
          primarySetIds: plan.primary,
          secondarySetIds: plan.secondary,
        })),
        undefined,
        panelContext,
      )
  if (
    hasComparablePlan &&
    candidateChoices.some((choice) => {
      const actual = selectedDiscs.find((disc) => disc.id === choice.disc.id)
      return !actual || contentHash(actual) !== contentHash(choice.disc)
    })
  )
    return unavailable('references_changed')
  const independentDirection = hasComparablePlan
    ? candidateParameters?.independentDirection
    : savedContext?.comparisonParameters?.independentDirection
  const recordedEvaluation =
    savedContext?.parameters.independentDirection.state === 'invalid'
      ? null
      : evaluateDevelopmentRecordedDiscs(selection.agentId, selectedDiscs, { independentDirection })
  const discFacts = developmentDiscFacts(
    selection.agentId,
    selectedDiscs,
    recordedEvaluation?.choices ?? [],
  )
  const targetBuildContext = developmentBuildContext(comparisonAgent)
  const targetPresentationContext = {
    ...targetBuildContext,
    agentId: selection.agentId,
  }
  const targetPanel = getCurrentBuildTargetPanel(selection.agentId, targetBuildContext)
  const workbench = createAgentDevelopmentWorkbenchViewModel({
    agent,
    profile: getProjectedBuildKnowledgeProfile(selection.agentId),
    activePlan: saved.plan ?? null,
    activePlanDiscIds: savedIds,
    discs: warehouse.discs,
    targetPanel,
    targetContext: targetPresentationContext,
    panel: panelProjection.result,
    discSelection: { source, discIds: selectedIds },
  })
  const graduationPanel = developmentPanelTargetPresentation({
    facts: workbench.slices.goalState.sourcedFacts,
    relevantFacts: developmentGraduationTargets(
      workbench.slices.goalState.sourcedFacts,
      constraint,
    ),
    panel: targetPanel,
    context: targetPresentationContext,
  })
  return {
    ...base,
    status: 'ready',
    selectedDiscFingerprint: developmentPanelDiscFingerprint(selectedDiscs),
    source,
    panel: { source: panelProjection.source, result: panelProjection.result },
    setRecommendations,
    recordedEvaluation,
    discFacts,
    workbench,
    graduationPanel,
    equipment: equipmentResult,
    ...(comparisonTarget ? { comparisonTarget } : {}),
    ...(currentRecord
      ? { currentRecordBinding: developmentCurrentRecordBinding(currentRecord) }
      : {}),
  }
}
