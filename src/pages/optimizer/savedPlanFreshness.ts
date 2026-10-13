import { authorityTargetBuildDirection } from '../../decision/authorityTargetBuildDirection'
import { resolveAuthorityExecutionCandidate } from '../../decision/accountDecisionAuthorityExecutionCandidates'
import {
  createAccountTeamEngineBoxInput,
  createAuthorityExecutionVariantResolver,
} from '../../decision/authorityExecutionVariantResolver'
import { current31TeamEngineD1Pack } from '../../teamEngine/current31D1Pack'
import { reviewedAuthorComparisonMembership32 } from '../../decision/reviewedAuthorComparisonMembership32'
import { authorComparisonAccountBinding } from '../../application/publicAuthorComparisonAccountBinding'
import type { getAccountPlanningDraft } from '../../accounts/planningDrafts'
export { savedPlanStaleNotice } from '../../application/publicSavedPlanStaleNotice'
import type { CoreWarehouse } from '../../accounts/coreFlow'
import type { AccountDecisionSnapshot } from '../../application/calculationQueryContract'
import {
  compileTeamBuildIntent,
  compileAuthorComparisonTeamBuildIntent,
} from '../../decision/buildIntent'
import { candidatePanelInputsForScheme } from '../../optimizer/optimizeAccountBuilds'
import { authorityConsumerRecommendations } from '../../application/authorityConsumerRecommendations'
import {
  recommendedTargetBangbooDefault,
  selectPlayerConfirmableTargetBangbooSelection,
  sourceBangbooId,
  sourceSupportedTargetBangbooSelection,
  resolveTargetTeamBangbooOption,
} from '../../decision/targetTeamEquipmentParameters'
import type { BangbooStar } from '../../teamEngine/contracts'
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
  const parameters = plan.teamEquipmentParameters
  const bangbooStar = savedBangbooStar(parameters)
  const releasedOption = currentBangbooDirectory.some(
    (entry) =>
      entry.id === parameters.bangbooId &&
      entry.releaseState === 'released' &&
      entry.accountOwnable,
  )
  if (
    !candidate ||
    candidate.memberIds.length !== 3 ||
    new Set(candidate.memberIds).size !== 3 ||
    plan.selection.agentIds.length !== 3 ||
    new Set(plan.selection.agentIds).size !== 3 ||
    !bangbooStar ||
    !releasedOption ||
    plan.selection.bangbooId !== parameters.bangbooId
  )
    return undefined
  const execution = plan.teamExecutionSnapshot
  if (
    execution &&
    (execution.candidateId !== candidate.candidateId ||
      execution.bangbooId !== parameters.bangbooId ||
      execution.memberIds.length !== 3 ||
      new Set(execution.memberIds).size !== 3 ||
      !sameMembers(execution.memberIds))
  )
    return undefined
  if (parameters.source !== 'player_confirmed') {
    const sourceDefault =
      matchingAuthority?.bangbooId ?? (matchingEngine && sourceBangbooId(matchingEngine))
    const automaticDefault = sourceDefault
      ? null
      : recommendedTargetBangbooDefault({ memberIds: candidate.memberIds })
    const currentDefault = sourceDefault ?? automaticDefault?.bangbooId
    // An unconfirmed default must still be the current exact team's default.
    if (parameters.source !== 'source_defaults' || currentDefault !== parameters.bangbooId)
      return undefined
    if (automaticDefault && automaticDefault.defaultStars !== parameters.bangbooStars)
      return undefined
  }
  try {
    // The calculation route allows retained catalog choices with base skills,
    // independently of the legacy Engine's source/activation candidate set.
    selectPlayerConfirmableTargetBangbooSelection({
      memberIds: candidate.memberIds,
      primaryBangbooId: parameters.bangbooId,
      bangbooId: parameters.bangbooId,
      roster: warehouse.roster,
      bangbooStarsById: savedBangbooStarsById(parameters),
    })
  } catch {
    return undefined
  }
  const [firstAgentId, secondAgentId, thirdAgentId] = candidate.memberIds
  if (!firstAgentId || !secondAgentId || !thirdAgentId) return undefined
  const variantResolver = decision.allocation
    ? createAuthorityExecutionVariantResolver({
        pack: current31TeamEngineD1Pack,
        boxInput: createAccountTeamEngineBoxInput({
          warehouse,
          profiles: undefined,
          allocation: decision.allocation,
        }),
        baseCandidates: decision.teamEngine.recommendations,
      })
    : undefined
  const authorityExecutionCandidate = matchingAuthority
    ? resolveAuthorityExecutionCandidate(
        matchingAuthority,
        decision.teamEngine.recommendations,
        variantResolver,
      )
    : undefined
  const sourceEngineCandidate = authorityExecutionCandidate ?? matchingEngine
  // Replay the same exact formation/Bangboo/star producer used by the live fit.
  // A legacy reduced snapshot can only use its direct current Engine identity.
  const sourcePrimaryBangbooId = matchingAuthority
    ? (authorityTargetBuildDirection(matchingAuthority)?.bangbooId ?? parameters.bangbooId)
    : sourceEngineCandidate
      ? (sourceBangbooId(sourceEngineCandidate) ?? parameters.bangbooId)
      : parameters.bangbooId
  const sourceBangbooInput = {
    memberIds: candidate.memberIds,
    primaryBangbooId: sourcePrimaryBangbooId,
    engineCandidate: sourceEngineCandidate,
    roster: warehouse.roster,
    bangbooStarsById: { [parameters.bangbooId]: bangbooStar },
  }
  const originalSelection = sourceSupportedTargetBangbooSelection(sourceBangbooInput)
  const originalOptionIds =
    originalSelection.status === 'selected'
      ? [originalSelection.bangbooId, ...(originalSelection.alternativeBangbooIds ?? [])]
      : originalSelection.status === 'compatible_fallback'
        ? [originalSelection.bangbooId, ...originalSelection.bangbooIds]
        : []
  const selectedAuthorOption =
    !originalOptionIds.includes(parameters.bangbooId) &&
    Boolean(resolveTargetTeamBangbooOption(sourceBangbooInput, parameters.bangbooId))
  const engineCandidate =
    sourceEngineCandidate && variantResolver && !selectedAuthorOption
      ? variantResolver({
          memberIds: candidate.memberIds as [string, string, string],
          bangbooId: parameters.bangbooId,
          bangbooStar,
        })
      : sourceEngineCandidate
  if (sourceEngineCandidate && variantResolver && !selectedAuthorOption && !engineCandidate)
    return undefined
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
      // Tags come from the current exact producer; saved historical tags never supply them.
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
