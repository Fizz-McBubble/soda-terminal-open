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
  sourceExcluded: boolean
}

/** The caller supplies existing intrinsic order. This bounds only default model
 * supplements, never the legal universe or deliberate consumer discovery. */
export function selectDefaultTeamRecommendationIds(
  ordered: readonly DefaultTeamRecommendationCandidate[],
  primaryOutputAgentId: (candidate: DefaultTeamRecommendationCandidate) => string | null,
) {
  const selected = new Set<string>()
  const triplesByPrimary = new Map<string, Set<string>>()
  for (const candidate of ordered) {
    if (candidate.explicitSelectionOnly || candidate.ratingStatus !== 'rated') continue
    if (candidate.sourceRecommended) {
      selected.add(candidate.candidateId)
      continue
    }
    if (
      !candidate.inferredStrength ||
      candidate.ratingBand === 'Experimental' ||
      candidate.confidence === 'experimental' ||
      !candidate.mechanicallyClosed ||
      candidate.sourceExcluded ||
      candidate.recommendationScore === null ||
      !Number.isFinite(candidate.recommendationScore) ||
      candidate.recommendationScore < 80
    )
      continue
    const primary = primaryOutputAgentId(candidate)
    if (!primary || !candidate.memberIds.includes(primary)) continue
    const triple = [...new Set(candidate.memberIds)].sort().join('|')
    if (new Set(candidate.memberIds).size !== 3) continue
    const triples = triplesByPrimary.get(primary) ?? new Set<string>()
    if (!triples.has(triple) && triples.size >= 3) continue
    triples.add(triple)
    triplesByPrimary.set(primary, triples)
    selected.add(candidate.candidateId)
  }
  return selected
}
