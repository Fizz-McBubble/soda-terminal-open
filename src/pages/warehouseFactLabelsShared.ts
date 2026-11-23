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

const knownWarehouseReasons: Readonly<Record<string, string>> = {
  '此盘不纳入 S 级驱动盘分析，记录继续保留。': '这张盘不纳入 S 级分析，记录继续保留。',
  '补齐列出的用途或品质资料后重新分析。': '这项判断还缺资料，补齐后重新分析。',
  '按列出的字段补齐相关资料后重新分析。': '这项判断还缺资料，补齐后重新分析。',
  '先核对列出的用途条件和完整配装中的功能门槛。': '先确认这项用途需要的队伍或配装条件。',
  '该具名构筑已达到品质保留线。': '词条匹配已达到当前用途的保留参考。',
  '品质已达到保留线；先核对列出的用途条件，再决定投入或装配。':
    '词条匹配已达到当前用途的保留参考；先确认使用条件。',
  '当前版本已审完的支持用途中，没有成立的主词与套装组合。':
    '当前已确认的用途中，没有匹配这套主词条和套装的组合。',
  '所有成立用途的当前品质和合法成长上界均低于清理线。':
    '已验证用途的词条匹配和强化上限都低于清理参考。',
  '该目标的合法副词容量无法满足当前投入门槛；补齐具名投入校准后重新分析。':
    '当前用途的强化次数不足以满足投入参考，先保留。',
  '品质处于清理线与保留线之间，结合具名用途人工复核。':
    '词条匹配在清理参考和保留参考之间，需要按实际用途复核。',
  '已审阅的阶段政策下，所有成立用途均不满足下一节点投入条件。':
    '已验证用途都不满足下一次强化条件。',
  '穿透强化为主的成品先核对具名用途，当前依据不足以建议清理。':
    '这张盘需要先确认实际用途，目前不足以建议清理。',
  '核对等级、初始词条数和真实强化记录。': '核对等级、初始词条数和实际强化记录。',
  '该目标或阶段的投入判断尚未校准。': '这项用途的强化参考还没确认，先保留。',
  '此盘实体标识重复或引用未闭合；先核对实体身份与使用记录。':
    '这张盘的身份或使用记录需要重新核对。',
  '先核对选定队伍的同时用盘范围与实体引用。': '先确认选定队伍同时用到的驱动盘与方案记录。',
  '在已保存的辉映比较条件下，同槽替换可提高该项收益，作为备选盘保留。':
    '当前保存方案中，替换这个号位能提高辉映收益，留作备选。',
  '已核对完整配装的同槽替换收益，作为该方案的备选盘保留。':
    '当前保存方案中，替换这个号位能提升配装，留作备选。',
  '此盘仍有成长潜力；当前未确认已拥有角色的装备改善需求，先作为储备观察。':
    '这张盘还有成长空间，但当前没有确认装备需求，先留作储备。',
  '生产品质阈值尚待独立逐盘样本校准，暂不生成清理候选。': '这类盘的清理参考还不完整，先保留。',
  '该稀有度尚无独立阈值校准，不生成清理候选。': '这类盘的清理参考还不完整，先保留。',
  '套装资料待确认，暂留核对。': '套装资料还不完整，先保留核对。',
  '队伍用盘记录待确认，暂留核对。': '队伍用盘记录还不完整，先保留核对。',
  '按已确认的规则，A/B 级盘直接列为清理候选，不再判断品质或强化价值。':
    '这类低稀有度盘可以列入清理候选。',
  '当前正在装备。': '正在装备这张盘。',
  '已保存方案正在使用。': '已保存方案正在使用这张盘。',
  '选定队伍正在使用。': '选定队伍正在使用这张盘。',
  '当前实装、已保存方案、显式多队组合、数据时效或删除后可行性仍保护该实体盘，不建议处理。':
    '这张盘仍被当前记录使用，或还有资料需要确认，暂不处理。',
  '按收藏、实装或保存方案等明确保护记录保留此盘。': '这张盘有保留或使用记录，先保留。',
  '按保留标记、装备或保存方案等记录保留此盘。': '这张盘有保留或使用记录，先保留。',
  '被当前装备、长期激活方案或显式多队组合引用；不建议拆分。':
    '正在被当前装备、培养方案或选定队伍使用，请保留。',
  '未记录为当前实装，也未被长期激活或保存方案引用；实际装备状态需在游戏内核对':
    '没有记录这张盘的当前装备或方案引用；实际是否装备请在游戏内核对。',
  '强化历史或角色约束不足，缺少可证潜力上限': '强化记录或角色资料不足，暂时无法确认成长上限。',
  '即使剩余强化全部命中最有利词条，也无法超过同一张现有替代盘，且至少一个适配方向更弱':
    '即使强化到顶，各适用方向也不会超过同一张现有替代盘。',
  '已有等价实体盘覆盖当前角色维度，且本盘没有剩余强化机会':
    '已有其他盘满足当前角色需要，且这张盘已无法继续强化。',
  '即使后续强化全部命中有效词条，也达不到本号位的保留线':
    '即使后续强化都有效，也未达到该号位建议保留的词条数。',
  '即使把剩余强化全部计作有效命中，也达不到本号位的保留线；仅供人工复核':
    '即使后续强化都有效，也未达到该号位的保留参考；清理前请核对。',
  '同一张同套装、号位与主词条实体替代盘覆盖全部当前角色维度；仅供人工复核':
    '已有同套装、号位和主词条的盘满足当前角色需要；清理前请核对。',
  '有效词条基础较弱，不建议继续投入。': '当前词条较弱，本轮不建议继续强化。',
  '已有至少两次强化未命中有效词条，当前收益不足，建议止损。':
    '已有至少两次强化未命中有效词条，本轮建议停止投入。',
  '当前需求和优质备件已由其他盘覆盖。': '当前需求和优质备件已由其他盘覆盖。',
  '暂无养成需求，词条未达到优质备件的保留标准。':
    '当前没有培养需求，词条也未达到优质备件的保留参考。',
  '当前账号没有适用需求。': '当前账户记录中没有找到适用用途。',
  '用于当前养成或已选队伍的配装。': '用于当前养成或已选队伍的配装。',
  '词条基础较好，作为已拥有角色的优质备件保留。': '词条基础较好，可作为已拥有角色的优质备件。',
  '适用条件尚未确认，暂留核对。': '适用条件还没确认，先保留核对。',
  '词条记录不完整或不一致，暂留核对。': '词条记录不完整或前后不一致，先保留核对。',
  rarity_outside_analysis_scope: '这张盘不纳入当前分析范围，记录继续保留。',
  explicit_account_reference_protection: '这张盘仍被账户记录使用。',
  approved_rarity_cleanup_policy: '这类低稀有度盘当前可作清理候选。',
  absolute_quality_pass: '词条匹配已达到当前用途的保留参考。',
  sourced_functional_main_ready: '主词条满足当前用途。',
  sourced_functional_main_growth: '主词条功能还需要强化。',
  substat_ceiling_does_not_limit_main_function: '副词条上限不会妨碍主词条功能。',
  incomplete_or_stale_evidence: '这项判断还有资料需要更新。',
  functional_target_needs_build_context: '主词条功能需要结合完整配装确认。',
  cleanup_policy_not_calibrated: '这类盘的清理参考还不完整，先保留。',
  rarity_cleanup_threshold_not_calibrated: '这类盘的清理参考还不完整，先保留。',
  no_supported_use_in_closed_scope: '当前已确认的用途中没有适合的搭配。',
  no_verified_use_is_not_proof_of_worthlessness: '尚未找到适用用途，但不能据此清理。',
  all_verified_uses_below_absolute_quality_line: '已验证用途的词条匹配低于保留参考。',
  legal_growth_cannot_reach_line: '剩余强化也无法达到当前用途的保留参考。',
  next_upgrade_trial_qualified: '可以试一次强化，再根据结果重新分析。',
  not_an_investment_probability: '这不是强化成功率。',
  investment_policy_capacity_not_calibrated: '当前用途的强化投入参考还没确认。',
  absolute_quality_borderline: '词条匹配在清理参考和保留参考之间。',
  reviewed_stage_policy_rejects_investment: '已验证用途都不满足下一次强化条件。',
  legal_upside_still_exists: '继续强化仍可能出现更好的词条结果。',
  stage_policy_not_closed: '这项用途的强化参考还没确认，先保留。',
  invalid_record: '词条记录需要重新核对。',
  cleanup_calibration_scope_unresolved: '清理参考还有条件未确认，先保留。',
}

