export type FieldTimeMode =
  | 'background'
  | 'burst_swap'
  | 'shared_rotation'
  | 'primary_field'
  | 'dominant_field'

export const fieldTimeDemandWeights = Object.freeze({
  background: 0.15,
  burst_swap: 0.25,
  shared_rotation: 0.45,
  primary_field: 0.7,
  dominant_field: 0.8,
} satisfies Record<FieldTimeMode, number>)

export function classifyFieldTimeDemand(value: number): FieldTimeMode {
  if (value <= 0.15) return 'background'
  if (value <= 0.3) return 'burst_swap'
  if (value <= 0.5) return 'shared_rotation'
  if (value <= 0.7) return 'primary_field'
  return 'dominant_field'
}

export function resolveFieldTimeDemand(mode: FieldTimeMode) {
  return fieldTimeDemandWeights[mode]
}

export function normalizeFieldTimeDemand(value: number) {
  return resolveFieldTimeDemand(classifyFieldTimeDemand(value))
}

export const fieldTimeDemandContract = Object.freeze({
  contract: 'soda-field-time-demand/v1',
  modes: Object.keys(fieldTimeDemandWeights) as FieldTimeMode[],
  boundary:
    '数值是组队轮转预算权重，不是实测站场秒数或百分比。模式必须由来源化玩法/轮转合同确定，不按职业默认推断。',
})
