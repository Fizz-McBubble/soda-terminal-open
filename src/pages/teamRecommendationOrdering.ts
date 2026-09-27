import type { TeamLoadoutOverviewFamily } from './teamLoadoutOverviewTypes'
import { reviewedTeamPreferences } from '../decision/reviewedTeamPreferences'
import { compareTeamRecommendations, recommendationStrengthBucket } from './teamRecommendationRank'

export {
  compareTeamRecommendations,
  recommendationEvidencePriority,
} from './teamRecommendationRank'

/** Score only the variants that remain visible after the current filters. */
export function orderRecommendationFamilies(families: readonly TeamLoadoutOverviewFamily[]) {
  const ranked = families
    .map((family) => ({
      family,
      strongest: family.variants.reduce(
        (best, item) => (compareTeamRecommendations(item, best) < 0 ? item : best),
        family.variants[0]!,
      ),
    }))
    .sort((left, right) => compareTeamRecommendations(left.strongest, right.strongest))
  const ordered: typeof ranked = []
  for (let start = 0; start < ranked.length; ) {
    const bucket = recommendationStrengthBucket(ranked[start]!.strongest)
    let end = start + 1
    while (end < ranked.length && recommendationStrengthBucket(ranked[end]!.strongest) === bucket)
      end += 1
    // A reviewed substitution preference resolves only an otherwise equal
    // strength tier. Explicit bands and numeric scores remain authoritative.
    ordered.push(
      ...reviewedTeamPreferences.order(
        ranked.slice(start, end),
        (entry) => entry.strongest.agentIds,
      ),
    )
    start = end
  }
  return ordered.map(({ family }) => family)
}
