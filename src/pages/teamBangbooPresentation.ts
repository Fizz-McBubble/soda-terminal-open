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

export type BangbooCardDisplay = {
  shortPurpose: string
  statusBadge: '未激活' | '待核实' | null
  fullReason: string
}

const bangbooEvidenceBoundaryPatterns = [
  /^(?:同用途|来源基础量|按一次主动与一次连携).*(?:比较|比较口径|来源量)/u,
  /^(?:未声明|未计入).*(?:战斗触发|对应战斗增益)/u,
  /^不代表.*(?:实战总收益|精确收益|最优收益)/u,
  /^收益取决于.*(?:能量缺口|接收|拾取|触发)[。；;]?$/u,
  /^单次条件容量：/u,
] as const

function playerFacingBangbooReason(value: string) {
  const segments = value
    .trim()
    .split(/(?<=[。！？!?；;])|\r?\n+/u)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .flatMap((segment) => {
      if (/^(?:资料推荐|条件适配)[；;]?$/u.test(segment)) return []
      if (bangbooEvidenceBoundaryPatterns.some((pattern) => pattern.test(segment))) return []
      const translated = segment
        .replace(
          /^基础技能来源参数不完整，当前无法核定数值；可保留手动选择[。；;]?$/u,
          '当前资料不足，暂不能确认具体技能效果；仍可手动选择这只邦布。',
        )
        .replace(
          /^额外能力的适用条件待核实[。；;]?$/u,
          '当前队伍是否满足额外能力条件尚待确认。基础技能仍可使用。',
        )
        .replace(/^待触发条件：(.+?)[；;]$/u, '触发条件：$1。')
        .replace(/(\d)星可激活额外能力[；;]/gu, '$1星可激活额外能力：')
        .replace(/^本队未激活额外能力[；;]/u, '当前队伍未满足额外能力条件；基础技能仍可使用：')
        .replace(/，收益取决于.*(?:能量缺口|接收|拾取|触发)[。]$/u, '。')
      return translated ? [translated] : []
    })
  return segments
    .join('')
    .replace(/[；;]{2,}/gu, '；')
    .replace(/\s+([，；。])/gu, '$1')
    .trim()
}

export function formatBangbooCardDisplay(option: {
  primaryPurpose?: BangbooUtilityPurpose
  activationStatus?: 'active' | 'inactive' | 'unknown'
  recommendationReason?: string
}): BangbooCardDisplay {
  const fullReason = playerFacingBangbooReason(option.recommendationReason ?? '')
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
