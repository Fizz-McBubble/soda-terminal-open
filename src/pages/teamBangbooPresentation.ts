import type { BangbooUtilityPurpose } from '../calculation/currentBangbooUtilityProjectionTypes'

export const BANGBOO_PURPOSE_LABELS: Record<BangbooUtilityPurpose, string> = {
  energy: '补充普通能量',
  daze: '辅助失衡',
  bangboo_damage: '提高邦布自身伤害',
  anomaly: '补充异常积蓄',
  damage_bonus: '提高伤害加成',
  attack_buff: '提升攻击力',
  sustain: '提供生存支援',
  utility_general: '提供通用辅助',
}

export const BANGBOO_RECOMMENDATION_EXPLANATION =
  '优先保留资料推荐作为起点，再按同类优势与未覆盖用途补充适配项；同用途按一次主动与一次连携的基础量及已明确加成比较，未声明的战斗触发不计入。推荐最多3项，仅推荐可激活项，可在方案中自由选择其他邦布。'

export type BangbooCardDisplay = {
  shortPurpose: string
  statusBadge: '未激活' | '待核实' | null
  fullReason: string
}

export function formatBangbooCardDisplay(option: {
  primaryPurpose?: BangbooUtilityPurpose
  activationStatus?: 'active' | 'inactive' | 'unknown'
  recommendationReason?: string
}): BangbooCardDisplay {
  const fullReason = option.recommendationReason?.trim() ?? ''
  const shortPurpose =
    (option.primaryPurpose && BANGBOO_PURPOSE_LABELS[option.primaryPurpose]) || '查看适配说明'

  let statusBadge: '未激活' | '待核实' | null = null
  if (option.activationStatus === 'inactive') {
    statusBadge = '未激活'
  } else if (option.activationStatus === 'unknown') {
    statusBadge = '待核实'
  }

  return {
    shortPurpose,
    statusBadge,
    fullReason,
  }
}
