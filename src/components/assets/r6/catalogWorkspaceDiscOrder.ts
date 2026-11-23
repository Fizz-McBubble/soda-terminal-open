import { publicDiscSetOrder } from '../../../application/publicDiscSetOrder'
import { publicStatOrder } from '../../../application/publicCandidateLabels'
import {
  compareDiscCatalogOrder,
  compareDiscGameOrder,
  compareDiscLevelOrder,
  type DiscSortMode,
} from '../../../domain/discOrdering'
import type { DiscItem } from './types'

// The shared catalog already orders sets by their sourced release version/date.
const discSetOrder = new Map(publicDiscSetOrder.map((set, index) => [set, index]))
const discMainStatOrder = new Map(publicStatOrder.map((stat, index) => [stat, index]))

export function sortDiscs(
  discs: DiscItem[],
  discSortMode: Exclude<DiscSortMode, 'development'>,
): DiscItem[] {
  return [...discs].sort((left, right) => {
    const leftKey = {
      id: left.stableId,
      setId: left.set.stableId,
      slot: left.slot,
      mainStat: left.mainStatKey ?? left.mainStat,
      level: left.level,
      importBatchId: left.importBatchId,
      importSource: left.importSource,
    }
    const rightKey = {
      id: right.stableId,
      setId: right.set.stableId,
      slot: right.slot,
      mainStat: right.mainStatKey ?? right.mainStat,
      level: right.level,
      importBatchId: right.importBatchId,
      importSource: right.importSource,
    }
    const context = { setOrder: discSetOrder, mainStatOrder: discMainStatOrder }
    return discSortMode === 'game'
      ? compareDiscGameOrder(leftKey, rightKey, context)
      : discSortMode === 'level'
        ? compareDiscLevelOrder(leftKey, rightKey, context)
        : compareDiscCatalogOrder(leftKey, rightKey, context)
  })
}
