import type { CurrentTeamSystemRanking } from './teamSystemRanking'
import { graduatedTeamRatingBandOrder } from './graduatedTeamRatingBands'
import type { GraduatedTeamScore } from './graduatedTeamScoreIndex'

const teamSystemDisplayOrder = [
  'direct_damage',
  'attribute_anomaly',
  'rupture',
  'aftershock',
  'sharp',
] as const

const genericStatusOrder = {
  recommended: 0,
  exploration: 1,
  unsupported: 2,
} as const

const genericBandOrder = graduatedTeamRatingBandOrder

function systemOrder(system: string) {
  const index = teamSystemDisplayOrder.indexOf(system as (typeof teamSystemDisplayOrder)[number])
  return index < 0 ? teamSystemDisplayOrder.length : index
}

function genericInterval(ranking: NonNullable<CurrentTeamSystemRanking['genericOrder']>) {
  if (ranking.status !== 'recommended' || !ranking.band) return null
  const lower = ranking.referenceInterval?.lower ?? ranking.band
  const upper = ranking.referenceInterval?.upper ?? ranking.band
  return {
    best: genericBandOrder[upper],
    worst: genericBandOrder[lower],
  }
}

export function hasTeamSystemRankingAuthority(
  ranking: CurrentTeamSystemRanking | null | undefined,
) {
  return ranking?.status === 'ranked' || ranking?.status === 'unsupported'
}

/**
 * A ranked team precedes unsupported rows. Ranked rows compare only inside
 * their output system without a generic order. Generic reference intervals are
 * cross-system comparable; overlapping intervals remain semantically tied.
 */
export function compareTeamSystemRankingAuthority(
  left: (CurrentTeamSystemRanking & { graduatedScore?: GraduatedTeamScore }) | null | undefined,
  right: (CurrentTeamSystemRanking & { graduatedScore?: GraduatedTeamScore }) | null | undefined,
) {
  const leftScore = left?.graduatedScore, rightScore = right?.graduatedScore
  if (leftScore && rightScore && !leftScore.unconfirmedBuildAgentIds && !rightScore.unconfirmedBuildAgentIds &&
      leftScore.standardIdentity === rightScore.standardIdentity)
    return leftScore.orderGroup - rightScore.orderGroup
  if (left?.genericOrder || right?.genericOrder) {
    const a = left?.genericOrder
    const b = right?.genericOrder
    if (!a) return 1
    if (!b) return -1
    const statusDifference = genericStatusOrder[a.status] - genericStatusOrder[b.status]
    if (statusDifference) return statusDifference
    const aInterval = genericInterval(a)
    const bInterval = genericInterval(b)
    if (aInterval && bInterval) {
      if (aInterval.worst < bInterval.best) return -1
      if (bInterval.worst < aInterval.best) return 1
      return 0
    }
    if (aInterval) return -1
    if (bInterval) return 1
    // Explicit unrated directions remain ordered by their incoming display
    // order. The BOX consumer applies source preferences within this tier.
    return 0
  }
  const leftRanked = left?.status === 'ranked'
  const rightRanked = right?.status === 'ranked'
  if (leftRanked && rightRanked) {
    const systemDifference = systemOrder(left.system) - systemOrder(right.system)
    return systemDifference || left.systemRank - right.systemRank
  }
  if (leftRanked) return -1
  if (rightRanked) return 1
  const leftExplicit = hasTeamSystemRankingAuthority(left)
  const rightExplicit = hasTeamSystemRankingAuthority(right)
  return Number(rightExplicit) - Number(leftExplicit)
}
