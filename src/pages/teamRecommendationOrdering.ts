import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { orderComparableTeamCandidates } from '../decision/accountDecisionOrdering'
import {
  compareGenericRecommendationDisplay,
  compareTeamRecommendations,
  recommendationStrengthBucket,
} from './teamRecommendationRank'
import { hasTeamSystemRankingAuthority } from './teamSystemRankingPresentation'
import { visibleGraduatedScore } from './teamRatingPresentation'

export {
  compareTeamRecommendations,
  recommendationEvidencePriority,
} from './teamRecommendationRank'

/**
 * Organize the player list by upper endpoint, then lower endpoint. Equal
 * intervals retain input order here so the reviewed preference pass below can
 * apply exact-team relations.
 */
function orderGenericTeamRecommendations<T extends TeamLoadoutOverviewItem>(
  items: readonly T[],
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        compareGenericRecommendationDisplay(left.item, right.item) || left.index - right.index,
    )
    .map(({ item }) => item)
}

function compareNonGenericTeamRecommendations<T extends TeamLoadoutOverviewItem>(
  left: T,
  right: T,
) {
  if (left.teamSystemRanking?.genericOrder || right.teamSystemRanking?.genericOrder)
    throw new Error('Non-generic ordering received a generic team.')
  return compareTeamRecommendations(left, right)
}

/** Array ordering entrypoint for authority-backed teams. */
export function orderRankedTeamItems<T extends TeamLoadoutOverviewItem>(items: readonly T[]): T[] {
  const generic = items.filter((item) => item.teamSystemRanking?.genericOrder)
  const other = items
    .filter((item) => !item.teamSystemRanking?.genericOrder)
    .sort(compareNonGenericTeamRecommendations)
  const ordered = [...orderGenericTeamRecommendations(generic), ...other]
  const hasSystemAuthority = ordered.some((item) =>
    hasTeamSystemRankingAuthority(item.teamSystemRanking),
  )
  // A non-generic system ordinal already owns its local order. Current generic
  // order has a cross-system tier, so reviewed same-tier preferences still apply.
  const baseline =
    !hasSystemAuthority || generic.length
      ? orderComparableTeamCandidates(
          ordered,
          recommendationStrengthBucket,
          (item) => item.agentIds,
        )
      : ordered
  // Only reorder positions occupied by comparable results. Measuring a B
  // must not put it in front of an unmeasured S. Ties retain display order.
  const positions = new Map<string, number[]>()
  baseline.forEach((item, index) => {
    const score = visibleGraduatedScore(item)
    if (!score || score.unconfirmedBuildAgentIds) return
    const slots = positions.get(score.standardIdentity) ?? []
    slots.push(index)
    positions.set(score.standardIdentity, slots)
  })
  if (!positions.size) return baseline
  const result = [...baseline]
  for (const slots of positions.values()) {
    const measured = slots
      .map((i) => baseline[i]!)
      .sort(
        (a, b) =>
          a.teamSystemRanking!.graduatedScore!.orderGroup -
          b.teamSystemRanking!.graduatedScore!.orderGroup,
      )
    slots.forEach((pos, i) => {
      result[pos] = measured[i]!
    })
  }
  return result
}

/** Linearize only the variants that remain visible after the current filters. */
export function orderTeamRecommendations(items: readonly TeamLoadoutOverviewItem[]) {
  return orderRankedTeamItems(items)
}

export function orderRecommendationFamilies(families: readonly TeamLoadoutOverviewFamily[]) {
  const ranked = families.map((family) => ({
    family,
    strongest: orderTeamRecommendations(family.variants)[0]!,
  }))
  const familyByStrongest = new Map(ranked.map((entry) => [entry.strongest, entry.family]))
  return orderRankedTeamItems(ranked.map((entry) => entry.strongest)).map(
    (strongest) => familyByStrongest.get(strongest)!,
  )
}
