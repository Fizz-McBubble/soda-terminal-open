/** Recommendation eligibility is independent of the per-carry display cap.
 * Diagnostic scores are retained for identity checks and never grant admission. */
import { resolveReviewedPhoenixTeam33 } from './reviewedPhoenixTeams33'
import type { CurrentPlayRanking } from './teamGraduatedRankingProjection'

import {
  hasTeamSystemRankingAuthority,
  compareTeamSystemRankingAuthority,
} from './teamSystemRankingAuthority'
export {
  hasTeamSystemRankingAuthority,
  compareTeamSystemRankingAuthority,
} from './teamSystemRankingAuthority'

export type DefaultTeamRecommendationCandidate = {
  candidateId: string
  memberIds: readonly string[]
  sourceRecommended: boolean
  explicitSelectionOnly: boolean
  inferredStrength: boolean
  ratingStatus: string
  ratingBand: string | null
  confidence: string | null
  mechanicallyClosed: boolean
  recommendationScore: number | null
  /** Excludes model promotion of source fallbacks, not an independently reviewed tier. */
  sourceExcluded: boolean
  /** Exact-team withdrawal overrides every default route, including source ratings. */
  withdrawn?: boolean
  accountPrerequisiteStatus?: 'eligible' | 'condition-not-met' | 'condition-unknown'
  /** Production offline authority. A ranked row supersedes legacy rating/source gates. */
  teamSystemRanking?: CurrentPlayRanking | null
}

/** Production-ranked trios enter defaults directly. Until that authority is
 * available, default cards require independently rated source evidence or
 * confirmed mainstream membership; a model-only score never grants admission. */
