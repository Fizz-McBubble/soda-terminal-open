import { reviewedAuthorComparisonMembership32 } from '../../decision/reviewedAuthorComparisonMembership32'
import { authorComparisonAccountBinding } from '../../application/publicAuthorComparisonAccountBinding'
import type { getAccountPlanningDraft } from '../../accounts/planningDrafts'
export { savedPlanStaleNotice } from '../../application/publicSavedPlanStaleNotice'
import type { CoreWarehouse } from '../../accounts/coreFlow'
import type { AccountDecisionSnapshot } from '../../application/calculationQueryContract'
import {
  createAccountTeamEngineBoxInput,
  createAuthorityExecutionVariantResolver,
} from '../../decision/authorityExecutionVariantResolver'
import {
  compileTeamBuildIntent,
  compileAuthorComparisonTeamBuildIntent,
} from '../../decision/buildIntent'
import { candidatePanelInputsForScheme } from '../../optimizer/optimizeAccountBuilds'
import { authorityConsumerRecommendations } from '../../application/authorityConsumerRecommendations'
import {
  selectSupportedTargetBangbooSelection,
  selectPlayerConfirmableTargetBangbooSelection,
  sourceBangbooId,
  sourceSupportedTargetBangbooSelection,
} from '../../decision/targetTeamEquipmentParameters'
import type { BangbooSelection, BangbooStar } from '../../teamEngine/contracts'
import { current31TeamEngineD1Pack } from '../../teamEngine/current31D1Pack'
import { currentBangbooDirectory } from '../../assault/catalog'

function savedBangbooStar(parameters: { bangbooStars: number }) {
  const { bangbooStars } = parameters
  return Number.isInteger(bangbooStars) && bangbooStars >= 1 && bangbooStars <= 5
    ? (bangbooStars as BangbooStar)
    : undefined
}

function savedBangbooStarsById(parameters: { bangbooId: string; bangbooStars: number }) {
  const bangbooStar = savedBangbooStar(parameters)
  return bangbooStar ? ({ [parameters.bangbooId]: bangbooStar } as const) : undefined
}

function replayExactEngineCandidate(input: {
  warehouse: CoreWarehouse | undefined
  decision: AccountDecisionSnapshot
  memberIds: [string, string, string]
  bangbooId: string
  bangbooStar: BangbooStar
}) {
  if (!input.warehouse || !input.decision.allocation)
    return { attempted: false as const, candidate: undefined }
  const resolver = createAuthorityExecutionVariantResolver({
    pack: current31TeamEngineD1Pack,
    boxInput: createAccountTeamEngineBoxInput({
      warehouse: input.warehouse,
      profiles: undefined,
      allocation: input.decision.allocation,
      developmentPriorityAgentIds: input.decision.portfolioInput.preferredAgentIds,
    }),
    baseCandidates: input.decision.teamEngine.recommendations,
  })
  return {
    attempted: true as const,
    candidate: resolver({
      memberIds: input.memberIds,
      bangbooId: input.bangbooId,
      bangbooStar: input.bangbooStar,
    }),
  }
}

