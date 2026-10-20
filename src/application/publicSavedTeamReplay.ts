import { savedReviewedEventConditionDeclarationsIdentity32 } from '../calculation/reviewedEventConditionDeclarations32'
import type { AccountPlanningDraft } from '../accounts/types'
import { contentHash } from './contentHash'
import { savedLuminizeReplaySchema32, type SavedLuminizeReplay32 } from './savedLuminizeReplay32'

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
    ...(plan.teamAccountFactBinding
      ? {
          accountFactBinding: plan.teamAccountFactBinding,
          sourceMembership: plan.teamExecutionSnapshot?.authorComparisonMembership,
        }
      : {}),
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
          scenarioSelection: plan.solutionContext.scenarioSelection,
          scenarioIdentity: plan.solutionContext.scenarioIdentity,
          standardReference32: plan.solutionContext.standardReference32,
          standardReferenceRequest32: plan.solutionContext.standardReferenceRequest32,
          resourceTimelineDeclaration32: plan.solutionContext.resourceTimelineDeclaration32,
          resourceTimelineDeclarationIdentity32:
            plan.solutionContext.resourceTimelineDeclarationIdentity32,
          eventConditionDeclarationsIdentity: savedReviewedEventConditionDeclarationsIdentity32(
            plan.solutionContext.eventConditionDeclarationsByAgentId,
          ),
          ...(plan.solutionContext.declaredLuminizeSettlement32 === undefined
            ? {}
            : {
                declaredLuminizeSettlement32: plan.solutionContext.declaredLuminizeSettlement32,
              }),
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
  /** Sanitized independent volley result; never a team DPS or Formal result. */
  luminizeSettlement32?: SavedLuminizeReplay32
  /** Exact saved standard-reference provenance; current use must reissue its source gate. */
  standardReference32?: import('./targetTeamStandardReference32').TargetTeamStandardReferenceResult32
  /** Frozen issued request used to reissue the same standard goal on the current run. */
  standardReferenceRequest32?: import('./targetTeamStandardReference32').TargetTeamStandardReferenceRequest32
  match: ReturnType<
    typeof import('../decision/savedTeamBuildIntent').currentSavedTeamBuildIntent
  > | null
}

export function acceptSavedTeamReplayPresentation(
  value: SavedTeamReplayPresentation | null | undefined,
  expected: Pick<
    SavedTeamReplayPresentation,
    'runId' | 'accountId' | 'inputFingerprint' | 'planId' | 'planHash'
  > & {
    luminizeSnapshotFingerprint?: string
    standardReferenceIdentity?: string | null
  },
): SavedTeamReplayPresentation | null {
  const standardReferenceIdentity =
    value?.standardReference32?.selectionIdentity ??
    value?.standardReference32?.preparedIdentity ??
    null
  if (
    value?.contract !== savedTeamReplayContract ||
    value.runId !== expected.runId ||
    value.accountId !== expected.accountId ||
    value.inputFingerprint !== expected.inputFingerprint ||
    value.planId !== expected.planId ||
    value.planHash !== expected.planHash ||
    (value.status !== 'ready' && value.status !== 'unavailable') ||
    (value.status === 'ready' && !value.match) ||
    (value.status === 'unavailable' && value.match !== null) ||
    (standardReferenceIdentity ?? undefined) !== expected.standardReferenceIdentity
  )
    return null
  const luminize = value.luminizeSettlement32
  if ((luminize?.snapshotFingerprint ?? undefined) !== expected.luminizeSnapshotFingerprint)
    return null
  if (
    luminize !== undefined &&
    (!savedLuminizeReplaySchema32.safeParse(luminize).success ||
      (value.status === 'ready' && luminize.status !== 'declared_arithmetic'))
  )
    return null
  return value
}
