import {
  projectBangbooUtility,
  type BangbooComparableSlice,
} from '../calculation/currentBangbooUtilityProjection'

/** Sourced Bangboo utility projection and qualitative recipient fit. */
export function describeBangbooTeamFit(input: {
  memberIds: readonly string[]
  bangbooId: string
  stars: number
  activationStatus: 'active' | 'inactive' | 'unknown'
}) {
  const projection = projectBangbooUtility(input)
  return {
    recipientFit: projection.recipientFit,
    recommendationReason: projection.recommendationReason,
  }
}

export function areComparisonKeysEquivalent(
  left: BangbooComparableSlice['key'],
  right: BangbooComparableSlice['key'],
): boolean {
  return bangbooComparisonKeyIdentity(left) === bangbooComparisonKeyIdentity(right)
}

/**
 * Strict transitive comparison:
 * 1. Activation status (active > inactive > unknown)
 * 2. Investment requirements (no raised stars > requires raised stars)
 * 3. Fit quality (direct > general/base_only)
 * Incomparable options maintain reviewed/source order without fake cross-stat weights.
 */
export function compareBangbooTeamOptions(
  left: {
    activationStatus: 'active' | 'inactive' | 'unknown'
    requiresRaisedStars: boolean
    recipientFit: string
  },
  right: {
    activationStatus: 'active' | 'inactive' | 'unknown'
    requiresRaisedStars: boolean
    recipientFit: string
  },
) {
  const activationOrder = { active: 0, inactive: 1, unknown: 2 }
  return (
    activationOrder[left.activationStatus] - activationOrder[right.activationStatus] ||
    Number(left.requiresRaisedStars) - Number(right.requiresRaisedStars) ||
    Number(right.recipientFit === 'direct') - Number(left.recipientFit === 'direct')
  )
}

/** Include every key field, including future source-backed comparison conditions. */
export function bangbooComparisonKeyIdentity(key: BangbooComparableSlice['key']): string {
  return JSON.stringify(
    Object.entries(key)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, value]) => [field, typeof value, value]),
  )
}
