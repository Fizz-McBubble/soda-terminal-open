import type { TeamEngineCandidate, TeamEnginePack } from '../teamEngine/contracts'
import { currentReviewedTeamSourceDirections } from '../gameDataPacks/reviewedTeamSourceDirections'
import { evaluateCurrent31TeamRating } from '../decision/current31TeamRating'
import { reviewedTeamAnalysis } from '../decision/reviewedTeamAnalysis'
import { reviewedTeamPublishedStrength } from '../decision/reviewedTeamPublishedStrength'
import { getAgentName } from '../application/publicRosterNames'

export type TeamLoadoutCompletionCandidate = {
  id: string
  kernelId: string
  memberIds: string[]
  /** Every member already owned in the real account, including reserved members. */
  ownedAgentIds: string[]
  /** Compatibility projection for the existing member-gap presentation. */
  ownedCoreAgentIds: string[]
  /** Owned members excluded from this analysis scope, never presented as unowned. */
  unavailableOwnedAgentIds: string[]
  missingAgentIds: string[]
  missingRole: 'core' | 'eligible_third'
  failureCode: 'missing_core_agent' | 'no_eligible_third'
  sourceIds: string[]
  label: string
}

/**
 * Acquisition advice needs exact reviewed strength, independently of whether
 * the legacy Engine happened to reject a kernel for this BOX. In particular,
 * owning one eligible third must not hide another reviewed one-member path.
 * Reviewed-only evaluation retains version continuity and hard mechanic gates
 * without promoting a model prediction into an acquisition recommendation.
 */
export function projectTeamLoadoutCompletionCandidates(input: {
  /** Compatibility only: rejected kernels are not the acquisition universe. */
  rejected?: readonly TeamEngineCandidate[]
  /** Real account ownership before any remaining-BOX reservation is applied. */
  ownedAgentIds: readonly string[]
  /** Members allowed in this run; defaults to the complete owned roster. */
  availableAgentIds?: readonly string[]
  pack: Pick<TeamEnginePack, 'kernels'>
}): TeamLoadoutCompletionCandidate[] {
  const owned = new Set(input.ownedAgentIds)
  const available = new Set(input.availableAgentIds ?? input.ownedAgentIds)
  const key = (ids: readonly string[]) => [...ids].sort().join('|')
  const withdrawn = new Set([
    ...reviewedTeamAnalysis.records.filter((row) => row.withdrawn).map((row) => key(row.memberIds)),
    ...reviewedTeamPublishedStrength.facts
      .filter((row) => row.withdrawn)
      .map((row) => key(row.memberIds)),
  ])
  const projected: { candidate: TeamLoadoutCompletionCandidate; rank: number }[] = []

  for (const direction of currentReviewedTeamSourceDirections()) {
    const memberIds = [...direction.memberIds]
    if (withdrawn.has(key(memberIds))) continue
    const ownedAgentIds = memberIds.filter((agentId) => owned.has(agentId))
    const missingAgentIds = memberIds.filter((agentId) => !owned.has(agentId))
    const unavailableOwnedAgentIds = ownedAgentIds.filter((agentId) => !available.has(agentId))
    // A member-gap card is an actionable one-member completion, not a long
    // acquisition list or a workaround for members reserved by another team.
    if (missingAgentIds.length !== 1 || unavailableOwnedAgentIds.length) continue
    const rating = evaluateCurrent31TeamRating({
      candidateId: `completion:${key(memberIds)}`,
      memberIds: direction.memberIds,
      bangbooId: null,
      outputPotentialBand: 'unknown',
      benchmark: {
        status: 'unavailable',
        baselineId: null,
        outputIndex: null,
        unsupportedIssueIds: [],
        explanation: '补强建议只使用已审阅的精确三人来源评级。',
      },
      reviewedOnly: true,
    })
    if (
      rating.mechanicValidity === 'invalid' ||
      rating.rating.status !== 'rated' ||
      (rating.rating.ratingBand !== 'S+' &&
        rating.rating.ratingBand !== 'S' &&
        rating.rating.ratingBand !== 'A+') ||
      rating.metaCalibration.status !== 'aligned' ||
      rating.metaCalibration.evidenceStatus === 'conflict' ||
      rating.metaCalibration.authority === 'model_inference' ||
      rating.metaCalibration.evidenceRefs.length === 0 ||
      rating.mainstreamRecognition.status !== 'confirmed' ||
      (rating.mainstreamRecognition.historicalReferenceOnly &&
        !rating.metaCalibration.referenceContinuity)
    )
      continue

    const kernel = input.pack.kernels.find((item) =>
      item.eligibleThirdAgentIds.some((third) =>
        key([...item.coreAgentIds, third]) === key(memberIds),
      ),
    )
    const kernelId = kernel?.kernelId ?? `source:${key(memberIds)}`
    const ownedCoreAgentIds = kernel
      ? kernel.coreAgentIds.filter((agentId) => owned.has(agentId))
      : ownedAgentIds

    const missingRole = kernel?.coreAgentIds.includes(missingAgentIds[0]!)
      ? ('core' as const)
      : ('eligible_third' as const)
    const id = `completion:${key(memberIds)}:${missingAgentIds[0]}`
    projected.push({
      rank: rating.rating.ratingBand === 'S+' ? 3 : rating.rating.ratingBand === 'S' ? 2 : 1,
      candidate: {
        id,
        kernelId,
        memberIds,
        ownedAgentIds,
        ownedCoreAgentIds,
        unavailableOwnedAgentIds,
        missingAgentIds,
        missingRole,
        failureCode: missingRole === 'core' ? 'missing_core_agent' : 'no_eligible_third',
        sourceIds: [...new Set(rating.metaCalibration.evidenceRefs)],
        label: memberIds.map(getAgentName).join(' · '),
      },
    })
  }

  return projected
    .sort((left, right) =>
      right.rank - left.rank || left.candidate.id.localeCompare(right.candidate.id),
    )
    .map((item) => item.candidate)
}
