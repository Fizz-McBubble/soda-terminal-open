import { getPublicStatLabel } from '../application/publicCandidateLabels'
import type {
  RetentionBlocker,
  RetentionReasonKind,
} from '../warehouse/absoluteDiscRetentionContract'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import { readableAgentName } from './warehouseFactLabels'

export const reasonLabels: Record<RetentionReasonKind, string> = {
  quality_keep: '副词条已达标',
  functional_ready: '功能用途已具备',
  try_next_upgrade: '值得试一次强化',
  quality_borderline: '品质处于边界',
  conditional_use: '用途条件待核对',
  missing_fact: '相关资料待确认',
  proven_low_ceiling: '强化上界仍不足',
  low_investment_value: '继续投入价值偏低',
  no_supported_use: '支持范围内未证用途',
  approved_rarity_cleanup: 'A/B 级盘清理规则',
  invalid_record: '盘记录待核对',
}

export function score(value: number) {
  return value.toFixed(1)
}

export function branchLabel(profileId?: string) {
  if (!profileId) return null
  const branch = profileId.slice(profileId.indexOf(':') + 1)
  if (branch.startsWith('base-')) return '常规构筑'
  if (branch.startsWith('main-alt-')) return '替代主词构筑'
  if (branch.startsWith('condition-')) return '条件构筑'
  if (branch.startsWith('reviewed-') || branch.startsWith('team-')) return '队伍构筑'
  if (branch === 'two-piece-only') return '两件套构筑'
  return '相关构筑'
}

export function readableField(field: string) {
  const stat = getPublicStatLabel(field)
  if (stat && stat !== field) return stat
  const main = /^mainStats\.(\d+)\.([a-z0-9_]+)$/.exec(field)
  if (main) return `${main[1]} 号位·${getPublicStatLabel(main[2]) ?? '主词条'}`
  const investmentCapacity = /^investment\.capacity\.(\d+)\./.exec(field)
  if (investmentCapacity) return `${investmentCapacity[1]} 号位投入门槛`
  if (field.startsWith('twoPiece.requires.')) return '两件套使用前提'
  if (field.startsWith('twoPiece.')) return '两件套用途'
  if (field.startsWith('fourPiece.')) return '四件套条件'
  if (field.startsWith('profiles.')) return '角色构筑资料'
  if (field.startsWith('branches.')) return '条件构筑资料'
  const fields: Record<string, string> = {
    mainStat: '主词条',
    setId: '套装',
    slot: '号位',
    rarity: '稀有度',
    level: '强化等级',
    subStats: '副词条',
    sourceCoverage: '资料覆盖',
    policyCalibration: '阈值校准',
    calibration: '清理阈值校准',
    reviewedUseScope: '已审用途范围',
    investment: '阶段投入判断',
    enhancementHistory: '强化记录',
    effectUtility: '套装效果用途',
    functionalTarget: '功能目标',
    numericWeights: '品质标尺',
    cutoffs: '品质阈值',
    'set.twoPieceEffects': '两件套效果来源',
    fourPieceUses: '四件套用途',
    conditionEvidence: '使用条件',
    weightEvidence: '词条权重依据',
  }
  return fields[field] ?? '相关资料字段'
}

export function readableDetail(detail: string) {
  const recordMessages: Record<string, string> = {
    invalid_game_rules: '强化规则资料不完整或不一致',
    missing_standard_rarity: '缺少评分所需的 S 级词条资料',
    invalid_rarity_rules: '该稀有度的强化规则需要核对',
    invalid_disc_identity_or_main: '盘编号、号位或主词条需要核对',
    invalid_substat_lines: '副词条数量、重复项或主副词冲突需要核对',
    inconsistent_substat_record: '副词条数值与记录的强化次数不一致',
    inconsistent_enhancement_history: '强化等级与解锁、升级次数不一致',
    no_scoreable_legal_substats: '缺少可用于该构筑评分的合法副词条',
    incomplete_legal_substat_pool: '剩余可解锁的副词条资料不完整',
    unknown_error: '暂时无法读取完整盘记录',
  }
  if (recordMessages[detail]) return recordMessages[detail]
  // This reviewed image branch is explicitly scoped to potential 6/6 and these
  // two teams. Keep those conditions while replacing collection landmarks.
  const illustratedLycaon =
    '73045858-1.png：激发潜能ON；驱动盘推荐分区6冲击力/能量恢复；下方莱卡恩+苍角+雅、莱卡恩+雨果+莱特。'
  if (detail === illustratedLycaon)
    return '需核对莱卡恩激发潜能是否达到6/6，以及用途是否适用于莱卡恩+苍角+雅或莱卡恩+雨果+莱特队伍；6号位冲击力或能量自动回复仅作候选方向，需结合整套配装确认。'
  const text = detail
    .replace(/(?:[\w-]+\/)*[\w.-]+\.(?:png|jpe?g|webp)\s*[:：]?\s*/gi, '')
    .replace(/激发潜能\s*ON\b/gi, '需开启激发潜能')
    .replace(/激发潜能\s*OFF\b/gi, '未开启激发潜能的构筑')
    .replace(/驱动盘推荐分区([456])/g, '$1号位可选')
    .replace(/([；;]|^)(?:下方|上方)(?=[^；;。]*\+)/g, '$1适用队伍：')
    .replace(/已收藏，按(?:明确|你的)保留(?:意图|选择)保护。/g, '已有保留记录。')
    .replace(/\b[a-z0-9_-]+:(?:base-\d+|condition-\d+):[a-f0-9]{8,}\b/gi, '相关构筑')
    .replace(/\b(?:mainStats\.\d+\.[a-z0-9_]+|functionalTarget|numericWeights)\b/g, (field) =>
      readableField(field),
    )
    .replace(/\b[a-z][a-z0-9_]*\b/g, (stat) => getPublicStatLabel(stat) ?? stat)
  return text.trim() || '具体条件待核对。'
}

