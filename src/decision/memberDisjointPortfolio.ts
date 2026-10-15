/** Cardinality first, then lexicographic caller order. No additive strength/DPS proxy. */
export type PortfolioCandidate = {
  candidate: { candidateId: string }
  memberIds: readonly string[]
}

export function solveMemberDisjointPortfolio<T extends PortfolioCandidate>(
  ordered: readonly T[],
  teamCount: number,
  searchBudget = 50_000,
) {
  const requested = Number.isSafeInteger(teamCount) && teamCount > 0 ? teamCount : 0
  const budget = Number.isSafeInteger(searchBudget) && searchBudget > 0 ? searchBudget : 0
  // Exact physical membership is the resource constraint. Keep the first ranked
  // variant of an identical trio; a different Bangboo does not add three agents.
  const seenIds = new Map<string, string>()
  const seenTrios = new Set<string>()
  const candidates: T[] = []
  const masks: bigint[] = []
  const memberBits = new Map<string, bigint>()
  for (const item of ordered) {
    const id = item.candidate.candidateId
    if (
      !id ||
      item.memberIds.length !== 3 ||
      new Set(item.memberIds).size !== 3 ||
      item.memberIds.some((member) => typeof member !== 'string' || !member.trim())
    )
      throw new Error('BOX 组合搜索收到无效的三人身份。')
    const key = JSON.stringify([...item.memberIds].sort())
    const prior = seenIds.get(id)
    if (prior !== undefined && prior !== key)
      throw new Error('BOX 组合搜索收到同一候选 ID 的冲突成员。')
    if (prior !== undefined) continue
    seenIds.set(id, key)
    if (seenTrios.has(key)) continue
    seenTrios.add(key)
    let mask = 0n
    for (const member of item.memberIds) {
      if (!memberBits.has(member)) memberBits.set(member, 1n << BigInt(memberBits.size))
      mask |= memberBits.get(member)!
    }
    candidates.push(item)
    masks.push(mask)
  }
  const greedy: number[] = []
  let used = 0n
  for (let i = 0; i < candidates.length && greedy.length < requested; i++) {
    if ((masks[i]! & used) !== 0n) continue
    greedy.push(i)
    used |= masks[i]!
  }
  // A full greedy result is already the lexicographically first requested
  // tuple. Preserve the existing zero-search fast path.
  if (greedy.length === requested)
    return {
      selected: greedy.map((i) => candidates[i]!),
      status: 'complete' as const,
      searchSteps: 0,
    }

  let best = [...greedy]
  let searchSteps = 0
  let exhausted = false
  const suffixUnion: bigint[] = new Array(masks.length + 1).fill(0n)
  for (let i = masks.length - 1; i >= 0; i--) suffixUnion[i] = suffixUnion[i + 1]! | masks[i]!
  const popcount = (value: bigint) => {
    let count = 0
    while (value) {
      value &= value - 1n
      count++
    }
    return count
  }
  const upper = Math.min(requested, candidates.length, Math.floor(memberBits.size / 3))
  const lexEarlier = (left: readonly number[], right: readonly number[]) => {
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return left[i]! < right[i]!
    }
    return false
  }
  const chosen: number[] = []
  const retain = () => {
    if (chosen.length > best.length || (chosen.length === best.length && lexEarlier(chosen, best)))
      best = [...chosen]
  }
  // Descending targets preserve the old objective. Every feasible partial node
  // improves the incumbent immediately, even if a larger target later times out.
  function find(start: number, target: number, occupied: bigint): number[] | null {
    retain()
    if (chosen.length === target) return [...chosen]
    const needed = target - chosen.length
    const possible = Math.min(
      candidates.length - start,
      Math.floor(popcount(suffixUnion[start]! & ~occupied) / 3),
    )
    if (possible < needed) return null
    for (let i = start; i <= candidates.length - needed; i++) {
      if (searchSteps >= budget) {
        exhausted = true
        return null
      }
      searchSteps++
      if ((masks[i]! & occupied) !== 0n) continue
      chosen.push(i)
      const result = find(i + 1, target, occupied | masks[i]!)
      chosen.pop()
      if (result) return result
      if (exhausted) return null
    }
    return null
  }
  // Use the fixed greedy lower bound: a partial improvement found while
  // rejecting a larger target still needs its own lexicographic tie search.
  for (let target = upper; target > greedy.length; target--) {
    const result = find(0, target, 0n)
    if (result) {
      return {
        selected: result.map((i) => candidates[i]!),
        status: target === requested ? ('complete' as const) : ('infeasible' as const),
        searchSteps,
      }
    }
    if (exhausted) break
  }
  return {
    selected: best.map((i) => candidates[i]!),
    status: exhausted ? ('budget_exhausted' as const) : ('infeasible' as const),
    searchSteps,
  }
}
