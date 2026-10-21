import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import { saveAccountPlanningDraft, type PlanningDraftInput } from '../accounts/planningDrafts'
import type { AccountPlanningDraft } from '../accounts/types'
import { verifyRemainingBoxReservationInTransaction } from '../application/remainingBox'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'
import { contentHash } from '../application/contentHash'
import { publicVersionIdentity } from '../application/publicVersionIdentity'
import { verifyTeamSaveChoice } from './useTeamSaveConfirmation'
import { resolveSavedPlanScenarioSelection } from './savedPlanIdentity'
import type { TeamAnalysisResult } from './teamAnalysisSession'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'
import type { PlanningProfile } from './planningProfile'
import { targetTeamEquipmentParametersFingerprint } from '../application/publicTargetTeamEquipmentFingerprint'
import {
  normalizeResourceTimelineDeclaration32,
  resourceTimelineDeclarationIdentity32,
} from '../calculation/resourceTimelineDeclarationContract32'
import { compileDeclaredResourceTimeline32 } from '../calculation/declaredResourceTimeline32'

type SavePlanEditorDraft = {
  accountId: string
  draft: PlanningDraftInput
  nextPlanId: string
  approved: AccountPlanningDraft | undefined
  team: Pick<DecisionTeamViewModel, 'agentIds'> | undefined
  selectedBangbooId: string | null
  candidateWarehouse: AccountPlanningDraft['candidateWarehouse']
  teamExecutionSnapshot: AccountPlanningDraft['teamExecutionSnapshot']
  teamEquipmentParameters: AccountPlanningDraft['teamEquipmentParameters']
  targetTeamFit: TargetTeamWarehouseFitQueryResult | undefined
  inputFingerprint: string
  exactVariantKey: string | undefined
  profiles: PlanningProfile[]
  remainingSession: TeamAnalysisResult | undefined
}

