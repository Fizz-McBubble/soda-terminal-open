import type { AccountBands, AssetConflictBand, RankedFormation } from './accountDecisionBands'
import type {
  TeamRatingBand,
  DecisionConfidenceBand,
  TeamRatingResult,
  CultivationPriorityResult,
} from './teamDecisionAuthority'
import { solveMemberDisjointPortfolio } from './memberDisjointPortfolio'
import { reviewedTeamPreferences } from './reviewedTeamPreferences'
import { resolveSourcePreferenceOrder } from './sourcePreferenceOrder'
import {
  current31ProductionPartialOrderVariantKey,
  knownCurrent31ProductionStrongerKeys,
} from './current31ProductionPartialOrder'

/** An unrecognized runtime enum must not acquire the best (-1) priority. */
const enumOrder = (values: readonly string[], value: string) => {
  const position = values.indexOf(value)
  return position < 0 ? values.length : position
}

export function ratingOrder(band: TeamRatingBand) {
  return enumOrder(['S+', 'S', 'A+', 'A', 'B', 'Experimental'], band)
}

export function confidenceOrder(confidence: DecisionConfidenceBand) {
  return enumOrder(['high', 'medium', 'low', 'experimental'], confidence)
}

export function readinessOrder(readiness: AccountBands['currentReadiness']) {
  return enumOrder(['ready', 'near_ready', 'development', 'not_evaluated', 'blocked'], readiness)
}

export function conflictOrder(conflict: AssetConflictBand) {
  return enumOrder(['none', 'resolvable', 'not_evaluated', 'blocking'], conflict)
}

export function investmentOrder(investment: AccountBands['investmentCost']) {
  return enumOrder(['low', 'medium', 'high', 'unknown'], investment)
}

/** Current investment is independent of the team's intrinsic grade. Even when
 * inventory matching is unassessed, known skill/level gaps remain comparable. */
export function compareAccountCultivationState(
  left: { priorityTier: CultivationPriorityResult['tier']; account: AccountBands },
  right: { priorityTier: CultivationPriorityResult['tier']; account: AccountBands },
) {
  const tiers = ['ready_now', 'short_upgrade', 'strategic_build', 'experimental']
  return (
    enumOrder(tiers, left.priorityTier) - enumOrder(tiers, right.priorityTier) ||
    readinessOrder(left.account.currentReadiness) -
      readinessOrder(right.account.currentReadiness) ||
    investmentOrder(left.account.investmentCost) - investmentOrder(right.account.investmentCost) ||
    conflictOrder(left.account.assetConflict) - conflictOrder(right.account.assetConflict) ||
    left.account.buildCompletionDistance.missingPotentialInvestments -
      right.account.buildCompletionDistance.missingPotentialInvestments ||
    left.account.buildCompletionDistance.missingSkillInvestments -
      right.account.buildCompletionDistance.missingSkillInvestments
  )
}

export function baseComparator(
  left: { rating: TeamRatingResult; account: AccountBands; candidate: RankedFormation },
  right: { rating: TeamRatingResult; account: AccountBands; candidate: RankedFormation },
) {
  if (left.rating.status !== 'rated') return right.rating.status === 'rated' ? 1 : 0
  if (right.rating.status !== 'rated') return -1
  return (
    ratingOrder(left.rating.ratingBand) - ratingOrder(right.rating.ratingBand) ||
    confidenceOrder(left.rating.confidence) - confidenceOrder(right.rating.confidence) ||
    readinessOrder(left.account.currentReadiness) -
      readinessOrder(right.account.currentReadiness) ||
    conflictOrder(left.account.assetConflict) - conflictOrder(right.account.assetConflict)
  )
}

/** Coarse strength ranks only. Guide substitution is a local tie breaker,
 * not an extra global tier obtained by counting a team's known predecessors. */