export function blockerText(blocker: RetentionBlocker) {
  const branch = branchLabel(blocker.profileId)
  const scope = blocker.agentId
    ? `${readableAgentName(blocker.agentId)}${branch ? `（${branch}）` : ''}`
    : (branch ?? '当前分析范围')
  return `${scope} · ${readableField(blocker.field)}：${readableDetail(blocker.detail)}`
}

export function playerRetentionCopy(
  evidence: WarehouseAbsoluteRetentionEvidence,
  discLevel: number,
) {
  const action = evidence.nextAction
  const reason = evidence.reasonKind
  const protectedKeep = action?.kind === 'keep' && action.stopWhen.startsWith('当前保护')
  const uncalibrated = evidence.blockedBy?.some(
    (blocker) => blocker.kind === 'policy' && blocker.field === 'calibration',
  )
  const investmentPending = evidence.blockedBy?.some(
    (blocker) => blocker.kind === 'policy' && blocker.field.startsWith('investment.capacity.'),
  )
  const trial = action?.kind === 'try_upgrade' && discLevel < 15 && action.targetLevel !== null
  const titles = {
    keep: '保留',
    try_upgrade: trial ? `先强化到 +${action!.targetLevel}` : '已满级，核对结果',
    review_quality: discLevel >= 15 ? '暂留，结合配装比较' : '暂留，先别急着强化',
    check_condition: '先确认使用条件',
    complete_data: investmentPending ? '暂留，投入门槛待校准' : '暂留，等待资料确认',
    manual_cleanup: reason === 'approved_rarity_cleanup' ? '可清理' : '复核后可清理',
  }
  const explanations: Record<RetentionReasonKind, string> = {
    quality_keep: '已有适合的用途，当前副词条达到保留标准。',
    functional_ready: '主词条已能发挥所需功能，副词条普通也值得保留。',
    try_next_upgrade: '强化后重新分析，不再推荐就停手。',
    quality_borderline: '这张盘尚未明确达标，观察不等于建议强化。',
    conditional_use: '用途取决于队伍或配装条件，确认成立后再投入。',
    missing_fact: '相关用途或清理标准尚未确认，暂不建议继续投入或清理。',
    proven_low_ceiling: '即使后续强化全部往有利方向发展，也达不到清理门槛。',
    low_investment_value: '当前词条不满足继续强化标准，建议停手。',
    no_supported_use: '已核对的用途中，暂未找到适合的主词条与套装组合。',
    approved_rarity_cleanup: 'A/B 级盘直接归入清理候选，不需要继续强化。',
    invalid_record: '词条记录与强化规则不一致，请先核对或重新导入。',
  }
  const stop = protectedKeep
    ? '处理前请先确认是否仍在使用。'
    : trial
      ? null
      : action?.kind === 'manual_cleanup'
        ? '清理前请在游戏内确认未装备，并检查是否仍用于方案。'
        : action?.kind === 'check_condition'
          ? '条件未确认前，先别强化或清理。'
          : null
  return {
    title: `下一步：${reason === 'invalid_record' ? '核对词条记录' : action ? titles[action.kind] : '暂留，核对盘记录'}`,
    explanation: protectedKeep
      ? readableDetail(action!.detail)
      : investmentPending
        ? '该用途的投入门槛需单独校准，暂不建议强化或清理。'
        : uncalibrated
          ? '这一类盘的清理标准尚未校准，目前只作观察，不建议清理。'
          : reason
            ? explanations[reason]
            : '暂时无法确认适合的用途，先保留现状。',
    stop,
  }
}
