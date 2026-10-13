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
  assertIntrinsicSummaryMatchesCurrentRating,
  intrinsicRatingBenchmark,
  type projectAccountIntrinsicCandidates,
} from './accountDecisionIntrinsicProjection'
import { createPriorityResult, marginalGain } from './accountCultivationPriority'

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
  const explicitSelectionOnly = Boolean(authorComparisonMembership || hasPreparedBenchmark32)
  const current = evaluateCurrent31TeamRating({
    candidateId: item.candidate.candidateId,
    memberIds: item.memberIds,
    bangbooId: item.candidate.bestBangbooId,
    outputPotentialBand: 'unknown',
    benchmark: intrinsicRatingBenchmark,
  })
  if (current.rating.status !== 'rated')
    throw new Error(`短名单 Team Rating 与全域投影不一致：${item.candidate.candidateId}。`)
  if (context.validationIntrinsicProjectionMode !== 'direct')
    assertIntrinsicSummaryMatchesCurrentRating(item.memberIds, current)
  const priorityInput = createCultivationPriorityInput({
    contract: teamDecisionAuthorityContractId,
    candidateId: item.candidate.candidateId,
    teamRating: current.rating,
    ...item.account,
    marginalAccountGain: marginalGain(current.rating, item.coverageGain),
    coverageGain: item.coverageGain,
  })
  return {
    candidateId: item.candidate.candidateId,
    teamStrengthOrder: explicitSelectionOnly
      ? null
      : (teamStrengthRankById.get(item.candidate.candidateId) ?? null),
    cultivationPriorityOrder: explicitSelectionOnly
      ? null
      : (cultivationRankById.get(item.candidate.candidateId) ?? null),
    memberIds: item.memberIds,
    bangbooId: explicitSelectionOnly ? null : item.candidate.bestBangbooId,
    benchmarkOutput: explicitSelectionOnly ? null : item.candidate.planningDps,
    ...(authorComparisonMembership || (!hasPreparedBenchmark32 && item.candidate.bestBangbooId)
      ? {}
      : {
          // Activation-only choices are not ranked recommendations. Check at
          // one star so the preview never assumes an unconfirmed star upgrade.
          bangbooAlternativeIds: teamBangbooActivationAlternatives(item.memberIds),
        }),
    outputPotential: item.output,
    featureVector: current.featureVector,
    teamRating: current.rating,
    mechanicValidity: current.mechanicValidity,
    combatEvidence: reviewedTeamCombatEvidence(item.memberIds, item.candidate.bestBangbooId),
    mechanicRating: current.mechanicRating,
    referencePerformance: current.referencePerformance,
    metaCalibration: current.metaCalibration,
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
