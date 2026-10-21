/** Recommendation eligibility is independent of the per-carry display cap.
 * Diagnostic scores are retained for identity checks and never grant admission. */
import { resolveReviewedPhoenixTeam33 } from './reviewedPhoenixTeams33'
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
}

/** Default cards require independently rated source evidence or confirmed
 * mainstream membership. Model-only inferred trios remain searchable elsewhere
 * but cannot become confirmed defaults from a mechanism-weighted score. */
export function selectDefaultTeamRecommendationPool(
  ordered: readonly DefaultTeamRecommendationCandidate[],
  primaryOutputAgentId: (candidate: DefaultTeamRecommendationCandidate) => string | null,
  options: { includePortfolioFallback?: boolean } = {},
) {
  void options
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
    ])
    const previous = byId.get(candidate.candidateId)
    if (previous !== undefined) {
      if (previous !== identity) throw new Error('BOX 推荐收到同一候选 ID 的冲突事实。')
      continue
    }
    byId.set(candidate.candidateId, identity)
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
    return primary && entry.candidate.memberIds.includes(primary) ? [{ ...entry, primary }] : []
  })
  const defaults = eligible
  const eligibleIds = new Set(eligible.map(({ candidate }) => candidate.candidateId))
  const defaultIds = new Set<string>()
  for (const { candidate } of defaults) defaultIds.add(candidate.candidateId)
  return { eligibleIds, defaultIds }
}

/** Existing callers retain the bounded default-list contract. */
export function selectDefaultTeamRecommendationIds(
  ordered: readonly DefaultTeamRecommendationCandidate[],
  primaryOutputAgentId: (candidate: DefaultTeamRecommendationCandidate) => string | null,
) {
  return selectDefaultTeamRecommendationPool(ordered, primaryOutputAgentId).defaultIds
}
