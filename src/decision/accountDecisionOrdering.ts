import type { AccountBands, AssetConflictBand, RankedFormation } from './accountDecisionBands'
import type {
  TeamRatingBand,
  DecisionConfidenceBand,
  TeamRatingResult,
} from './teamDecisionAuthority'
import {
  current31ProductionPartialOrderVariantKey,
  knownCurrent31ProductionStrongerKeys,
} from './current31ProductionPartialOrder'

export function ratingOrder(band: TeamRatingBand) {
  return ['S+', 'S', 'A+', 'A', 'B', 'Experimental'].indexOf(band)
}

export function confidenceOrder(confidence: DecisionConfidenceBand) {
  return ['high', 'medium', 'low', 'experimental'].indexOf(confidence)
}

export function readinessOrder(readiness: AccountBands['currentReadiness']) {
  return ['ready', 'near_ready', 'development', 'not_evaluated', 'blocked'].indexOf(readiness)
}

export function conflictOrder(conflict: AssetConflictBand) {
  return ['none', 'resolvable', 'not_evaluated', 'blocking'].indexOf(conflict)
}

export function investmentOrder(investment: AccountBands['investmentCost']) {
  return ['low', 'medium', 'high', 'unknown'].indexOf(investment)
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

/**
 * A partial order cannot be safely dense-ranked by comparing adjacent display
 * items. Within each categorical Team Rating band, only the number of known
 * preferred exact Variants creates a finer source-preference order, not another
 * measured strength tier. Context-dependent relations are not consumed. Unrelated peers
 * therefore remain tied even when a display/portfolio sort places one between
 * a known stronger/weaker pair.
 */
export function projectCurrent31TeamStrengthOrder(
  items: readonly {
    candidateId: string
    memberIds: readonly string[]
    bangbooId: string | null
    teamRatingBand: TeamRatingBand
  }[],
) {
  const rankByCandidateId = new Map<string, number>()
  let nextRank = 1
  for (const band of ['S+', 'S', 'A+', 'A', 'B', 'Experimental'] as const) {
    const sameBand = items.filter((item) => item.teamRatingBand === band)
    const formationKeys = new Set<string>()
    for (const item of sameBand) {
      const key = current31ProductionPartialOrderVariantKey(item)
      if (key) formationKeys.add(key)
    }
    const counts = sameBand.map((item) => ({
      candidateId: item.candidateId,
      strongerCount: knownCurrent31ProductionStrongerKeys(item).reduce(
        (total, key) => total + (formationKeys.has(key) ? 1 : 0),
        0,
      ),
    }))
    for (const count of [...new Set(counts.map((item) => item.strongerCount))].sort(
      (a, b) => a - b,
    )) {
      for (const item of counts.filter((item) => item.strongerCount === count))
        rankByCandidateId.set(item.candidateId, nextRank)
      nextRank += 1
    }
  }
  return rankByCandidateId
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

/** Keep the existing order when greedy fills the request; search only its shortfall. */
export function resolveMemberDisjointPortfolio<
  T extends { candidate: RankedFormation; memberIds: readonly string[] },
>(ordered: readonly T[], teamCount: number, searchBudget = 50_000) {
  const requested = Number.isSafeInteger(teamCount) && teamCount > 0 ? teamCount : 0
  const seen = new Set<string>()
  const candidates = ordered.filter((item) => {
    const id = item.candidate.candidateId
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  const selected: T[] = []
  for (const candidate of candidates) {
    if (selected.length >= requested) break
    if (selected.every((existing) => !hasOverlap(existing.memberIds, candidate.memberIds)))
      selected.push(candidate)
  }
  if (selected.length === requested)
    return { selected, status: 'complete' as const, searchSteps: 0 }

  let searchSteps = 0
  let exhausted = false
  const budget = Number.isSafeInteger(searchBudget) && searchBudget > 0 ? searchBudget : 0
  const chosen: T[] = []
  function find(start: number, target: number): T[] | null {
    if (chosen.length === target) return [...chosen]
    const needed = target - chosen.length
    if (candidates.length - start < needed) return null
    for (let index = start; index <= candidates.length - needed; index += 1) {
      if (searchSteps >= budget) {
        exhausted = true
        return null
      }
      searchSteps += 1
      const candidate = candidates[index]!
      if (chosen.some((existing) => hasOverlap(existing.memberIds, candidate.memberIds))) continue
      chosen.push(candidate)
      const result = find(index + 1, target)
      chosen.pop()
      if (result) return result
      if (exhausted) return null
    }
    return null
  }
  // Descending cardinality, then lexicographic input order: no new rating weights
  // or DPS claim. A budget cutoff must never be reported as proven infeasibility.
  for (let target = Math.min(requested, candidates.length); target > selected.length; target -= 1) {
    const result = find(0, target)
    if (result)
      return {
        selected: result,
        status: target === requested ? ('complete' as const) : ('infeasible' as const),
        searchSteps,
      }
    if (exhausted) break
  }
  return {
    selected,
    status: exhausted ? ('budget_exhausted' as const) : ('infeasible' as const),
    searchSteps,
  }
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
