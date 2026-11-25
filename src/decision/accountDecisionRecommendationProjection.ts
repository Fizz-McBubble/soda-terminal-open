import {
  createCultivationPriorityInput,
  teamDecisionAuthorityContractId,
  type CultivationPriorityInput,
} from './teamDecisionAuthority'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { reviewedTeamCombatEvidence } from './reviewedTeamCombatEvidence'
import { teamBangbooActivationAlternatives } from './teamBangbooActivationAlternatives'
import { reviewedAuthorComparisonMembership32 } from './reviewedAuthorComparisonMembership32'
import { isReviewedFallbackTeam } from './reviewedTeamRecommendationDisposition'
import { resolveCurrent31MainstreamRecognition } from './current31TeamMainstreamRecognition'
import {
  intrinsicRatingBenchmark,
  type projectAccountIntrinsicCandidates,
} from './accountDecisionIntrinsicProjection'
import { createPriorityResult, marginalGain } from './accountCultivationPriority'
import type { createAccountTeamIndexReader } from './accountTeamIndexReader'
import { projectGenericTeamRating } from './teamGenericRankingMethod'
import { resolveTeamMechanismDirection } from './teamMechanismDirection'
import {
  currentGenericTeamRankingStatus,
  lookupCurrentGenericTeamRankingForPlay,
} from './teamGenericRanking'
import { preparedBoxFormationRanking } from './preparedBoxFormationRanking'
import { selectDefaultTeamAdmissionPlay } from './defaultTeamAdmissionPlay'

export function projectExplicitMembership(
  projected: ReturnType<typeof projectAccountIntrinsicCandidates>,
  ownedAgentIds: string[],
  admissionByTeam: ReadonlyMap<string, { route: string; plays: ReadonlySet<string> }> | undefined,
  reader: ReturnType<typeof createAccountTeamIndexReader>,
) {
  return new Map(
    projected.flatMap((item) => {
      // Membership evidence cannot override invalid mechanics, hard player constraints,
      // or turn an unqualified source observation into a rated-strength claim.
      if (
        item.rating.status !== 'rated' ||
        item.rating.ratingBand !== 'Experimental' ||
        item.rating.confidence !== 'experimental'
      )
        return []
      const membership = reviewedAuthorComparisonMembership32(item.memberIds, ownedAgentIds)
      if (!membership) return []
      // A separately confirmed current recommendation already supersedes the
      // historical comparison-only membership.
      const recognition = resolveCurrent31MainstreamRecognition(item.memberIds)
      if (
        recognition.status === 'confirmed' &&
        recognition.historicalReferenceOnly === false &&
        !isReviewedFallbackTeam(item.memberIds)
      )
        return []
      const admitted = admissionByTeam?.get([...item.memberIds].sort().join('|'))
      const play =
        admitted?.route === 'exact_two_period_candidate'
          ? reader.offlineDetails(item.memberIds, item.candidate.candidateId)?.mechanismDirection.playability
          : null
      if (
        play &&
        admitted &&
        admitted.plays.has(reader.identifyPlay(play)) &&
        item.mechanicallyClosed &&
        item.systemRanking?.status === 'ranked' &&
        item.systemRanking.genericOrder?.status === 'recommended'
      )
        return [
          [
            item.candidate.candidateId,
            { ...membership, independentDefaultAdmission: true as const },
          ] as const,
        ]
      return [[item.candidate.candidateId, membership] as const]
    }),
  )
}

export function projectAccountDecisionRecommendation(
  item: ReturnType<typeof projectAccountIntrinsicCandidates>[number] & {
    coverageGain: CultivationPriorityInput['coverageGain']
  },
  context: ReturnType<typeof createAccountTeamIndexReader> & {
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
      : context.offlineDetails(item.memberIds, item.candidate.candidateId)
  if (!current || current.rating.status !== 'rated')
    throw new Error(`短名单 Team Rating 与全域投影不一致：${item.candidate.candidateId}。`)
  const direction =
    'mechanismDirection' in current
      ? current.mechanismDirection
      : resolveTeamMechanismDirection(item.memberIds)
  const selectedPlay = selectDefaultTeamAdmissionPlay(
    item.memberIds,
    direction,
    context.defaultAdmissionPlays?.get([...item.memberIds].sort().join('|')),
    context.identifyPlay,
  )
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
