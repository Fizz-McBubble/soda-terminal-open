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

type SavePlanEditorDraft = {
  accountId: string
  draft: PlanningDraftInput
  nextPlanId: string
  approved: AccountPlanningDraft | undefined
  team: DecisionTeamViewModel | undefined
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
  if (
    declarationIdentity &&
    declarationIdentity !== targetTeamFit?.eventConditionDeclarationsIdentity
  )
    throw new Error('技能事件声明尚未进入本次配装结果，请重新匹配。')
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
        ? teamEquipmentParameters
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
