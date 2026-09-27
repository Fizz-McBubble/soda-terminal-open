import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { orderVisibleFamilies, rebuildVisibleFamily } from './teamVisibleFamilyPresentation'

export function hasRatedTeamStrength(item: TeamLoadoutOverviewItem) {
  return (
    item.teamRatingBand !== null &&
    item.teamRatingBand !== 'Experimental' &&
    item.confidence !== null &&
    item.confidence !== 'experimental'
  )
}

export function isHistoricalReferenceDirection(item: TeamLoadoutOverviewItem) {
  return (
    item.sourceConfirmed &&
    item.historicalReferenceOnly &&
    (!hasRatedTeamStrength(item) || item.inferredStrength)
  )
}

/** Scope exact trios before rebuilding a family: a rated sibling must not make
 * every historical or unreviewed alternative visible by default. */
export function visibleRecommendationFamilies(
  families: readonly TeamLoadoutOverviewFamily[],
  includeHistorical: boolean,
  includeExploratory = false,
) {
  const visible = families.flatMap((family) => {
    const variants = family.variants.filter(
      (item) =>
        item.mechanicValidity !== 'invalid' &&
        (!item.fallbackOnly ||
          (hasRatedTeamStrength(item) && !item.inferredStrength) ||
          includeHistorical ||
          includeExploratory) &&
        ((hasRatedTeamStrength(item) &&
          (!item.inferredStrength || item.sourceConfirmed || includeExploratory)) ||
          (item.sourceConfirmed &&
            (!item.historicalReferenceOnly || includeHistorical || includeExploratory))),
    )
    if (!variants.length) return []
    return variants.length === family.variants.length
      ? [family]
      : [rebuildVisibleFamily(family, variants)]
  })
  return orderVisibleFamilies(visible)
}