// Translate only known producer sentences; never echo opaque producer or source text.
export function readableWarehouseReason(reason: string) {
  const normalized = reason.trim()
  const actualProtection = [
    ['已收藏，按明确保留意图保护。', '已标记保留'],
    ['已收藏，按你的保留选择保护。', '已标记保留'],
    ['当前正在装备。', '正在装备'],
    ['已保存方案正在使用。', '已被保存方案使用'],
    ['选定队伍正在使用。', '已被选定队伍使用'],
  ]
    .filter(([marker]) => normalized.includes(marker))
    .map(([, label]) => label)
  if (actualProtection.length) return `这张盘${actualProtection.join('、')}。`

  const remaining = normalized.match(
    /^剩余 (\d+) 个强化节点（(\d+) 个用于补第4词条，(\d+) 次可继续强化）$/,
  )
  if (remaining) {
    if (Number(remaining[1]) === 0) return '已满级。'
    return Number(remaining[2]) > 0
      ? `还可提升 ${remaining[1]} 次词条，其中 ${remaining[2]} 次解锁第 4 条，${remaining[3]} 次强化已有词条。`
      : `还可强化词条 ${remaining[3]} 次。`
  }
  const misses = normalized.match(/^已记录 (\d+) 次强化未落在当前维度最有利词条$/)
  if (misses) return `已有 ${misses[1]} 次强化未命中该角色最需要的词条。`
  const viability = normalized.match(
    /^按当前角色有效词条计算，最乐观可达 (\d+(?:\.\d+)?)，本号位保留线为 (\d+(?:\.\d+)?)$/,
  )
  if (viability) return `有效词条最多 ${viability[1]} 次命中，建议至少 ${viability[2]} 次。`
  const functionalGrowth = normalized.match(
    /^已证实的单盘主词功能尚需强化；先到 \+(\d+) 后重新分析。$/,
  )
  if (functionalGrowth) return `主词条功能还需要强化；先到 +${functionalGrowth[1]} 后重新分析。`
  const trial = normalized.match(/^仅建议试到 \+(\d+)，记录结果后重新分析。$/)
  if (trial) return `先试到 +${trial[1]}，记录结果后重新分析。`
  const conditionalTrial = normalized.match(/^先核对列出的用途条件，成立后才试到 \+(\d+)。$/)
  if (conditionalTrial) return `先确认用途条件；成立后再试到 +${conditionalTrial[1]}。`
  const planReferences = normalized.match(/^已被 (\d+) 份当前方案引用$/)
  if (planReferences) return `已被 ${planReferences[1]} 份当前方案使用。`
  const compatibleAgents = normalized.match(
    /^仍适合当前账号 (\d+) 名代理人，现有替代盘不能完全覆盖这些用途$/,
  )
  if (compatibleAgents) return `仍适合当前账号 ${compatibleAgents[1]} 名角色。`

  return knownWarehouseReasons[normalized] ?? ''
}
