import type { StatKey } from '../domain/schemas'

export type RecoveryGroups = {
  groups: Array<{
    groupId: string
    sequences: number[]
    candidateSetId: string
    candidateSetName: string
    representativeDataUrl: string
    reason: string
  }>
}
export type ScanBatchComparison = {
  matches: Array<{
    oldSequence: number
    newSequence: number
    matchMethod: string
    matchConfidence: number
    ambiguousEntity: boolean
  }>
}
export const emptyRecoveryGroups: RecoveryGroups = { groups: [] }

export const scanLifecycleLabels = {
  imported: '当前已导入',
  rolled_back: '已撤销',
  previously_imported: '曾导入',
  not_imported: '未导入',
  unknown: '当前未导入（旧历史未知）',
}

export const statOptions: Array<{ value: StatKey; label: string }> = [
  { value: 'hp_flat', label: '生命值' },
  { value: 'hp_percent', label: '生命值百分比' },
  { value: 'atk_flat', label: '攻击力' },
  { value: 'atk_percent', label: '攻击力百分比' },
  { value: 'def_flat', label: '防御力' },
  { value: 'def_percent', label: '防御力百分比' },
  { value: 'crit_rate', label: '暴击率' },
  { value: 'crit_dmg', label: '暴击伤害' },
  { value: 'anomaly_proficiency', label: '异常精通' },
  { value: 'pen', label: '穿透值' },
  { value: 'pen_ratio', label: '穿透率' },
  { value: 'impact', label: '冲击力' },
  { value: 'anomaly_mastery', label: '异常掌控' },
  { value: 'energy_regen', label: '能量自动回复' },
  { value: 'physical_dmg', label: '物理属性伤害加成' },
  { value: 'fire_dmg', label: '火属性伤害加成' },
  { value: 'ice_dmg', label: '冰属性伤害加成' },
  { value: 'electric_dmg', label: '电属性伤害加成' },
  { value: 'wind_dmg', label: '风属性伤害加成' },
  { value: 'ether_dmg', label: '以太属性伤害加成' },
]