export function projectCurrent31TeamStrengthOrder(
  items: readonly {
    candidateId: string
    memberIds: readonly string[]
    bangbooId: string | null
    teamRatingBand: TeamRatingBand
  }[],
) {
  const rankByCandidateId = new Map<string, number>()
  let rank = 0
  for (const band of ['S+', 'S', 'A+', 'A', 'B', 'Experimental'] as const) {
    const peers = items.filter((item) => item.teamRatingBand === band)
    if (!peers.length) continue
    rank++
    for (const item of peers) rankByCandidateId.set(item.candidateId, rank)
  }
  return rankByCandidateId
}

/** Stable source ordering applies only inside caller-declared comparable
 * buckets. Items in other buckets retain their original slots. */
export function resolveComparableTeamCandidates<T>(
  items: readonly T[],
  bucket: (item: T) => string,
  members: (item: T) => readonly string[],
) {
  const output = [...items]
  const diagnostics = {
    cyclicComponentCount: 0,
    reorderedComponentCount: 0,
    activeRelationCount: 0,
  }
  const positions = new Map<string, number[]>()
  items.forEach((item, i) => {
    const key = bucket(item)
    const indices = positions.get(key) ?? []
    indices.push(i)
    positions.set(key, indices)
  })
  for (const indices of positions.values()) {
    if (indices.length < 2) continue
    const group = indices.map((i) => items[i]!)
    const keyOf = (item: T) =>
      current31ProductionPartialOrderVariantKey({ memberIds: members(item), bangbooId: null }) ?? ''
    const relations: Array<readonly [string, string]> = reviewedTeamPreferences.acceptedFacts.map(
      (fact) => [
        [...fact.preferredMemberIds].sort().join('|'),
        [...fact.alternativeMemberIds].sort().join('|'),
      ],
    )
    // Retain the already-adjudicated Gold relations without turning their
    // predecessor counts into global scores. Both source families are checked
    // together so a cross-source cycle cannot be resolved by execution order.
    for (const item of group) {
      const key = keyOf(item)
      if (!key) continue
      for (const stronger of knownCurrent31ProductionStrongerKeys({
        memberIds: members(item),
        bangbooId: null,
      }))
        relations.push([stronger, key])
    }
    const resolved = resolveSourcePreferenceOrder(group, keyOf, relations)
    diagnostics.cyclicComponentCount += resolved.cyclicComponentCount
    diagnostics.reorderedComponentCount += resolved.reorderedComponentCount
    diagnostics.activeRelationCount += resolved.activeRelationCount
    indices.forEach((i, offset) => {
      output[i] = resolved.ordered[offset]!
    })
  }
  return { ordered: output, diagnostics }
}

export function orderComparableTeamCandidates<T>(
  items: readonly T[],
  bucket: (item: T) => string,
  members: (item: T) => readonly string[],
) {
  return resolveComparableTeamCandidates(items, bucket, members).ordered
}

export function denseOrder<T>(items: readonly T[], compare: (left: T, right: T) => number) {
  let rank = 0
  return items.map((item, index) => {
    if (index === 0 || compare(items[index - 1]!, item) !== 0) rank += 1
    return { item, rank }
  })
}

export function hasOverlap(left: readonly string[], right: readonly string[]) {
  const members = new Set(left)
  return right.some((member) => members.has(member))
}

/** Preserve the public result contract and the caller's distinct objective. */
export function resolveMemberDisjointPortfolio<
  T extends { candidate: RankedFormation; memberIds: readonly string[] },
>(ordered: readonly T[], teamCount: number, searchBudget = 50_000) {
  return solveMemberDisjointPortfolio(ordered, teamCount, searchBudget)
}

export function selectMemberDisjointPortfolio<
  T extends { candidate: RankedFormation; memberIds: readonly string[] },
>(ordered: readonly T[], teamCount: number) {
  return resolveMemberDisjointPortfolio(ordered, teamCount).selected
}

export function exactMemberIds(candidate: RankedFormation): readonly [string, string, string] {
  if (candidate.memberIds.length !== 3 || new Set(candidate.memberIds).size !== 3)
    throw new Error(`账户候选不是合法三人编队：${candidate.candidateId}。`)
  return [candidate.memberIds[0]!, candidate.memberIds[1]!, candidate.memberIds[2]!]
}
