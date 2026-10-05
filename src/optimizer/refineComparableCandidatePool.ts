/** Unknown and source-distinct slots stay where they were. Unsupported is not zero. */
export function refineComparableCandidatePool<T>(
  originals: readonly T[],
  proposals: readonly T[],
  policy: {
    key: (item: T) => string
    group: (item: T) => string
    comparable: (left: T, right: T) => boolean
    compare: (left: T, right: T) => number
  },
): T[] {
  const result = [...originals]
  const groups: Array<{ indices: number[]; rows: T[] }> = []
  originals.forEach((row, index) => {
    if (!policy.comparable(row, row)) return
    let group = groups.find((entry) =>
      entry.rows.every(
        (other) => policy.group(row) === policy.group(other) && policy.comparable(row, other),
      ),
    )
    if (!group) {
      group = { indices: [], rows: [] }
      groups.push(group)
    }
    group.indices.push(index)
    group.rows.push(row)
  })
  const originalKeys = new Set(originals.map(policy.key))
  for (const proposal of proposals) {
    if (originalKeys.has(policy.key(proposal))) continue
    const group = groups.find((entry) =>
      entry.rows.every(
        (other) =>
          policy.group(proposal) === policy.group(other) && policy.comparable(proposal, other),
      ),
    )
    if (group && !group.rows.some((row) => policy.key(row) === policy.key(proposal)))
      group.rows.push(proposal)
  }
  for (const group of groups) {
    const oldOrder = new Map(group.rows.map((row, index) => [policy.key(row), index]))
    const ranked = [...group.rows].sort(
      (left, right) =>
        policy.compare(left, right) ||
        oldOrder.get(policy.key(left))! - oldOrder.get(policy.key(right))!,
    )
    group.indices.forEach((index, offset) => {
      result[index] = ranked[offset]!
    })
  }
  return result
}

/** Source dominance is not an overall-damage qualification. Reorder only within
 * the same compatible source group, leaving unknown and incomparable slots alone. */
export function refineSourceDominancePool<T>(
  originals: readonly T[],
  proposals: readonly T[],
  policy: {
    key: (item: T) => string
    group: (item: T) => string
    canReplace: (current: T, proposal: T) => boolean
    mark: (proposal: T) => T
  },
): T[] {
  const result = [...originals]
  const used = new Set(result.map(policy.key))
  for (let index = 0; index < result.length; index++) {
    // An existing alternative must be eligible too. Swap instead of duplicating
    // it or dropping the displaced candidate from the user's alternatives.
    for (let later = index + 1; later < result.length; later++) {
      const current = result[index]!
      const proposal = result[later]!
      if (policy.group(current) !== policy.group(proposal) || !policy.canReplace(current, proposal))
        continue
      result[index] = policy.mark(proposal)
      result[later] = current
    }
    for (const proposal of proposals) {
      const current = result[index]!
      const id = policy.key(proposal)
      if (
        used.has(id) ||
        policy.group(current) !== policy.group(proposal) ||
        !policy.canReplace(current, proposal)
      )
        continue
      used.delete(policy.key(current))
      used.add(id)
      result[index] = policy.mark(proposal)
    }
  }
  return result
}
