import type { AccountDecisionRun } from './calculationQueryContract'
import {
  savedTeamReplayContract,
  savedTeamReplayPlanHash,
  type SavedTeamReplayPresentation,
} from './publicSavedTeamReplay'
import { currentSavedTeamBuildIntent } from '../decision/savedTeamBuildIntent'
import { inspectSavedLuminizeReplay32, sealSavedLuminizeReplay32 } from './savedLuminizeReplay32'
import {
  declaredLuminizeBoundary32,
  evaluateReviewedLuminizeSettlement32,
} from '../calculation/reviewedLuminizeSettlement32'
import { accountLuminizeEquipmentBoundary32 } from './publicLuminizeComparison32'
import { assertCurrentPlanningResourceTimeline32 } from '../accounts/resourceTimelinePlanPersistence32'

export function projectPrivateSavedTeamReplay(
  run: AccountDecisionRun,
  planId: string,
  planHash: string,
): SavedTeamReplayPresentation {
  const plan = run.input.drafts.find((draft) => draft.id === planId)
  if (!plan || plan.kind !== 'team' || savedTeamReplayPlanHash(plan) !== planHash)
    throw new Error('已保存方案不属于当前分析，或其内容已变化。')
  const inspected = inspectSavedLuminizeReplay32(plan)
  let resourceTimelineCurrent = true
  try {
    assertCurrentPlanningResourceTimeline32(plan)
  } catch {
    resourceTimelineCurrent = false
  }
  let match =
    inspected.status === 'invalid' || inspected.status === 'stale' || !resourceTimelineCurrent
      ? null
      : (currentSavedTeamBuildIntent(plan, run.snapshot, run.input.warehouse) ?? null)
  let luminizeSettlement32: SavedTeamReplayPresentation['luminizeSettlement32']
  if (inspected.status !== 'not_declared') {
    const saved = plan.solutionContext?.declaredLuminizeSettlement32
    const nonEmpty = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : null
    const failed = (status: 'invalid' | 'stale' | 'unavailable', blockers: string[]) =>
      sealSavedLuminizeReplay32({
        contract: 'soda-saved-luminize-replay32/v1',
        status,
        sourceIdentityHash: nonEmpty(saved?.declaration?.sourceIdentityHash),
        snapshotFingerprint: nonEmpty(saved?.snapshotFingerprint),
        inputFingerprint: null,
        totalDamage: null,
        instances: [],
        blockers,
        boundary: declaredLuminizeBoundary32,
        formalCycleReady: false,
        modelQualification32: null,
      })
    if (inspected.status === 'invalid' || inspected.status === 'stale') {
      luminizeSettlement32 = failed(inspected.status, inspected.blockers)
    } else if (!match) {
      luminizeSettlement32 = failed('unavailable', ['luminize_saved_current_team_unavailable'])
    } else {
      const ids = match.buildIntent.agentIds
      const declared = inspected.snapshot.declaration
      if (
        ids.length !== declared.memberAgentIds.length ||
        new Set(ids).size !== ids.length ||
        ids.some((agentId) => !declared.memberAgentIds.includes(agentId))
      ) {
        luminizeSettlement32 = failed('invalid', ['luminize_saved_current_team_mismatch'])
      } else {
        try {
          const calculated = evaluateReviewedLuminizeSettlement32(declared)
          luminizeSettlement32 =
            calculated.status === 'declared_arithmetic'
              ? sealSavedLuminizeReplay32({
                  contract: 'soda-saved-luminize-replay32/v1',
                  status: 'declared_arithmetic',
                  sourceIdentityHash: calculated.sourceIdentityHash,
                  snapshotFingerprint: inspected.snapshot.snapshotFingerprint,
                  inputFingerprint: calculated.inputFingerprint,
                  totalDamage: calculated.totalDamage,
                  instances: calculated.instances.map((row) => ({
                    id: row.id,
                    ownerAgentId: row.ownerAgentId,
                    attribute: row.attribute,
                    damage: row.nonCriticalDamage,
                  })),
                  blockers: [],
                  boundary: declared.eventId.startsWith('account-equipment-static-volley:')
                    ? accountLuminizeEquipmentBoundary32
                    : calculated.boundary,
                  formalCycleReady: false,
                  modelQualification32: null,
                })
              : failed('invalid', calculated.blockers)
        } catch {
          luminizeSettlement32 = failed('invalid', ['luminize_saved_recalculation_failed'])
        }
      }
      if (luminizeSettlement32.status !== 'declared_arithmetic') match = null
    }
  }
  return {
    contract: savedTeamReplayContract,
    runId: run.runId,
    accountId: run.input.warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    planId,
    planHash,
    status: match ? 'ready' : 'unavailable',
    match,
    ...(plan.solutionContext?.formedTeamReference
      ? { formedTeamReference: structuredClone(plan.solutionContext.formedTeamReference) }
      : {}),
    ...(plan.solutionContext?.standardReference32
      ? { standardReference32: structuredClone(plan.solutionContext.standardReference32) }
      : {}),
    ...(plan.solutionContext?.standardReferenceRequest32
      ? {
          standardReferenceRequest32: structuredClone(
            plan.solutionContext.standardReferenceRequest32,
          ),
        }
      : {}),
    ...(luminizeSettlement32 === undefined ? {} : { luminizeSettlement32 }),
  }
}
