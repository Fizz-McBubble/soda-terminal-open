import type { DriveDisc } from '../domain/schemas'

/**
 * Player-facing warehouse labels have exactly one implementation of the composite rules; each build
 * only supplies its own allowed label sources (desktop: internal manifest + evaluation rules,
 * public: published display catalog + published stat labels).
 */
export type WarehouseFactLabelSources = {
  setNames: Map<string, string>
  readableSetName: (setId: string) => string
  statLabel: (value: string) => string
  readableAgentName: (agentId: string) => string
}

export function createWarehouseFactLabels(sources: WarehouseFactLabelSources) {
  const { setNames, readableSetName, statLabel, readableAgentName } = sources
  function readablePhysicalDiscLabel(disc: DriveDisc, discs: readonly DriveDisc[]) {
    const peers = discs
      .filter(
        (item) =>
          item.setId === disc.setId && item.slot === disc.slot && item.mainStat === disc.mainStat,
      )
      .sort((left, right) => left.id.localeCompare(right.id))
    const ordinal =
      Math.max(
        0,
        peers.findIndex((item) => item.id === disc.id),
      ) + 1
    return `${readableSetName(disc.setId)} · ${disc.slot}号位 · ${statLabel(disc.mainStat)} · +${disc.level}（同类第${ordinal}张）`
  }
  return {
    setNames,
    readableSetName,
    statLabel,
    readableAgentName,
    readablePhysicalDiscLabel,
    readableWarehouseReason,
  }
}

// Translate only known producer sentences; keep the recorded thresholds intact.
export function readableWarehouseReason(reason: string) {
  const remaining = reason.match(
    /^剩余 (\d+) 个强化节点（(\d+) 个用于补第4词条，(\d+) 次可继续强化）$/,
  )
  if (remaining) {
    if (Number(remaining[1]) === 0) return '已满级。'
    return Number(remaining[2]) > 0
      ? `还可提升 ${remaining[1]} 次词条，其中 ${remaining[2]} 次解锁第 4 条，${remaining[3]} 次强化已有词条。`
      : `还可强化词条 ${remaining[3]} 次。`
  }
  const misses = reason.match(/^已记录 (\d+) 次强化未落在当前维度最有利词条$/)
  if (misses) return `已有 ${misses[1]} 次强化未命中该角色最需要的词条。`
  const viability = reason.match(/^按当前角色有效词条计算，最乐观可达 (.+)，本号位保留线为 (.+)$/)
  if (viability) return `有效词条最多 ${viability[1]} 次命中，建议至少 ${viability[2]} 次。`
  const knownReasons: Record<string, string> = {
    '已收藏，按你的保留选择保护。': '已有保留记录，暂不建议清理。',
    '未记录为当前实装，也未被长期激活或保存方案引用；实际装备状态需在游戏内核对':
      '没有记录这张盘的当前实装或方案引用；实际是否装备请在游戏内核对。',
    '强化历史或角色约束不足，缺少可证潜力上限': '强化记录或角色资料不足，暂时无法估计强化上限。',
    '即使剩余强化全部命中最有利词条，也无法超过同一张现有替代盘，且至少一个适配方向更弱':
      '即使强化到顶，各适配方向也不会超过同一张现有替代盘，其中至少一个方向更弱。',
    '已有等价实体盘覆盖当前角色维度，且本盘没有剩余强化机会':
      '已有其他盘满足当前角色需要，且这张盘已无法继续强化。',
    '即使后续强化全部命中有效词条，也达不到本号位的保留线':
      '即使后续强化都有效，也未达到该号位建议保留的词条数。',
    '即使把剩余强化全部计作有效命中，也达不到本号位的保留线；仅供人工复核':
      '即使后续强化都有效，也未达到该号位建议保留的词条数；清理前请核对。',
    '同一张同套装、号位与主词条实体替代盘覆盖全部当前角色维度；仅供人工复核':
      '已有同套装、号位与主词条的另一张盘满足当前角色需要；清理前请核对。',
    '当前实装、已保存方案、显式多队组合、数据时效或删除后可行性仍保护该实体盘，不建议处理。':
      '这张盘仍可能被现有配装使用，或资料需要更新，暂不建议清理。',
    '被当前装备、长期激活方案或显式多队组合引用；不建议拆分。':
      '正在被当前装备、培养方案或选定的多支队伍使用；请保留。',
    '有效词条基础较弱，不建议继续投入。':
      '本轮不建议继续投入；这不等于没有未来潜力或已经存在完整替代。',
    '已有至少两次强化未命中有效词条，当前收益不足，建议止损。':
      '本轮建议停止投入；这不等于已经存在完整替代。',
    '当前需求和优质备件已由其他盘覆盖。':
      '本轮用途未选中这张盘；替代证据仍需结合当前方案与实体盘复核。',
    '暂无养成需求，词条未达到优质备件的保留标准。':
      '当前未安排培养，且未达到本产品的优质备件标准。',
    '当前账号没有适用需求。': '当前支持范围与账号范围内未识别到用途。',
  }
  return knownReasons[reason] ?? reason
}
