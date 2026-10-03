import { sortCatalogByRarityAndRelease } from '../application/catalogDisplayOrdering'

export function sortOwnedAgentsForPicker<
  T extends {
    rarity: string | null
    releaseAt?: string | null
    releaseSourceVersion?: string | null
  },
>(items: readonly T[]): T[] {
  return sortCatalogByRarityAndRelease(items)
}

export const pickerReleaseDataDependency =
  '同稀有度优先按已核验上线日期从新到旧；未核验日期的条目保持稳定目录顺序。'
