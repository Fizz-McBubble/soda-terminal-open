export type DiscOrderKey = {
  id: string
  setId: string
  slot: number
  mainStat: string
  level: number
}

export type DiscOrderContext = {
  setOrder?: ReadonlyMap<string, number>
  mainStatOrder?: ReadonlyMap<string, number>
}

export type DiscSortMode = 'catalog' | 'level' | 'development'

/**
 * Player-facing default: keep each set together, then slot, main stat and
 * enhancement level. The physical id is the final stable tie breaker.
 */
export function compareDiscCatalogOrder(
  left: DiscOrderKey,
  right: DiscOrderKey,
  context: DiscOrderContext = {},
) {
  return (
    compareKnownOrder(left.setId, right.setId, context.setOrder) ||
    left.slot - right.slot ||
    compareKnownOrder(left.mainStat, right.mainStat, context.mainStatOrder) ||
    right.level - left.level ||
    left.id.localeCompare(right.id)
  )
}

/** Level is an explicit alternative view; catalog order remains its tie-breaker. */
export function compareDiscLevelOrder(
  left: DiscOrderKey,
  right: DiscOrderKey,
  context: DiscOrderContext = {},
) {
  return right.level - left.level || compareDiscCatalogOrder(left, right, context)
}

function compareKnownOrder(
  left: string,
  right: string,
  order: ReadonlyMap<string, number> | undefined,
) {
  const leftRank = order?.get(left)
  const rightRank = order?.get(right)
  if (leftRank !== undefined || rightRank !== undefined)
    return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER)
  return left.localeCompare(right)
}
