export type DiscOrderKey = {
  id: string
  setId: string
  slot: number
  mainStat: string
  level: number
  importBatchId?: string
  importSource?: { adapter: string; sourceId?: string; capturedAt?: string }
}

export type DiscOrderContext = {
  setOrder?: ReadonlyMap<string, number>
  mainStatOrder?: ReadonlyMap<string, number>
}

export type DiscSortMode = 'game' | 'catalog' | 'level' | 'development'

function scanPosition(disc: DiscOrderKey) {
  if (disc.importSource?.adapter !== 'soda-terminal-scan-staging' || !disc.importBatchId)
    return null
  // The native R4 identity carries the captured sequence after the image hash.
  // Arbitrary external IDs must not be interpreted as a position in the game.
  const match = /^sha256:[a-f0-9]{64}:(\d+)$/i.exec(disc.importSource.sourceId ?? '')
  const sequence = match ? Number(match[1]) : 0
  if (!Number.isSafeInteger(sequence) || sequence <= 0) return null
  const capturedAt = Date.parse(disc.importSource.capturedAt ?? '')
  return {
    batch: disc.importBatchId,
    capturedAt: Number.isFinite(capturedAt) ? capturedAt : 0,
    sequence,
  }
}

/** Restore the game's order at capture time without changing stored account data. */
export function compareDiscGameOrder(
  left: DiscOrderKey,
  right: DiscOrderKey,
  context: DiscOrderContext = {},
) {
  const leftPosition = scanPosition(left)
  const rightPosition = scanPosition(right)
  if (leftPosition && rightPosition) {
    // Different scans cannot establish a common in-game order. Keep each batch
    // together, newest first, using one total order (never pairwise fallbacks).
    return (
      rightPosition.capturedAt - leftPosition.capturedAt ||
      leftPosition.batch.localeCompare(rightPosition.batch) ||
      leftPosition.sequence - rightPosition.sequence ||
      compareDiscLevelOrder(left, right, context)
    )
  }
  if (leftPosition || rightPosition) return leftPosition ? -1 : 1
  return compareDiscLevelOrder(left, right, context)
}

/**
 * Explicit catalog view: keep each set together, then slot, main stat and
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
