import type { AccountPlanningDraft } from '../accounts/types'
import { contentHash } from './contentHash'

export const savedTeamReplayContract = 'soda-saved-team-replay/v1' as const

/** Only calculation-relevant saved fields; personal labels stay local. */
export function savedTeamReplayPlanHash(plan: AccountPlanningDraft) {
  return contentHash({
    id: plan.id,
    kind: plan.kind,
    revision: plan.revision,
    updatedAt: plan.updatedAt,
    memberIds: plan.selection.agentIds,
    bangbooId: plan.selection.bangbooId,
    equipmentParameters: plan.teamEquipmentParameters
      ? {
          wEngines: plan.teamEquipmentParameters.wEngines.map((engine) => ({
            agentId: engine.agentId,
            engineId: engine.engineId,
            refinement: engine.refinement,
          })),
          bangbooId: plan.teamEquipmentParameters.bangbooId,
          bangbooStars: plan.teamEquipmentParameters.bangbooStars,
          source: plan.teamEquipmentParameters.source,
        }
      : null,
    solutionContext: plan.solutionContext
      ? {
          contract: plan.solutionContext.contract,
          scope: plan.solutionContext.scope,
          resourcePolicy: plan.solutionContext.resourcePolicy,
          sourceCandidateId: plan.solutionContext.sourceCandidateId,
          inputFingerprint: plan.solutionContext.inputFingerprint,
          solverMethod: plan.solutionContext.solverMethod,
          gameVersion: plan.solutionContext.gameVersion,
          knowledgeVersion: plan.solutionContext.knowledgeVersion,
          exactVariantKey: plan.solutionContext.exactVariantKey,
        }
      : null,
  })
}

export type SavedTeamReplayPresentation = {
  contract: typeof savedTeamReplayContract
  runId: string
  accountId: string
  inputFingerprint: string
  planId: string
  planHash: string
  status: 'ready' | 'unavailable'
  match: ReturnType<
    typeof import('../pages/optimizer/savedPlanFreshness').currentSavedTeamBuildIntent
  > | null
}

export function acceptSavedTeamReplayPresentation(
  value: SavedTeamReplayPresentation | null | undefined,
  expected: Pick<
    SavedTeamReplayPresentation,
    'runId' | 'accountId' | 'inputFingerprint' | 'planId' | 'planHash'
  >,
): SavedTeamReplayPresentation | null {
  if (
    value?.contract !== savedTeamReplayContract ||
    value.runId !== expected.runId ||
    value.accountId !== expected.accountId ||
    value.inputFingerprint !== expected.inputFingerprint ||
    value.planId !== expected.planId ||
    value.planHash !== expected.planHash ||
    (value.status === 'ready' && !value.match) ||
    (value.status === 'unavailable' && value.match !== null)
  )
    return null
  return value
}
