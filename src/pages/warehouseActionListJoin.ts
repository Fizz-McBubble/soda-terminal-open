import type { WarehouseActionItem } from '../application/warehouseActionProjection'
import type { DriveDisc } from '../domain/schemas'
import {
  compareDiscCatalogOrder,
  compareDiscLevelOrder,
  type DiscOrderContext,
  type DiscSortMode,
} from '../domain/discOrdering'
import { compareWarehouseDevelopmentAdvice } from '../application/warehouseDevelopmentPresentation'
import { publicStatOrder } from '../application/publicCandidateLabels'
import { warehouseUseReasons } from '../application/warehouseUseReasons'
import { publicDiscSetOrder } from '../application/publicDiscSetOrder'

export const defaultWarehouseActionListOrder: DiscOrderContext = {
  setOrder: new Map(publicDiscSetOrder.map((set, index) => [set, index])),
  mainStatOrder: new Map(publicStatOrder.map((stat, index) => [stat, index])),
}

export function selectWarehouseCleanupReason(reasons: readonly string[]) {
  const currentProducerReasons = new Set([
    '当前正在装备。',
    '已保存方案正在使用。',
    '选定队伍正在使用。',
    '已收藏，按你的保留选择保护。',
    '当前实装、已保存方案、显式多队组合、数据时效或删除后可行性仍保护该实体盘，不建议处理。',
    ...Object.values(warehouseUseReasons),
  ])
  const currentReason = reasons.find((reason) => currentProducerReasons.has(reason))
  if (currentReason) return currentReason
  const priorities = [
    '当前账号未推荐这一组合，且不属于稀缺主词条或优质通用胚子，可考虑清理。',
    '至少两次强化未命中有效词条，当前有效命中不超过三次，已有满级同类替代',
    '基础号位有效词条较少，已有满级同类盘覆盖当前账号用途',
    '优先培养替代盘，本盘可暂停投入并复核冗余；不必同时培养重复胚子',
    '已有各项属性相同的满级实体盘；本盘没有剩余强化机会',
    '当前账号暂无明确适配用途。',
    '即使剩余强化全部命中最有利词条，也无法超过同一张现有替代盘，且至少一个适配方向更弱',
    '已有等价实体盘覆盖当前角色维度，且本盘没有剩余强化机会',
    '同一张同套装、号位与主词条实体替代盘覆盖全部当前角色维度；仅供人工复核',
    '当前已有同套装、号位与主词条的实体盘，在全部适用维度的当前结果严格更好',
    '当前已有更合适选择，可停止投入并在游戏内确认是否清理',
    '当前已覆盖的已发布代理人中，没有发现套装、号位与主词条均兼容的用途；仅供人工复核',
    '即使把剩余强化全部计作有效命中，也达不到本号位的保留线；仅供人工复核',
    '未记录为当前实装，也未被长期激活或保存方案引用；实际装备状态需在游戏内核对',
  ]
  return priorities.find((reason) => reasons.includes(reason))
}

export function projectWarehouseActionListJoin(
  actions: readonly WarehouseActionItem[],
  discs: readonly DriveDisc[],
  options: DiscOrderContext & { sortMode?: DiscSortMode } = {},
) {
  const discsById = new Map(discs.map((disc) => [disc.id, disc]))
  const rows: Array<{ item: WarehouseActionItem; disc: DriveDisc }> = []
  const missingRecords: WarehouseActionItem[] = []
  for (const item of actions) {
    const disc = discsById.get(item.disc.id)
    if (disc) rows.push({ item, disc })
    else missingRecords.push(item)
  }
  const compareCatalog = (
    left: { item: WarehouseActionItem; disc: DriveDisc },
    right: { item: WarehouseActionItem; disc: DriveDisc },
  ) => compareDiscCatalogOrder(left.disc, right.disc, options)
  if (options.sortMode === 'development') {
    rows.sort(
      (left, right) =>
        compareWarehouseDevelopmentAdvice(
          left.item.developmentAdvice,
          right.item.developmentAdvice,
        ) || compareCatalog(left, right),
    )
  } else if (options.sortMode === 'level') {
    rows.sort((left, right) => compareDiscLevelOrder(left.disc, right.disc, options))
  } else {
    rows.sort(compareCatalog)
  }
  return { rows, missingRecords }
}
