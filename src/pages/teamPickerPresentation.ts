import { sortCatalogByRarityAndRelease } from '../application/catalogDisplayOrdering'
import { publicAssetCatalog } from '../application/publicAssetCatalog'

// The display projection already carries the verified rarity/release order used
// by the asset directory. Do not inherit first-occurrence order from disc scores.
const agentDirectoryOrder = new Map(
  publicAssetCatalog.agents.map((agent, index) => [agent.stableId, index]),
)

export function sortCompatibleAgentsForPicker(ids: readonly string[], owned: ReadonlySet<string>) {
  return [...new Set(ids)].sort(
    (a, b) =>
      Number(owned.has(b)) - Number(owned.has(a)) ||
      (agentDirectoryOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (agentDirectoryOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
  )
}

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
