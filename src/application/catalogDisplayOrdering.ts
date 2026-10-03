export type CatalogSortEntry = {
  rarity: 'S' | 'A' | 'B'
  /** Optional because the current offline directory does not yet ship a verified release ledger. */
  releaseAt?: string | null
  /** Version of the source that verified releaseAt. */
  releaseSourceVersion?: string | null
}

const rarityRank: Record<CatalogSortEntry['rarity'], number> = { S: 0, A: 1, B: 2 }
const isoDate = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/

export function hasTrustedReleaseAt(
  entry: Pick<CatalogSortEntry, 'releaseAt' | 'releaseSourceVersion'>,
) {
  return Boolean(entry.releaseSourceVersion && entry.releaseAt && isoDate.test(entry.releaseAt))
}

/**
 * Shared directory order. Within a rarity, entries with a trusted release date
 * are newest first. Entries without one remain in their original stable order;
 * a date is never guessed from a name, external ID, or array position.
 */
export function sortCatalogByRarityAndRelease<
  T extends {
    rarity: string | null
    releaseAt?: string | null
    releaseSourceVersion?: string | null
  },
>(items: readonly T[]): T[] {
  return items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((left, right) => {
      const rarity =
        (rarityRank[left.item.rarity as CatalogSortEntry['rarity']] ?? 99) -
        (rarityRank[right.item.rarity as CatalogSortEntry['rarity']] ?? 99)
      if (rarity) return rarity
      const leftTrusted = hasTrustedReleaseAt(left.item)
      const rightTrusted = hasTrustedReleaseAt(right.item)
      if (leftTrusted && rightTrusted && left.item.releaseAt !== right.item.releaseAt)
        return right.item.releaseAt!.localeCompare(left.item.releaseAt!)
      if (leftTrusted !== rightTrusted) return leftTrusted ? -1 : 1
      // Missing dates deliberately fall back to stable source order.
      return left.sourceIndex - right.sourceIndex
    })
    .map(({ item }) => item)
}

export const catalogReleaseDataDependency =
  '同稀有度优先按已核验上线日期从新到旧；未核验日期的条目保持稳定目录顺序。'

export function sortTupleCatalog<T extends readonly [string, string, ...unknown[]]>(
  items: readonly T[],
  rarityIndex: number,
): T[] {
  const ordered = sortCatalogByRarityAndRelease(
    items.map((item) => ({ item, rarity: item[rarityIndex] as CatalogSortEntry['rarity'] })),
  )
  return ordered.map((entry) => entry.item)
}
