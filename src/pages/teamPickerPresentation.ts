/** Presentation-only order for the owned agent picker. */
type CatalogSortEntry = {
  rarity: 'S' | 'A' | 'B'
  releaseAt?: string | null
  releaseSourceVersion?: string | null
}

const rarityRank: Record<CatalogSortEntry['rarity'], number> = { S: 0, A: 1, B: 2 }
const isoDate = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/

function hasTrustedReleaseAt(entry: Pick<CatalogSortEntry, 'releaseAt' | 'releaseSourceVersion'>) {
  return Boolean(entry.releaseSourceVersion && entry.releaseAt && isoDate.test(entry.releaseAt))
}

export function sortOwnedAgentsForPicker<
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
      return left.sourceIndex - right.sourceIndex
    })
    .map(({ item }) => item)
}

export const pickerReleaseDataDependency =
  '同稀有度优先按已核验上线日期从新到旧；未核验日期的条目保持稳定目录顺序。'
