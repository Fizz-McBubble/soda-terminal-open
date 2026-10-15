/** Recommendation eligibility is independent of the per-carry display cap.
 * Scores and source tiers are inputs; this selector never changes either. */
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

/** Preserve the default 80-point admission rule and account-wide 70-point fallback.
 * Portfolios can separately request all valid existing 70-point backup directions.
 * The uncapped pool is used only for member-disjoint portfolios. The bounded set
 * remains the default card/shortlist policy, not a proof that other trios are illegal. */
export function selectDefaultTeamRecommendationPool(
  ordered: readonly DefaultTeamRecommendationCandidate[],
  primaryOutputAgentId: (candidate: DefaultTeamRecommendationCandidate) => string | null,
  options: { includePortfolioFallback?: boolean } = {},
) {
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
      candidate.confidence === 'experimental'
    )
      continue
    if (candidate.sourceRecommended) {
      candidates.push({ candidate, primary: null, triple })
      continue
    }
    if (
      !candidate.inferredStrength ||
      !candidate.mechanicallyClosed ||
      candidate.sourceExcluded ||
      candidate.recommendationScore === null ||
      !Number.isFinite(candidate.recommendationScore) ||
      candidate.recommendationScore < 70
    )
      continue
    candidates.push({ candidate, primary: null, triple })
  }
  // Do not execute expensive feature extraction for the 70-point fallback
  // when the account already has an admissible 80-point/source direction.
  const primaryCache = new Map<string, string | null>()
  const qualify = (minimumScore: number) =>
    candidates.flatMap((entry) => {
      if (entry.candidate.sourceRecommended) return [entry]
      if (entry.candidate.recommendationScore! < minimumScore) return []
      const id = entry.candidate.candidateId
      if (!primaryCache.has(id)) primaryCache.set(id, primaryOutputAgentId(entry.candidate))
      const primary = primaryCache.get(id)
      return primary && entry.candidate.memberIds.includes(primary) ? [{ ...entry, primary }] : []
    })
  const high = qualify(80)
  const defaults = high.length ? high : qualify(70)
  // For multi-team feasibility the already supported A fallback remains usable
  // even when one A+ exists. Adding a strong trio must not make three legal A
  // teams disappear. This does NOT promote those backups into default cards.
  const eligible = options.includePortfolioFallback ? qualify(70) : defaults
  const eligibleIds = new Set(eligible.map(({ candidate }) => candidate.candidateId))
  const defaultIds = new Set<string>()
  const triplesByPrimary = new Map<string, Set<string>>()
  for (const { candidate, primary, triple } of defaults) {
    if (candidate.sourceRecommended) {
      defaultIds.add(candidate.candidateId)
      continue
    }
    const triples = triplesByPrimary.get(primary!) ?? new Set<string>()
    if (!triples.has(triple) && triples.size >= 3) continue
    triples.add(triple)
    triplesByPrimary.set(primary!, triples)
    defaultIds.add(candidate.candidateId)
  }
  return { eligibleIds, defaultIds }
}

/** Existing callers retain the bounded default-list contract. */
export function selectDefaultTeamRecommendationIds(
  ordered: readonly DefaultTeamRecommendationCandidate[],
  primaryOutputAgentId: (candidate: DefaultTeamRecommendationCandidate) => string | null,
) {
  return selectDefaultTeamRecommendationPool(ordered, primaryOutputAgentId).defaultIds
}
