import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { orderComparableTeamCandidates } from '../decision/accountDecisionOrdering'
import { compareTeamRecommendations, recommendationStrengthBucket } from './teamRecommendationRank'

export {
  compareTeamRecommendations,
  recommendationEvidencePriority,
} from './teamRecommendationRank'

/** Score only the variants that remain visible after the current filters. */
export function orderTeamRecommendations(items: readonly TeamLoadoutOverviewItem[]) {
  return orderComparableTeamCandidates(
    [...items].sort(compareTeamRecommendations),
    recommendationStrengthBucket,
    (item) => item.agentIds,
  )
}

export function orderRecommendationFamilies(families: readonly TeamLoadoutOverviewFamily[]) {
  const ranked = families
    .map((family) => ({
      family,
      strongest: orderTeamRecommendations(family.variants)[0]!,
    }))
    .sort((left, right) => compareTeamRecommendations(left.strongest, right.strongest))
  // Source relations precede the numeric index inside the same band and
  // evidence class. Unrelated families retain their base-order slots.
  const ordered = orderComparableTeamCandidates(
    ranked,
    (entry) => recommendationStrengthBucket(entry.strongest),
    (entry) => entry.strongest.agentIds,
  )
  return ordered.map(({ family }) => family)
}
