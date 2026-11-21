import type { BangbooStar, TeamEngineCandidate } from '../teamEngine/contracts'
import { normalizeReviewedEventConditionDeclarations32 } from '../calculation/reviewedEventConditionDeclarations32'
import { compileTeamBuildIntent } from '../decision/buildIntent'
import { findReviewedDiscPlay } from '../decision/reviewedTeamDiscPairs'
import { defaultTargetTeamEquipmentParameters } from '../decision/targetTeamEquipmentParameters'
import { projectTeamEquipmentRecommendations } from '../decision/teamEquipmentRecommendations'
import { candidatePanelInputsForScheme } from '../optimizer/candidatePanelInputsForScheme'
import { targetTeamBuildDirectionConditions } from './targetTeamEffectivePotentialConditions'
import type { AccountDecisionRun, CalculationQueryClient } from './calculationQueryContract'

export function explicitBangbooStar(stars: number): BangbooStar {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('邦布星级必须在 1–5 星。')
  return stars as BangbooStar
}

export function prepareLocalTargetTeamSolve({
  query,
  run,
  candidate,
  compatibleBangbooSelection,
  selectedBangbooId,
  executionIdentity,
  ratedPlayId,
}: {
  query: Parameters<CalculationQueryClient['calculateTargetTeamWarehouseFit']>[0]
  run: AccountDecisionRun
  candidate: Pick<Parameters<typeof compileTeamBuildIntent>[0], 'candidateId' | 'memberIds'>
  compatibleBangbooSelection: Parameters<
    typeof projectTeamEquipmentRecommendations
  >[0]['bangbooSelection']
  selectedBangbooId: Parameters<typeof compileTeamBuildIntent>[0]['bangbooId']
  executionIdentity: Pick<Parameters<typeof compileTeamBuildIntent>[0], 'scenarioTags'>
  ratedPlayId?: string | null
}) {
  // Resolve the same scheme defaults before solving; these are planning assumptions, not ownership.
  const schemeParameters =
    query.equipmentParameters ??
    defaultTargetTeamEquipmentParameters({
      memberIds: [...candidate.memberIds],
      equipmentRecommendations: projectTeamEquipmentRecommendations({
        includeReviewedSourceOptions: true,
        memberIds: candidate.memberIds,
        bangbooSelection: compatibleBangbooSelection,
        roster: run.input.warehouse.roster,
      }),
    })
  // Use the same per-call potential assumptions as the numeric context. Keep
  // missing observations intact for the capability resolver's unknown policy;
  // this overlay never changes the account roster.
  const eventConditionDeclarationsByAgentId = normalizeReviewedEventConditionDeclarations32(
    query.eventConditionDeclarationsByAgentId,
    candidate.memberIds,
  )
  const directionConditions = targetTeamBuildDirectionConditions({
    memberIds: candidate.memberIds,
    roster: run.input.warehouse.roster,
    potentialByAgentId: schemeParameters?.potentialByAgentId,
  })
  const panelInputsByAgent = candidatePanelInputsForScheme(
    run.input.warehouse.roster.agents,
    candidate.memberIds,
    schemeParameters?.wEngines,
    directionConditions.agentStateById,
  )
  const review = findReviewedDiscPlay(candidate.memberIds, ratedPlayId)
  const buildIntent = compileTeamBuildIntent({
    reviewedDiscPlay: review && { playId: review.playId, evidence: review.evidence },
    candidateId: candidate.candidateId,
    memberIds: candidate.memberIds,
    bangbooId: selectedBangbooId,
    scenarioTags: executionIdentity.scenarioTags,
    ...(panelInputsByAgent ? { optimizerOptions: { panelInputsByAgent } } : {}),
    ...directionConditions,
  })

  return { schemeParameters, eventConditionDeclarationsByAgentId, buildIntent }
}

export function defaultSchemeBangbooId(candidate: TeamEngineCandidate) {
  if (candidate.bangbooId) return candidate.bangbooId
  const selection = candidate.bangbooSelection
  if (selection.status === 'selected' || selection.status === 'compatible_fallback')
    return selection.bangbooId
  return null
}
