import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { graduatedTeamRatingBandOrder } from '../decision/graduatedTeamRatingBands'
import {
  compareTeamSystemRankingAuthority,
  hasTeamSystemRankingAuthority,
} from './teamSystemRankingPresentation'

export type RankedTeam = Pick<
  TeamLoadoutOverviewItem,
  'id' | 'teamRatingBand' | 'recommendationRank' | 'teamSystemRanking'
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

const bandOrder = { 'S+': 7, S: 6, 'A+': 5, A: 4, 'B+': 3, B: 2, C: 1, Experimental: 0 }
const displayBandOrder = graduatedTeamRatingBandOrder
const genericStatusOrder = { recommended: 1, exploration: 2, unsupported: 3 } as const
export const recommendationStrengthBucket = (item: RankedTeam) => {
  const ranking = item.teamSystemRanking
  const generic = ranking?.genericOrder
  if (generic)
    return generic.status === 'recommended' && generic.band
      ? `generic-band:${generic.referenceInterval?.lower ?? generic.band}:${generic.referenceInterval?.upper ?? generic.band}`
      : `generic-status:${generic.status}:${generic.band ?? 'unrated'}`
  if (ranking?.status === 'ranked')
    return `system-rank:${ranking.contentHash}:${ranking.system}:${ranking.systemRank}`
  if (ranking?.status === 'unsupported')
    return `system-unsupported:${ranking.contentHash}:${ranking.reason}`
  return `legacy:${item.teamRatingBand ?? 'unrated'}:${recommendationEvidencePriority(item)}`
}

/**
 * Player-list organization only. The declared interval's upper endpoint is the
 * first display key and its lower endpoint is the stable secondary key.
 */
export function compareGenericRecommendationDisplay(left: RankedTeam, right: RankedTeam) {
  const key = (item: RankedTeam): readonly [number, number, number] => {
    const generic = item.teamSystemRanking?.genericOrder
    if (!generic) throw new Error('Generic display comparison received an unranked team.')
    if (generic.status === 'recommended' && generic.band) {
      const upper = generic.referenceInterval?.upper ?? generic.band
      const lower = generic.referenceInterval?.lower ?? generic.band
      return [0, displayBandOrder[upper], displayBandOrder[lower]]
    }
    return [genericStatusOrder[generic.status], 0, 0]
  }
  const a = key(left)
  const b = key(right)
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/**
 * Pairwise relation only. Generic intervals can overlap, so this comparator is
 * not transitive and must not be passed to Array.sort. Use the partial-order
 * entrypoint in teamRecommendationOrdering for arrays.
 */
export function compareTeamRecommendations(left: RankedTeam, right: RankedTeam) {
  if (
    hasTeamSystemRankingAuthority(left.teamSystemRanking) ||
    hasTeamSystemRankingAuthority(right.teamSystemRanking)
  )
    return compareTeamSystemRankingAuthority(left.teamSystemRanking, right.teamSystemRanking)
  return (
    (right.teamRatingBand ? bandOrder[right.teamRatingBand] : -1) -
      (left.teamRatingBand ? bandOrder[left.teamRatingBand] : -1) ||
    recommendationEvidencePriority(left) - recommendationEvidencePriority(right) ||
    right.recommendationRank - left.recommendationRank ||
    left.id.localeCompare(right.id)
  )
}
