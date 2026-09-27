import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { StatKey } from '../domain/schemas'

const relevantStats: Record<string, StatKey[]> = {
  生命值: ['hp_flat', 'hp_percent'],
  攻击力: ['atk_flat', 'atk_percent'],
  防御力: ['def_flat', 'def_percent'],
  冲击力: ['impact'],
  暴击率: ['crit_rate'],
  暴击伤害: ['crit_dmg'],
  异常掌控: ['anomaly_mastery'],
  异常精通: ['anomaly_proficiency'],
  穿透率: ['pen_ratio'],
  能量自动回复: ['energy_regen'],
}

/** Focus the compact target row on the adopted build; preserve the source targets elsewhere. */
export function developmentGraduationTargets<T extends { label: string }>(
  facts: T[],
  constraint: CandidateWarehouseConstraint | null | undefined,
) {
  if (!constraint) return facts
  const mainStats = new Set(Object.values(constraint.mainStats).flat())
  return facts.filter((fact) =>
    relevantStats[fact.label]?.some(
      (stat) => mainStats.has(stat) || (constraint.subStatWeights[stat] ?? 0) > 0,
    ),
  )
}
