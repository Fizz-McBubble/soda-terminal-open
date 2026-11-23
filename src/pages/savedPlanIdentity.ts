import { savedReviewedEventConditionDeclarationsIdentity32 } from '../calculation/reviewedEventConditionDeclarations32'
import type { AccountPlanningDraft } from '../accounts/types'
import { contentHash } from '../application/contentHash'
import type {
  TargetTeamWarehouseFitQuery,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { savedTeamReplayPlanHash } from '../application/publicSavedTeamReplay'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import { defaultPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'

export function resolveSavedPlanScenarioSelection(
  selection?: CurrentPlanningScenarioSelection32 | null,
): CurrentPlanningScenarioSelection32 {
  if (selection === undefined) {
    return defaultPlanningScenarioSelection32
  }
  if (
    selection === null ||
    typeof selection !== 'object' ||
    Array.isArray(selection) ||
    selection.schemaVersion !== 1 ||
    (selection.id !== 'normalized-comparison' && selection.id !== 'declared-stun-comparison') ||
    Object.keys(selection).some((k) => k !== 'schemaVersion' && k !== 'id')
  ) {
    throw new Error(`不支持或未知的规划场景：${String((selection as { id?: unknown })?.id)}。`)
  }
  return selection
}

/** Construct the same captured-plan binding for every saved-fit request. */
export function savedTeamTargetReplayBinding(
  plan: AccountPlanningDraft | null | undefined,
  accountId: string | undefined,
  inputFingerprint: string | undefined,
): TargetTeamWarehouseFitQuery['savedPlanReplay'] {
  return plan && inputFingerprint !== undefined
    ? {
        planId: plan.id,
        planHash: savedTeamReplayPlanHash(plan),
        accountId: accountId ?? '',
        inputFingerprint,
      }
    : undefined
}

function sameSavedDiscIds(left: readonly string[], right: readonly string[]) {
  return (
    left.length === 6 &&
    right.length === 6 &&
    new Set(left).size === 6 &&
    new Set(right).size === 6 &&
    [...left].sort().join('|') === [...right].sort().join('|')
  )
}

export function currentSavedDiscReplay(
  plan: AccountPlanningDraft | null | undefined,
  accountId: string | undefined,
  inputFingerprint: string | undefined,
): TargetTeamWarehouseFitQuery['savedPlanReplay'] {
  const binding = savedTeamTargetReplayBinding(plan, accountId, inputFingerprint)
  return binding ? { ...binding, sourcePolicy: 'current_sources' } : undefined
}

/** Read only the persisted, mutually consistent eighteen-disc assignment. */
export function savedTeamDiscAssignments(plan: AccountPlanningDraft) {
  const ids = plan.selection.agentIds
  const loadouts = plan.candidateWarehouse?.loadouts
  const execution = plan.teamExecutionSnapshot
  if (
    plan.kind !== 'team' ||
    ids.length !== 3 ||
    new Set(ids).size !== 3 ||
    !loadouts ||
    loadouts.length !== 3 ||
    new Set(loadouts.map((row) => row.agentId)).size !== 3 ||
    !execution ||
    execution.members.length !== 3 ||
    new Set(execution.members.map((row) => row.agentId)).size !== 3 ||
    ids.some((id) => {
      const loadout = loadouts.find((row) => row.agentId === id)
      const member = execution.members.find((row) => row.agentId === id)
      return !loadout || !member || !sameSavedDiscIds(loadout.discIds, member.suggested.discIds)
    })
  )
    return null
  const discIds = loadouts.flatMap((row) => row.discIds)
  const sameReferences = (refs: readonly string[]) =>
    refs.length === 18 && new Set(refs).size === 18 && refs.every((id) => discIds.includes(id))
  if (
    new Set(discIds).size !== 18 ||
    !sameReferences(plan.warehouseRefs) ||
    (execution.physicalDiscIds && !sameReferences(execution.physicalDiscIds))
  )
    return null
  return ids.map((agentId) => ({
    agentId,
    discIds: [...loadouts.find((row) => row.agentId === agentId)!.discIds],
  }))
}

/** A current fit is usable only when all three persisted disc assignments still match. */
export function savedTeamTargetFitMatchesSavedDiscs(
  plan: AccountPlanningDraft,
  targetTeamFit: TargetTeamWarehouseFitQueryResult,
  expectedReplay?: TargetTeamWarehouseFitQuery['savedPlanReplay'],
) {
  if (expectedReplay && contentHash(targetTeamFit.savedPlanReplay) !== contentHash(expectedReplay))
    return false
  const currentSources = expectedReplay?.sourcePolicy === 'current_sources'
  const planDeclarationIdentity = savedReviewedEventConditionDeclarationsIdentity32(
    plan.solutionContext?.eventConditionDeclarationsByAgentId,
  )
  const fitDeclarationIdentity = savedReviewedEventConditionDeclarationsIdentity32(
    targetTeamFit.eventConditionDeclarationsByAgentId,
  )
  if (
    planDeclarationIdentity === 'invalid-event-condition-declarations32' ||
    planDeclarationIdentity !== fitDeclarationIdentity ||
    (fitDeclarationIdentity &&
      fitDeclarationIdentity !== targetTeamFit.eventConditionDeclarationsIdentity) ||
    (plan.solutionContext?.eventConditionDeclarationsIdentity &&
      planDeclarationIdentity !== plan.solutionContext.eventConditionDeclarationsIdentity)
  )
    return false
  const planScenario = resolveSavedPlanScenarioSelection(plan.solutionContext?.scenarioSelection)
  const fitScenario = resolveSavedPlanScenarioSelection(targetTeamFit.scenarioSelection)
  if (planScenario.id !== fitScenario.id) {
    return false
  }
  if (
    planScenario.id !== 'normalized-comparison' &&
    (!plan.solutionContext?.scenarioIdentity || !targetTeamFit.scenarioIdentity)
  )
    return false
  if (
    plan.solutionContext?.scenarioIdentity &&
    targetTeamFit.scenarioIdentity &&
    plan.solutionContext.scenarioIdentity !== targetTeamFit.scenarioIdentity
  ) {
    return false
  }
  if (
    plan.solutionContext?.scenarioIdentity &&
    !targetTeamFit.scenarioIdentity &&
    planScenario.id !== 'normalized-comparison'
  ) {
    return false
  }
  const savedStandard = plan.solutionContext?.standardReference32
  if (savedStandard) {
    const currentStandard = targetTeamFit.standardReference32
    if (!currentStandard || currentStandard.status !== savedStandard.status) return false
    if (
      savedStandard.status === 'selected' &&
      (currentStandard.selectionIdentity !== savedStandard.selectionIdentity ||
        currentStandard.objectiveIdentity !== savedStandard.objectiveIdentity ||
        currentStandard.coverageIdentity !== savedStandard.coverageIdentity)
    )
      return false
    if (
      savedStandard.status === 'metadata' &&
      !currentSources &&
      (currentStandard.preparedIdentity !== savedStandard.preparedIdentity ||
        currentStandard.sourceBindingFingerprint !== savedStandard.sourceBindingFingerprint)
    )
      return false
  }

  const savedLoadouts = savedTeamDiscAssignments(plan)
  const savedExecution = plan.teamExecutionSnapshot
  if (
    !savedLoadouts ||
    !savedExecution ||
    savedLoadouts.length !== 3 ||
    savedExecution.members.length !== 3
  )
    return false
  const savedIds = new Set(savedLoadouts.flatMap((loadout) => loadout.discIds))
  if (savedIds.size !== 18 || savedLoadouts.some((loadout) => loadout.discIds.length !== 6))
    return false
  return (
    plan.selection.agentIds.length === 3 &&
    plan.selection.agentIds.every((agentId) => {
      const savedLoadout = savedLoadouts.find((loadout) => loadout.agentId === agentId)
      const savedMember = savedExecution.members.find((member) => member.agentId === agentId)
      const currentLoadout = targetTeamFit.warehousePlan.loadouts.find(
        (loadout) => loadout.agentId === agentId,
      )
      return Boolean(
        savedLoadout &&
        savedMember &&
        currentLoadout &&
        sameSavedDiscIds(savedLoadout.discIds, savedMember.suggested.discIds) &&
        sameSavedDiscIds(
          savedLoadout.discIds,
          currentLoadout.discs.map((choice) => choice.disc.id),
        ),
      )
    })
  )
}

/** A validated current read never rewrites the stored deployment or historical result. */
export function savedDiscFitState(
  plan: AccountPlanningDraft | null | undefined,
  fit: TargetTeamWarehouseFitQueryResult,
  identity: string,
  expectedReplay: TargetTeamWarehouseFitQuery['savedPlanReplay'],
) {
  if (!plan || !savedTeamTargetFitMatchesSavedDiscs(plan, fit, expectedReplay))
    return { identity, status: 'mismatch' as const }
  return {
    identity,
    status: 'ready' as const,
    fit: {
      ...fit,
      targetExecution: {
        ...fit.targetExecution,
        deploymentOrder: plan.teamExecutionSnapshot?.deploymentOrder,
      },
    },
  }
}

export function savedTeamDiscAssignmentFingerprint(plan: AccountPlanningDraft) {
  const scenarioSelection = resolveSavedPlanScenarioSelection(
    plan.solutionContext?.scenarioSelection,
  )
  return contentHash({
    planId: plan.id,
    scenarioSelection,
    scenarioIdentity: plan.solutionContext?.scenarioIdentity ?? null,
    eventConditionDeclarationsIdentity:
      savedReviewedEventConditionDeclarationsIdentity32(
        plan.solutionContext?.eventConditionDeclarationsByAgentId,
      ) ?? null,
    candidateWarehouse: plan.candidateWarehouse?.loadouts
      .map((loadout) => ({ agentId: loadout.agentId, discIds: [...loadout.discIds].sort() }))
      .sort((left, right) => left.agentId.localeCompare(right.agentId)),
    executionSnapshot: plan.teamExecutionSnapshot?.members
      .map((member) => ({ agentId: member.agentId, discIds: [...member.suggested.discIds].sort() }))
      .sort((left, right) => left.agentId.localeCompare(right.agentId)),
  })
}
