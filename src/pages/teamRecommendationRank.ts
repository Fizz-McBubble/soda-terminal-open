import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'

export type RankedTeam = Pick<
  TeamLoadoutOverviewItem,
  'id' | 'teamRatingBand' | 'recommendationScore' | 'recommendationRank'
> &
  Partial<Pick<TeamLoadoutOverviewItem, 'inferredStrength' | 'sourceConfirmed' | 'fallbackOnly'>>

export function recommendationEvidencePriority(item: RankedTeam) {
  const independentRating =
    !item.inferredStrength && item.teamRatingBand && item.teamRatingBand !== 'Experimental'
  if (independentRating) return 0
  if (item.fallbackOnly) return 2
  // A reviewed build direction is not independent evidence for its inferred
  // strength. Within a band preserve it ahead of model-only supplements without
  // promoting the model score into the independently reviewed rating class.
  return item.sourceConfirmed ? 1 : 3
}

const bandOrder = { 'S+': 5, S: 4, 'A+': 3, A: 2, B: 1, Experimental: 0 }
const score = (item: RankedTeam) =>
  typeof item.recommendationScore === 'number' && Number.isFinite(item.recommendationScore)
    ? item.recommendationScore
    : -1

export const recommendationStrengthBucket = (item: RankedTeam) =>
  `${item.teamRatingBand ?? 'unrated'}:${recommendationEvidencePriority(item)}`

/** Strength bands first; source evidence refines peers without upgrading their rating. */
export function compareTeamRecommendations(left: RankedTeam, right: RankedTeam) {
  return (
    (right.teamRatingBand ? bandOrder[right.teamRatingBand] : -1) -
      (left.teamRatingBand ? bandOrder[left.teamRatingBand] : -1) ||
    recommendationEvidencePriority(left) - recommendationEvidencePriority(right) ||
    score(right) - score(left) ||
    right.recommendationRank - left.recommendationRank ||
    left.id.localeCompare(right.id)
  )
}
