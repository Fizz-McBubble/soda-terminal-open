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
  if (item.fallbackOnly) return 1
  return item.sourceConfirmed ? 0 : 2
}

const bandOrder = { 'S+': 5, S: 4, 'A+': 3, A: 2, B: 1, Experimental: 0 }
const score = (item: RankedTeam) =>
  typeof item.recommendationScore === 'number' && Number.isFinite(item.recommendationScore)
    ? item.recommendationScore
    : -1

export const recommendationStrengthBucket = (item: RankedTeam) =>
  `${recommendationEvidencePriority(item)}:${item.teamRatingBand ?? 'unrated'}:${score(item)}`

/** Source-backed directions first; compare strength only within the same evidence class. */
export function compareTeamRecommendations(left: RankedTeam, right: RankedTeam) {
  return (
    recommendationEvidencePriority(left) - recommendationEvidencePriority(right) ||
    (right.teamRatingBand ? bandOrder[right.teamRatingBand] : -1) -
      (left.teamRatingBand ? bandOrder[left.teamRatingBand] : -1) ||
    score(right) - score(left) ||
    right.recommendationRank - left.recommendationRank ||
    left.id.localeCompare(right.id)
  )
}
