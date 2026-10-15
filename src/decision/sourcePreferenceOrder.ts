/** A linear display traversal of a partial relation is not a numerical rating.
 * Reorder only the original slots of each connected, visible component. */
export function resolveSourcePreferenceOrder<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  relations: readonly (readonly [string, string])[],
) {
  const ordered = [...items]
  const itemKeys = items.map(keyOf)
  const slotsByKey = new Map<string, number[]>()
  itemKeys.forEach((key, i) => {
    const slots = slotsByKey.get(key) ?? []
    slots.push(i)
    slotsByKey.set(key, slots)
  })
  const active: Array<readonly [string, string]> = []
  const neighbours = new Map<string, Set<string>>()
  const predecessors = new Map<string, Set<string>>()
  for (const [a, b] of relations) {
    if (!slotsByKey.has(a) || !slotsByKey.has(b)) continue
    const before = predecessors.get(b) ?? new Set<string>()
    if (before.has(a)) continue
    before.add(a)
    predecessors.set(b, before)
    active.push([a, b])
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const next = neighbours.get(from) ?? new Set<string>()
      next.add(to)
      neighbours.set(from, next)
    }
  }
  let cyclicComponentCount = 0
  let reorderedComponentCount = 0
  const seen = new Set<string>()
  for (const root of neighbours.keys()) {
    if (seen.has(root)) continue
    const component = new Set<string>()
    const pendingKeys = [root]
    while (pendingKeys.length) {
      const key = pendingKeys.pop()!
      if (seen.has(key)) continue
      seen.add(key)
      component.add(key)
      pendingKeys.push(...(neighbours.get(key) ?? []))
    }
    const slots = [...component].flatMap((key) => slotsByKey.get(key)!).sort((a, b) => a - b)
    const pending = [...slots]
    const localOrder: number[] = []
    const remaining = new Map([...component].map((key) => [key, slotsByKey.get(key)!.length]))
    while (pending.length) {
      const index = pending.findIndex((i) =>
        [...(predecessors.get(itemKeys[i]!) ?? [])].every((key) => (remaining.get(key) ?? 0) === 0),
      )
      if (index < 0) break
      const [i] = pending.splice(index, 1)
      localOrder.push(i!)
      const key = itemKeys[i!]!
      remaining.set(key, remaining.get(key)! - 1)
    }
    if (localOrder.length !== slots.length) {
      // Independent evidence sets can jointly form a cycle. Do not resolve it
      // by source load order or by partially moving this component.
      cyclicComponentCount++
      continue
    }
    if (localOrder.some((slot, i) => slot !== slots[i])) reorderedComponentCount++
    slots.forEach((slot, i) => {
      ordered[slot] = items[localOrder[i]!]!
    })
  }
  return {
    ordered,
    cyclicComponentCount,
    reorderedComponentCount,
    activeRelationCount: active.length,
  }
}
