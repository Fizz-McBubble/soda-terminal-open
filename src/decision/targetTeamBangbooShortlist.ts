import type {
  BangbooComparableSlice,
  BangbooUtilityPurpose,
} from '../calculation/currentBangbooUtilityProjection'
import { bangbooComparisonKeyIdentity, compareBangbooTeamOptions } from './bangbooTeamFit'

export type ShortlistBangbooOption = {
  bangbooId: string
  activationStatus: 'active' | 'inactive' | 'unknown'
  requiresRaisedStars: boolean
  recipientFit: string
  primaryPurpose: BangbooUtilityPurpose
  comparableSlice?: BangbooComparableSlice
}

/** Sort qualitative priorities once, then replace only equivalent-group slots.
 * No comparator switches between partial numeric and identity ordering. */
export function orderComparableBangbooGroups<T extends ShortlistBangbooOption>(
  options: readonly T[],
  reviewedIds: ReadonlySet<string>,
  hasOrdinaryEnergyRecipient: boolean,
): T[] {
  const energyPenalty = (option: T) =>
    Number(!hasOrdinaryEnergyRecipient && option.primaryPurpose === 'energy')
  const ordered = [...options].sort(
    (left, right) =>
      energyPenalty(left) - energyPenalty(right) ||
      Number(reviewedIds.has(right.bangbooId)) - Number(reviewedIds.has(left.bangbooId)) ||
      compareBangbooTeamOptions(left, right),
  )
  const groups = new Map<string, number[]>()
  for (const [index, option] of ordered.entries()) {
    if (!option.comparableSlice || !Number.isFinite(option.comparableSlice.value)) continue
    const key = JSON.stringify([
      energyPenalty(option),
      reviewedIds.has(option.bangbooId),
      option.activationStatus,
      option.requiresRaisedStars,
      option.recipientFit === 'direct',
      bangbooComparisonKeyIdentity(option.comparableSlice.key),
    ])
    const indices = groups.get(key) ?? []
    indices.push(index)
    groups.set(key, indices)
  }
  for (const indices of groups.values()) {
    const group = indices
      .map((index) => ordered[index]!)
      .sort((left, right) => right.comparableSlice!.value - left.comparableSlice!.value)
    indices.forEach((index, offset) => {
      ordered[index] = group[offset]!
    })
  }
  return ordered
}

/** Retain a reviewed default and prefer distinct useful purposes in at most three slots. */
export function selectTargetTeamBangbooShortlist<T extends ShortlistBangbooOption>(input: {
  reviewed: readonly T[]
  alternatives: readonly T[]
  hasOrdinaryEnergyRecipient: boolean
  limit: number
}): T[] {
  if (input.limit <= 0) return []
  const reviewed = input.reviewed.filter((option) => option.activationStatus === 'active')
  const allActive = [...reviewed, ...input.alternatives].filter(
    (option) => option.activationStatus === 'active',
  )
  const byId = new Map<string, T>()
  for (const option of allActive) {
    if (!byId.has(option.bangbooId)) byId.set(option.bangbooId, option)
  }
  const unique = [...byId.values()]
  const ordered = orderComparableBangbooGroups(
    unique,
    new Set(reviewed.map((option) => option.bangbooId)),
    input.hasOrdinaryEnergyRecipient,
  )
  const defaultOption = reviewed[0] ?? ordered[0]
  if (!defaultOption) return []
  const selected = [defaultOption]
  const covered = new Set([defaultOption.primaryPurpose])
  const remaining = ordered.filter((option) => option.bangbooId !== defaultOption.bangbooId)
  while (selected.length < input.limit && remaining.length) {
    const uncoveredIndex = remaining.findIndex(
      (option) =>
        !covered.has(option.primaryPurpose) &&
        (option.primaryPurpose !== 'energy' || input.hasOrdinaryEnergyRecipient),
    )
    const [next] = remaining.splice(uncoveredIndex < 0 ? 0 : uncoveredIndex, 1)
    selected.push(next!)
    covered.add(next!.primaryPurpose)
  }
  return selected
}
