import {
  createCultivationPriorityInput,
  teamDecisionAuthorityContractId,
  type CultivationPriorityInput,
} from './teamDecisionAuthority'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { reviewedTeamCombatEvidence } from './reviewedTeamCombatEvidence'
import { teamBangbooActivationAlternatives } from './teamBangbooActivationAlternatives'
import type { reviewedAuthorComparisonMembership32 } from './reviewedAuthorComparisonMembership32'
import {
  intrinsicRatingBenchmark,
  type projectAccountIntrinsicCandidates,
} from './accountDecisionIntrinsicProjection'
import { createPriorityResult, marginalGain } from './accountCultivationPriority'
import { lookupCurrent31TeamIntrinsicDetails } from './current31TeamIntrinsicIndex'
import { projectGenericTeamRating } from './teamGenericRankingMethod'
import { resolveTeamMechanismDirection } from './teamMechanismDirection'
import {
  currentGenericTeamRankingStatus,
  lookupCurrentGenericTeamRankingForPlay,
} from './teamGenericRanking'
import { preparedBoxFormationRanking } from './preparedBoxFormationRanking'
import { selectDefaultTeamAdmissionPlay } from './defaultTeamAdmissionPlay'

export function projectAccountDecisionRecommendation(
  item: ReturnType<typeof projectAccountIntrinsicCandidates>[number] & {
    coverageGain: CultivationPriorityInput['coverageGain']
  },
  context: {
    explicitMembershipById: ReadonlyMap<
      string,
      NonNullable<ReturnType<typeof reviewedAuthorComparisonMembership32>>
    >
    preparedBenchmarkIds: ReadonlySet<string>
    teamStrengthRankById: ReadonlyMap<string, number>
    cultivationRankById: ReadonlyMap<string, number>
    validationIntrinsicProjectionMode?: 'indexed' | 'direct'
    deferDiagnosticInference?: boolean
    defaultAdmissionPlays?: ReadonlyMap<string, ReadonlySet<string>>
  },
) {
  const {
    explicitMembershipById,
    preparedBenchmarkIds,
    teamStrengthRankById,
    cultivationRankById,
  } = context
  const authorComparisonMembership = explicitMembershipById.get(item.candidate.candidateId)
  const hasPreparedBenchmark32 = preparedBenchmarkIds.has(item.candidate.candidateId)
  const explicitSelectionOnly = Boolean((authorComparisonMembership && !authorComparisonMembership.independentDefaultAdmission) || hasPreparedBenchmark32)
  const current =
    context.validationIntrinsicProjectionMode === 'direct'
      ? evaluateCurrent31TeamRating({
          candidateId: item.candidate.candidateId,
          memberIds: item.memberIds,
          bangbooId: item.candidate.bestBangbooId,
          outputPotentialBand: 'unknown',
          benchmark: intrinsicRatingBenchmark,
          reviewedOnly: context.deferDiagnosticInference,
        })
      : lookupCurrent31TeamIntrinsicDetails(item.memberIds, item.candidate.candidateId)
  if (!current || current.rating.status !== 'rated')
    throw new Error(`短名单 Team Rating 与全域投影不一致：${item.candidate.candidateId}。`)
  const direction =
    'mechanismDirection' in current
      ? current.mechanismDirection
      : resolveTeamMechanismDirection(item.memberIds)
  const selectedPlay = selectDefaultTeamAdmissionPlay(item.memberIds, direction,
    context.defaultAdmissionPlays?.get([...item.memberIds].sort().join('|')))
  // Both the generated projection and this path choose the same published
  // default. Keep direct validation and unbound admissions on the canonical reader.
  const preparedRanking =
    context.validationIntrinsicProjectionMode !== 'direct' &&
    context.defaultAdmissionPlays &&
    selectedPlay
      ? preparedBoxFormationRanking(item.memberIds, currentGenericTeamRankingStatus.contentHash)
      : undefined
  const currentRanking = preparedRanking === undefined
    ? lookupCurrentGenericTeamRankingForPlay(item.memberIds, selectedPlay)
    : preparedRanking
  const currentRating = projectGenericTeamRating(current.rating, currentRanking)
  if (currentRating.status !== 'rated')
    throw new Error(`推荐消费收到未通过当前通用资格的三人组合：${item.candidate.candidateId}。`)
  const priorityInput = createCultivationPriorityInput({
    contract: teamDecisionAuthorityContractId,
    candidateId: item.candidate.candidateId,
    teamRating: currentRating,
    ...item.account,
    marginalAccountGain: marginalGain(currentRating, item.coverageGain),
    coverageGain: item.coverageGain,
  })
  return {
    candidateId: item.candidate.candidateId,
    teamStrengthOrder:
      explicitSelectionOnly ||
      currentRanking?.genericOrder?.band === null ||
      currentRanking?.genericOrder?.orderScope === 'reference_display'
        ? null
        : (teamStrengthRankById.get(item.candidate.candidateId) ?? null),
    cultivationPriorityOrder: explicitSelectionOnly
      ? null
      : (cultivationRankById.get(item.candidate.candidateId) ?? null),
    memberIds: item.memberIds,
    playDirection: selectedPlay,
    ...(currentRanking ? { teamSystemRanking: currentRanking } : {}),
    bangbooId: explicitSelectionOnly ? null : item.candidate.bestBangbooId,
    benchmarkOutput: explicitSelectionOnly ? null : item.candidate.planningDps,
    ...((authorComparisonMembership && explicitSelectionOnly) || (!hasPreparedBenchmark32 && item.candidate.bestBangbooId)
      ? {}
      : {
          // Activation-only choices are not ranked recommendations. Check at
          // one star so the preview never assumes an unconfirmed star upgrade.
          bangbooAlternativeIds: teamBangbooActivationAlternatives(item.memberIds),
        }),
    outputPotential: item.output,
    formedTeamReference: 'formedTeamReference' in current ? current.formedTeamReference : undefined,
    featureVector: current.featureVector,
    teamRating: currentRating,
    mechanicValidity: current.mechanicValidity,
    combatEvidence: reviewedTeamCombatEvidence(item.memberIds, item.candidate.bestBangbooId),
    mechanicRating: current.mechanicRating,
    referencePerformance: current.referencePerformance,
    metaCalibration: current.metaCalibration,
    ...(context.deferDiagnosticInference ? { mechanicDiagnosticDeferred: true as const } : {}),
    mainstreamRecognition: current.mainstreamRecognition,
    accountInputs: {
      ...item.account,
      marginalAccountGain: priorityInput.marginalAccountGain,
      coverageGain: priorityInput.coverageGain,
    },
    cultivationPriority: createPriorityResult(priorityInput),
    ...(authorComparisonMembership ? { authorComparisonMembership } : {}),
    ...(hasPreparedBenchmark32 ? { hasPreparedBenchmark32: true as const } : {}),
  }
}
