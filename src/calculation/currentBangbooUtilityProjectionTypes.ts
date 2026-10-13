import type { BangbooBaseUtilityOutput } from './currentBangbooBaseUtilityTypes'
export type BangbooUtilityPurpose =
  | 'energy'
  | 'sustain'
  | 'damage_bonus'
  | 'attack_buff'
  | 'daze'
  | 'anomaly'
  | 'bangboo_damage'
  | 'utility_general'

export interface BangbooComparisonKey {
  readonly purpose: BangbooUtilityPurpose
  readonly unit: string
  readonly receiver: string
  readonly trigger: string
  readonly hpBasis?: string
  readonly isDeterministic: boolean
  readonly deliveryModel: string
  readonly cooldownSeconds?: number
  readonly durationSeconds?: number
  readonly targetAction?: string
  readonly capacityBasis?: string
}

export interface BangbooComparableSlice {
  readonly key: BangbooComparisonKey
  readonly value: number
}

export interface BangbooUtilityProjection {
  readonly stableId: string
  readonly primaryPurpose: BangbooUtilityPurpose
  readonly secondaryPurposes: readonly BangbooUtilityPurpose[]
  readonly baseUtilities: readonly BangbooBaseUtilityOutput[]
  readonly comparableSlice?: BangbooComparableSlice
  readonly recipientFit: 'unknown' | 'base_only' | 'direct' | 'general'
  readonly recommendationReason: string
}

export interface BangbooUtilityProjectionInput {
  readonly memberIds: readonly string[]
  readonly bangbooId: string
  readonly stars: number
  readonly activationStatus: 'active' | 'inactive' | 'unknown'
}

export const onFieldSpecialties: Readonly<Record<string, string>> = Object.freeze({
  on_field_attack: 'attack',
  on_field_stun: 'stun',
  on_field_anomaly: 'anomaly',
})

export const triggerLabels: Readonly<Record<string, string>> = Object.freeze({
  enemy_daze_above_50: '敌人失衡值超过一半时生效',
  enemy_burning_or_shocked: '敌人处于灼烧或感电时追加增益',
  enemy_organic: '对有机敌人追加增益',
  marked_enemy_defeated: '击败标记敌人后缩短冷却',
  enemy_shocked: '敌人处于感电时提升邦布伤害',
  enemy_other_attribute_anomaly: '敌人处于其他属性异常时提升邦布异常积蓄',
  on_field_attack: '强攻成员在场时提升邦布伤害',
  on_field_stun: '击破成员在场时提升邦布失衡',
  on_field_anomaly: '异常成员在场时提升邦布异常积蓄',
  agent_ultimate_used: '成员施放终结技后缩短邦布冷却',
  agent_aftershock_dealt: '成员造成追加攻击后叠加增益',
  agent_ex_special_used: '成员施放强化特殊技后叠加失衡增益',
  ex_special_stacks_at_maximum: '叠满后追加伤害增益',
  ether_veil_verdict_active: '开启对应以太帷幕后增加召唤物',
})

export const primaryPurposeByGameId: Readonly<Record<string, BangbooUtilityPurpose>> =
  Object.freeze({
    '53001': 'anomaly',
    '53002': 'anomaly',
    '53003': 'sustain',
    '53004': 'daze',
    '53005': 'sustain',
    '53006': 'bangboo_damage',
    '53007': 'anomaly',
    '53008': 'sustain',
    '53009': 'bangboo_damage',
    '53010': 'anomaly',
    '53011': 'bangboo_damage',
    '53012': 'energy',
    '53013': 'bangboo_damage',
    '53014': 'bangboo_damage',
    '53015': 'bangboo_damage',
    '53016': 'bangboo_damage',
    '53017': 'energy',
    '53019': 'bangboo_damage',
    '53021': 'bangboo_damage',
    '54001': 'anomaly',
    '54002': 'bangboo_damage',
    '54003': 'anomaly',
    '54004': 'energy',
    '54005': 'bangboo_damage',
    '54006': 'anomaly',
    '54008': 'anomaly',
    '54009': 'anomaly',
    '54010': 'attack_buff',
    '54011': 'bangboo_damage',
    '54012': 'bangboo_damage',
    '54013': 'anomaly',
    '54014': 'anomaly',
    '54015': 'damage_bonus',
    '54016': 'daze',
    '54017': 'bangboo_damage',
    '54018': 'energy',
    '54019': 'bangboo_damage',
    '54020': 'daze',
    '54021': 'bangboo_damage',
    '54022': 'energy',
    '54023': 'bangboo_damage',
  })
