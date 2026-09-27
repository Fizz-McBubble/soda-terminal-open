import type { OptimizerKnowledge } from './optimizeBuild'

export type AllowedSetCountPattern = Record<string, number>

export function allowedSetCountPatterns(knowledge: Pick<OptimizerKnowledge, 'setPlans'>) {
  const unique = new Map<string, AllowedSetCountPattern>()
  const add = (pattern: AllowedSetCountPattern) => {
    const key = Object.entries(pattern)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([setId, count]) => `${setId}:${count}`)
      .join('|')
    unique.set(key, pattern)
  }
  for (const plan of knowledge.setPlans) {
    if (plan.pattern === '4+2') {
      for (const primary of plan.primarySets) {
        for (const secondary of plan.secondarySets) {
          if (primary !== secondary) add({ [primary]: 4, [secondary]: 2 })
        }
      }
      continue
    }
    const sets = [...new Set(plan.primarySets)]
    for (let first = 0; first < sets.length - 2; first += 1) {
      for (let second = first + 1; second < sets.length - 1; second += 1) {
        for (let third = second + 1; third < sets.length; third += 1) {
          add({ [sets[first]!]: 2, [sets[second]!]: 2, [sets[third]!]: 2 })
        }
      }
    }
  }
  return [...unique.values()]
}

export function canStillCompleteSetPattern(
  counts: Record<string, number>,
  remainingSlots: number,
  patterns: AllowedSetCountPattern[],
) {
  return patterns.some((pattern) => {
    if (
      Object.entries(counts).some(
        ([setId, count]) => pattern[setId] === undefined || count > pattern[setId],
      )
    )
      return false
    const missing = Object.entries(pattern).reduce(
      (total, [setId, target]) => total + target - (counts[setId] ?? 0),
      0,
    )
    return missing === remainingSlots
  })
}
