import { saveAccountPlanningDraft, type PlanningDraftInput } from '../accounts/planningDrafts'
import type { AccountPlanningDraft } from '../accounts/types'
import { verifyRemainingBoxReservationInTransaction } from '../application/remainingBox'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'
import { contentHash } from '../application/contentHash'
import { publicVersionIdentity } from '../application/publicVersionIdentity'
import { verifyTeamSaveChoice } from './useTeamSaveConfirmation'
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

export function persistPlanEditorDraft({
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
  const input: PlanningDraftInput = {
    ...draft,
    id: nextPlanId,
    name: approved?.name ?? draft.name,
    selection:
      draft.kind === 'team'
        ? { ...draft.selection, agentIds: [...team!.agentIds], bangbooId: selectedBangbooId }
        : draft.selection,
    candidateWarehouse,
    teamExecutionSnapshot,
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