export function currentSavedTeamBuildIntent(
  plan: Awaited<ReturnType<typeof getAccountPlanningDraft>>,
  decision: AccountDecisionSnapshot | undefined,
  warehouse: CoreWarehouse | undefined,
) {
  if (plan?.kind === 'team' && decision && warehouse && plan.teamAccountFactBinding) {
    const candidate = authorityConsumerRecommendations(decision.decisionAuthority).find(
      (row) => row.candidateId === plan.solutionContext?.sourceCandidateId,
    )
    const ids = plan.selection.agentIds
    const owned = warehouse.roster.agents.filter((row) => row.owned).map((row) => row.agentId)
    const source = reviewedAuthorComparisonMembership32(ids, owned)
    if (
      !candidate?.authorComparisonMembership ||
      !source ||
      ids.length !== 3 ||
      candidate.memberIds.some((id) => !ids.includes(id)) ||
      plan.selection.bangbooId !== null ||
      plan.teamExecutionSnapshot?.bangbooId !== null ||
      plan.teamExecutionSnapshot.authorComparisonMembership?.fingerprint !== source.fingerprint
    )
      return undefined
    const binding = authorComparisonAccountBinding(warehouse, ids, source.fingerprint)
    if (binding.fingerprint !== plan.teamAccountFactBinding.fingerprint) return undefined
    return {
      buildIntent: compileAuthorComparisonTeamBuildIntent({
        candidateId: candidate.candidateId,
        memberIds: ids as [string, string, string],
        ownedAgentIds: owned,
        agentStateById: Object.fromEntries(
          warehouse.roster.agents.map((row) => [
            row.agentId,
            { potentialImage: row.potentialImage },
          ]),
        ),
      }),
      effectiveEquipmentParameters: undefined,
      accountFactBinding: binding,
    }
  }
  if (!plan || plan.kind !== 'team' || !decision || !warehouse || !plan.teamEquipmentParameters)
    return undefined
  const sameMembers = (memberIds: readonly string[]) =>
    memberIds.length === plan.selection.agentIds.length &&
    memberIds.every((agentId) => plan.selection.agentIds.includes(agentId))
  const sourceCandidateId = plan.solutionContext?.sourceCandidateId
  const authorityCandidates = authorityConsumerRecommendations(decision.decisionAuthority)
  const matchingAuthority = authorityCandidates.find(
    (candidate) => candidate.candidateId === sourceCandidateId && sameMembers(candidate.memberIds),
  )
  const matchingEngine = decision.teamEngine.recommendations.find(
    (candidate) => candidate.candidateId === sourceCandidateId && sameMembers(candidate.memberIds),
  )
  const candidate = matchingAuthority ?? matchingEngine
  const unboundEngine = !matchingAuthority?.bangbooId
    ? decision.teamEngine.recommendations.find(
        (item) =>
          sameMembers(item.memberIds) &&
          item.bangbooSelection?.status === 'no_authoritative_recommendation',
      )
    : undefined
  let playerConfirmedSourceSelection: BangbooSelection | undefined
  if (candidate && unboundEngine && plan.teamEquipmentParameters.source === 'player_confirmed') {
    try {
      playerConfirmedSourceSelection = selectPlayerConfirmableTargetBangbooSelection({
        memberIds: candidate.memberIds,
        primaryBangbooId: plan.teamEquipmentParameters.bangbooId,
        bangbooId: plan.teamEquipmentParameters.bangbooId,
        engineCandidate: unboundEngine,
        roster: warehouse.roster,
        bangbooStarsById: savedBangbooStarsById(plan.teamEquipmentParameters),
      })
    } catch {
      return undefined
    }
  }
  const resolvedSourceBangbooId =
    matchingAuthority?.bangbooId ??
    (matchingEngine && sourceBangbooId(matchingEngine)) ??
    (playerConfirmedSourceSelection ? plan.teamEquipmentParameters.bangbooId : null) ??
    (matchingAuthority &&
    !matchingEngine &&
    !unboundEngine &&
    plan.teamEquipmentParameters.source === 'player_confirmed' &&
    currentBangbooDirectory.some(
      (entry) =>
        entry.id === plan.teamEquipmentParameters!.bangbooId &&
        entry.releaseState === 'released' &&
        entry.accountOwnable,
    )
      ? plan.teamEquipmentParameters.bangbooId
      : null)
  if (
    !candidate ||
    !resolvedSourceBangbooId ||
    candidate.memberIds.length !== 3 ||
    plan.selection.bangbooId !== plan.teamEquipmentParameters.bangbooId
  )
    return undefined
  const sourceEngineCandidate =
    (matchingEngine && sourceBangbooId(matchingEngine) === resolvedSourceBangbooId
      ? matchingEngine
      : undefined) ??
    decision.teamEngine.recommendations.find(
      (item) => sameMembers(item.memberIds) && sourceBangbooId(item) === resolvedSourceBangbooId,
    ) ??
    unboundEngine
  const [firstAgentId, secondAgentId, thirdAgentId] = candidate.memberIds
  const bangbooStar = savedBangbooStar(plan.teamEquipmentParameters)
  if (!firstAgentId || !secondAgentId || !thirdAgentId || !bangbooStar) return undefined
  const exactEngineReplay = replayExactEngineCandidate({
    warehouse,
    decision,
    memberIds: [firstAgentId, secondAgentId, thirdAgentId],
    bangbooId: plan.teamEquipmentParameters.bangbooId,
    bangbooStar,
  })
  // If this remains an Engine-backed direction, a requested star that no longer
  // forms the exact candidate is a real stale condition. An Authority-only exact
  // direction is still executable for physical-disc planning, but has no scenario.
  if (sourceEngineCandidate && exactEngineReplay.attempted && !exactEngineReplay.candidate)
    return undefined
  const engineCandidate = exactEngineReplay.candidate ?? sourceEngineCandidate
  const sourceSelection =
    (!exactEngineReplay.candidate && playerConfirmedSourceSelection) ||
    sourceSupportedTargetBangbooSelection({
      memberIds: candidate.memberIds,
      primaryBangbooId: resolvedSourceBangbooId,
      engineCandidate,
      roster: warehouse.roster,
      // The saved parameter is an explicit scheme condition. Replaying the
      // generic S-rank default here can select a different formation variant
      // (for example Belion's source-backed S3 activation) and make a just-saved
      // plan stale after a read-only app restart.
      bangbooStarsById: savedBangbooStarsById(plan.teamEquipmentParameters),
    })
  try {
    selectSupportedTargetBangbooSelection({
      selection: sourceSelection,
      bangbooId: plan.teamEquipmentParameters.bangbooId,
    })
  } catch {
    return undefined
  }
  return {
    buildIntent: compileTeamBuildIntent({
      optimizerOptions: {
        panelInputsByAgent: candidatePanelInputsForScheme(
          warehouse.roster.agents,
          candidate.memberIds,
          plan.teamEquipmentParameters.wEngines,
        ),
      },
      candidateId: candidate.candidateId,
      memberIds: [firstAgentId, secondAgentId, thirdAgentId],
      bangbooId: plan.teamEquipmentParameters.bangbooId,
      // Use only the currently replayed producer. An Authority exact identity
      // without a current Engine replay deliberately stays empty rather than
      // borrowing a scenario from history or a different Bangboo variant.
      scenarioTags: engineCandidate?.scenarioTags,
      agentStateById: Object.fromEntries(
        warehouse.roster.agents.map((agent) => [
          agent.agentId,
          { potentialImage: agent.potentialImage },
        ]),
      ),
    }),
    effectiveEquipmentParameters: plan.teamEquipmentParameters,
    accountFactBinding: undefined,
  }
}