export async function persistPlanEditorDraft({
  accountId,
  draft,
  nextPlanId,
  approved,
  team,
  selectedBangbooId,
  candidateWarehouse,
  teamExecutionSnapshot,
  teamEquipmentParameters,
  targetTeamFit,
  inputFingerprint,
  exactVariantKey,
  profiles,
  remainingSession,
}: SavePlanEditorDraft) {
  const expectedSelection =
    draft.solutionContext?.scenarioSelection !== undefined
      ? resolveSavedPlanScenarioSelection(draft.solutionContext.scenarioSelection)
      : undefined
  const actualSelection =
    targetTeamFit?.scenarioSelection !== undefined
      ? resolveSavedPlanScenarioSelection(targetTeamFit.scenarioSelection)
      : undefined

  if (expectedSelection && actualSelection && expectedSelection.id !== actualSelection.id) {
    throw new Error('保存方案的比较场景与实际计算结果不一致。')
  }
  if (expectedSelection && expectedSelection.id !== 'normalized-comparison' && !actualSelection) {
    throw new Error('当前配装结果缺少失衡期比较元数据，不能作为失衡期方案保存。')
  }

  const savedScenarioSelection = actualSelection ?? expectedSelection
  const savedScenarioIdentity =
    targetTeamFit?.scenarioIdentity ?? draft.solutionContext?.scenarioIdentity
  if (savedScenarioSelection?.id === 'declared-stun-comparison' && !targetTeamFit?.scenarioIdentity)
    throw new Error('当前配装结果缺少失衡期计算身份，不能保存。')

  const declarations = normalizeReviewedEventConditionDeclarations32(
    targetTeamFit?.eventConditionDeclarationsByAgentId ??
      draft.solutionContext?.eventConditionDeclarationsByAgentId,
    team?.agentIds ?? draft.selection.agentIds,
  )
  const declarationIdentity = reviewedEventConditionDeclarationsIdentity32(declarations)
  const resourceTimeline = normalizeResourceTimelineDeclaration32(
    teamEquipmentParameters?.resourceTimelineDeclaration32 ??
      (draft.solutionContext as { resourceTimelineDeclaration32?: unknown } | undefined)
        ?.resourceTimelineDeclaration32,
    team?.agentIds ?? draft.selection.agentIds,
  )
  const resourceTimelineIdentity = resourceTimelineDeclarationIdentity32(resourceTimeline)
  if (resourceTimeline) {
    const benchmark = targetTeamFit?.accountBoundBenchmark
    const projection = benchmark?.calculationProjection
    if (
      draft.kind !== 'team' ||
      compileDeclaredResourceTimeline32(resourceTimeline).status !==
        'declared_resource_production' ||
      benchmark?.sourceInputFingerprint !== inputFingerprint ||
      benchmark.resourceTimelineDeclarationIdentity32 !== resourceTimelineIdentity ||
      projection?.status !== 'supported' ||
      projection.resourceTimeline32?.inputFingerprint !== resourceTimelineIdentity ||
      !targetTeamFit?.effectiveEquipmentParameters ||
      !teamEquipmentParameters ||
      targetTeamEquipmentParametersFingerprint({
        ...teamEquipmentParameters,
        resourceTimelineDeclaration32: undefined,
      }) !==
        targetTeamEquipmentParametersFingerprint({
          ...targetTeamFit.effectiveEquipmentParameters,
          resourceTimelineDeclaration32: undefined,
        })
    )
      throw new Error('资源事件或配装结果已变化，请重新计算后保存；原方案仍保留。')
  }
  if (
    declarationIdentity &&
    declarationIdentity !== targetTeamFit?.eventConditionDeclarationsIdentity
  )
    throw new Error('技能事件声明尚未进入本次配装结果，请重新匹配。')
  const luminizeRequested = teamEquipmentParameters?.luminizeComparison32 !== undefined
  const luminizeSnapshot = targetTeamFit?.accountBoundBenchmark?.luminizeSnapshot32
  if (
    draft.kind === 'team' &&
    luminizeRequested &&
    (!targetTeamFit?.effectiveEquipmentParameters ||
      targetTeamEquipmentParametersFingerprint(teamEquipmentParameters!) !==
        targetTeamEquipmentParametersFingerprint(targetTeamFit.effectiveEquipmentParameters))
  )
    throw new Error('辉映配装参数与本次计算不一致，请重新比较；原方案仍保留。')
  if (draft.kind === 'team' && luminizeRequested && luminizeSnapshot?.status !== 'supported')
    throw new Error('辉映配装快照尚未完成，请重新比较后保存；原方案仍保留。')
  const automaticLuminizeSnapshot =
    draft.kind === 'team' && !luminizeRequested && luminizeSnapshot?.status === 'supported'
  if (
    automaticLuminizeSnapshot &&
    (targetTeamFit?.accountBoundBenchmark.sourceInputFingerprint !== inputFingerprint ||
      !teamEquipmentParameters ||
      !targetTeamFit.effectiveEquipmentParameters ||
      targetTeamEquipmentParametersFingerprint(teamEquipmentParameters) !==
        targetTeamEquipmentParametersFingerprint(targetTeamFit.effectiveEquipmentParameters))
  )
    throw new Error('配装准备结果与本次输入不一致，请重新比较；原方案仍保留。')
  const savedStandardReference32 = targetTeamFit?.standardReference32
  const savedStandardReferenceRequest32 = targetTeamFit?.standardReferenceRequest32
  if (
    savedStandardReference32?.status === 'selected' &&
    (savedStandardReference32.consumerBindings?.status !== 'bound' ||
      !savedStandardReference32.preparedIdentity ||
      !savedStandardReference32.sourceBindingFingerprint ||
      !savedStandardReference32.selectionIdentity ||
      !savedStandardReference32.objectiveIdentity ||
      !savedStandardReference32.coverageIdentity)
  )
    throw new Error('标准三人参考尚未完成来源与消费者绑定，不能作为当前方案保存。')
  const savedLuminize =
    (luminizeRequested || automaticLuminizeSnapshot) && luminizeSnapshot?.status === 'supported'
      ? luminizeSnapshot.snapshot
      : draft.solutionContext?.declaredLuminizeSettlement32
  const input: PlanningDraftInput = {
    ...draft,
    id: nextPlanId,
    name: approved?.name ?? draft.name,
    selection:
      draft.kind === 'team'
        ? { ...draft.selection, agentIds: [...team!.agentIds], bangbooId: selectedBangbooId }
        : draft.selection,
    candidateWarehouse,
    // Existing snapshots are compatibility history, never recomputed by the editor.
    planningBenchmark32: draft.planningBenchmark32 ?? approved?.planningBenchmark32,
    teamExecutionSnapshot,
    teamAccountFactBinding: targetTeamFit?.accountFactBinding,
    teamEquipmentParameters:
      draft.kind === 'team' && teamEquipmentParameters
        ? {
            ...teamEquipmentParameters,
            ...(resourceTimeline === undefined
              ? {}
              : { resourceTimelineDeclaration32: resourceTimeline }),
          }
        : draft.teamEquipmentParameters,
    savedRole: draft.kind === 'team' ? 'current_reference' : draft.savedRole,
    solutionContext:
      draft.kind === 'team' && team && targetTeamFit
        ? {
            contract: 'soda-solution-context/v1',
            scope: 'team_joint',
            resourcePolicy: 'within_team_exclusive',
            sourceCandidateId: targetTeamFit.candidateId,
            inputFingerprint,
            solverMethod: targetTeamFit.solverMethod,
            gameVersion: publicVersionIdentity.gameVersion,
            knowledgeVersion: contentHash(
              profiles.map((profile) => [profile.id, profile.packageVersion]),
            ),
            exactVariantKey: exactVariantKey!,
            eventConditionDeclarationsByAgentId: declarations,
            eventConditionDeclarationsIdentity: declarationIdentity,
            ...(savedScenarioSelection ? { scenarioSelection: savedScenarioSelection } : {}),
            ...(savedScenarioIdentity ? { scenarioIdentity: savedScenarioIdentity } : {}),
            ...(savedStandardReference32
              ? { standardReference32: structuredClone(savedStandardReference32) }
              : {}),
            ...(targetTeamFit.formedTeamReference
              ? { formedTeamReference: structuredClone(targetTeamFit.formedTeamReference) }
              : {}),
            ...(savedStandardReferenceRequest32
              ? { standardReferenceRequest32: structuredClone(savedStandardReferenceRequest32) }
              : {}),
            ...(resourceTimeline === undefined
              ? {}
              : {
                  resourceTimelineDeclaration32: resourceTimeline,
                  resourceTimelineDeclarationIdentity32: resourceTimelineIdentity,
                }),
            ...(savedLuminize == null
              ? {}
              : {
                  declaredLuminizeSettlement32: savedLuminize,
                }),
          }
        : draft.solutionContext,
    warehouseRefs:
      candidateWarehouse?.loadouts.flatMap((loadout) => loadout.discIds) ?? draft.warehouseRefs,
  }
  return saveAccountPlanningDraft(accountId, input, undefined, async (db) => {
    if (draft.kind === 'team') await verifyTeamSaveChoice(db, accountId, team!.agentIds, approved)
    if (remainingSession?.reservations)
      await verifyRemainingBoxReservationInTransaction(db, accountId, remainingSession.reservations)
  })
}