export function selectDefaultTeamRecommendationPool(
  ordered: readonly DefaultTeamRecommendationCandidate[],
  primaryOutputAgentId: (candidate: DefaultTeamRecommendationCandidate) => string | null,
  options: { includePortfolioFallback?: boolean; admission?: (candidate: DefaultTeamRecommendationCandidate) => { tier: 'exact' | 'alternative'; primary: string } | null } = {},
) {
  const hasSystemRankingAuthority = ordered.some((candidate) =>
    hasTeamSystemRankingAuthority(candidate.teamSystemRanking),
  )
  const byId = new Map<string, string>()
  const candidates: Array<{
    candidate: DefaultTeamRecommendationCandidate
    primary: string | null
    triple: string
  }> = []
  for (const candidate of ordered) {
    if (
      typeof candidate.candidateId !== 'string' ||
      !candidate.candidateId.trim() ||
      !Array.isArray(candidate.memberIds) ||
      candidate.memberIds.length !== 3 ||
      candidate.memberIds.some((id) => typeof id !== 'string' || !id.trim() || id !== id.trim()) ||
      new Set(candidate.memberIds).size !== 3
    )
      continue
    const triple = JSON.stringify([...candidate.memberIds].sort())
    // A repeated ID must not inherit eligibility from a different occurrence.
    const identity = JSON.stringify([
      triple,
      candidate.sourceRecommended,
      candidate.explicitSelectionOnly,
      candidate.inferredStrength,
      candidate.ratingStatus,
      candidate.ratingBand,
      candidate.confidence,
      candidate.mechanicallyClosed,
      Number.isFinite(candidate.recommendationScore) ? candidate.recommendationScore : null,
      candidate.sourceExcluded,
      candidate.withdrawn === true,
      candidate.accountPrerequisiteStatus ?? null,
      candidate.teamSystemRanking
        ? [
            candidate.teamSystemRanking.status,
            candidate.teamSystemRanking.contentHash,
            candidate.teamSystemRanking.status === 'ranked'
              ? candidate.teamSystemRanking.system
              : null,
            candidate.teamSystemRanking.status === 'ranked'
              ? candidate.teamSystemRanking.systemRank
              : null,
          ]
        : null,
    ])
    const previous = byId.get(candidate.candidateId)
    if (previous !== undefined) {
      if (previous !== identity) throw new Error('BOX 推荐收到同一候选 ID 的冲突事实。')
      continue
    }
    byId.set(candidate.candidateId, identity)
    const systemRanking = candidate.teamSystemRanking
    if (candidate.accountPrerequisiteStatus && candidate.accountPrerequisiteStatus !== 'eligible')
      continue
    if (hasSystemRankingAuthority) {
      if (
        candidate.explicitSelectionOnly ||
        candidate.withdrawn === true ||
        candidate.ratingStatus !== 'rated' ||
        (!systemRanking?.genericOrder &&
          !candidate.mechanicallyClosed &&
          !resolveReviewedPhoenixTeam33(candidate.memberIds)) ||
        (systemRanking?.genericOrder && systemRanking.genericOrder.status !== 'recommended') ||
        systemRanking?.status !== 'ranked'
      )
        continue
      candidates.push({ candidate, primary: null, triple })
      continue
    }
    if (
      candidate.explicitSelectionOnly ||
      candidate.ratingStatus !== 'rated' ||
      candidate.withdrawn === true ||
      !['S+', 'S', 'A+', 'A', 'B'].includes(candidate.ratingBand ?? '') ||
      candidate.confidence === 'experimental' ||
      (!candidate.mechanicallyClosed && !resolveReviewedPhoenixTeam33(candidate.memberIds)) ||
      candidate.sourceExcluded
    )
      continue
    if (!candidate.sourceRecommended) continue
    candidates.push({ candidate, primary: null, triple })
  }
  const primaryCache = new Map<string, string | null>()
  const eligible = candidates.flatMap((entry) => {
    const id = entry.candidate.candidateId
    if (!primaryCache.has(id)) primaryCache.set(id, primaryOutputAgentId(entry.candidate))
    const primary = primaryCache.get(id)
    if (entry.candidate.teamSystemRanking?.genericOrder?.status === 'recommended' && !primary)
      return [entry]
    return primary && entry.candidate.memberIds.includes(primary) ? [{ ...entry, primary }] : []
  })
  // Preserve an actionable account fallback if its owned teams have no entry
  // in the current, evidence-bound default scope.
  let defaultEligible = eligible
  if (options.admission) {
    const classified = eligible.map((entry) => ({ entry, admission: options.admission!(entry.candidate) }))
    const exactCores = new Set(classified.flatMap(({ admission }) =>
      admission?.tier === 'exact' ? [admission.primary] : [],
    ))
    const admitted = classified.filter(({ entry, admission }) =>
      Boolean(entry.candidate.teamSystemRanking?.genericOrder?.referenceInterval) ||
      // A completed score belongs to the admitted play. Another roster
      // option with a guide entry cannot remove it before score ordering.
      (admission && (entry.candidate.teamSystemRanking?.graduatedScore ||
        admission.tier === 'exact' || !exactCores.has(admission.primary))),
    ).map(({ entry }) => entry)
    defaultEligible = admitted.length ? admitted : eligible.slice(0, 1)
  }
  const defaults = [...defaultEligible].sort((left, right) =>
    compareTeamSystemRankingAuthority(
      left.candidate.teamSystemRanking,
      right.candidate.teamSystemRanking,
    ),
  )
  const eligibleIds = new Set(eligible.map(({ candidate }) => candidate.candidateId))
  const defaultIds = new Set<string>()
  for (const { candidate } of defaults) defaultIds.add(candidate.candidateId)
  return {
    eligibleIds,
    defaultIds,
    orderedCandidateIds: defaults.map(({ candidate }) => candidate.candidateId),
    usesSystemRanking: hasSystemRankingAuthority,
  }
}

/** Existing callers retain the bounded default-list contract. */
export function selectDefaultTeamRecommendationIds(
  ordered: readonly DefaultTeamRecommendationCandidate[],
  primaryOutputAgentId: (candidate: DefaultTeamRecommendationCandidate) => string | null,
) {
  return selectDefaultTeamRecommendationPool(ordered, primaryOutputAgentId).defaultIds
}
