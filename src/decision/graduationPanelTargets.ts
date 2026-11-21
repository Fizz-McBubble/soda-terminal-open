import type { OutOfCombatKey, PanelResult } from '../calculation/outOfCombatPanel'
import {
  readTargetPanelMetricSemantic,
  type TargetPanelMetricSemantic,
} from '../gameDataPacks/targetPanelSemantics'

const graduationPanelKeys = [
  'hp',
  'atk',
  'def',
  'impact',
  'critRate',
  'critDamage',
  'anomalyMastery',
  'anomalyProficiency',
  'penRatio',
  'energyRegen',
] as const satisfies readonly OutOfCombatKey[]

type GraduationPanelKey = (typeof graduationPanelKeys)[number]
type TargetRange = { min?: number; max?: number; upperOpen?: boolean }
const targetAliases: Record<GraduationPanelKey, readonly string[]> = {
  hp: ['hp', '生命值', 'hp_flat'],
  atk: ['atk', 'attack', '攻击力'],
  def: ['def', 'defense', '防御力'],
  impact: ['impact', '冲击力'],
  critRate: ['critRate', 'crit_rate', '暴击率'],
  critDamage: ['critDamage', 'crit_dmg', '暴击伤害'],
  anomalyMastery: ['anomalyMastery', 'anomaly_mastery', '异常掌控'],
  anomalyProficiency: ['anomalyProficiency', 'anomaly_proficiency', '异常精通'],
  penRatio: ['penRatio', 'pen_ratio', '穿透率'],
  energyRegen: ['energyRegen', 'energy_regen', '能量自动回复', '能量回复'],
}

export type GraduationMetricCompletion = {
  key: GraduationPanelKey
  comparator: 'at_least' | 'at_most'
  requirement: 'required'
  boundary: TargetPanelMetricSemantic['boundary']
  observation: 'out_of_combat'
  current: number
  target: number
  ratio: number
  met: boolean
}

function finiteRange(value: unknown): value is TargetRange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const range = value as TargetRange
  const hasMin = range.min !== undefined
  const hasMax = range.max !== undefined
  if (!hasMin && !hasMax) return false
  if (hasMin && !Number.isFinite(range.min)) return false
  if (hasMax && !Number.isFinite(range.max)) return false
  return !(hasMin && hasMax && range.max! < range.min!)
}

function targetMetric(value: unknown, key: GraduationPanelKey) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const raw = targetAliases[key].map((alias) => record[alias]).find((item) => item !== undefined)
  const inferredBoundary =
    finiteRange(raw) && raw.min === undefined ? ('cap' as const) : ('minimum' as const)
  const sourceSemantic = readTargetPanelMetricSemantic(value, key)
  if (sourceSemantic === null || (sourceSemantic && sourceSemantic.boundary !== inferredBoundary))
    return null
  const semantic =
    sourceSemantic ??
    ({
      requirement: 'required',
      boundary: inferredBoundary,
      observation: 'out_of_combat',
    } satisfies TargetPanelMetricSemantic)
  if (semantic.requirement === 'optional' || semantic.observation !== 'out_of_combat') return null
  if (semantic.boundary === 'cap') {
    if (finiteRange(raw) && raw.min === undefined && raw.max !== undefined && raw.max >= 0)
      return { comparator: 'at_most' as const, target: raw.max, semantic }
    return null
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0)
    return { comparator: 'at_least' as const, target: raw, semantic }
  if (finiteRange(raw) && raw.min !== undefined && raw.min >= 0)
    return { comparator: 'at_least' as const, target: raw.min, semantic }
  return null
}

function ratio(
  current: number,
  target: number,
  comparator: GraduationMetricCompletion['comparator'],
) {
  if (comparator === 'at_most') return current <= target ? 1 : target / current
  if (target === 0) return 1
  return Math.min(1, current / target)
}

/** Minimums measure progress; upper bounds constrain it but never add progress. */
export function scoreGraduationPanelTargets(
  values: Pick<PanelResult, 'values'>['values'],
  target: unknown,
): { score: number; metrics: readonly GraduationMetricCompletion[] } | null {
  const metrics = graduationPanelKeys.flatMap((key) => {
    const requirement = targetMetric(target, key)
    const current = values[key]
    if (!requirement || !Number.isFinite(current) || current < 0) return []
    const attainment = Math.max(
      0,
      Math.min(1, ratio(current, requirement.target, requirement.comparator)),
    )
    return [
      {
        key,
        comparator: requirement.comparator,
        requirement: 'required',
        boundary: requirement.semantic.boundary,
        observation: 'out_of_combat',
        current,
        target: requirement.target,
        ratio: attainment,
        met: attainment === 1,
      } satisfies GraduationMetricCompletion,
    ]
  })
  const progress = metrics.filter((metric) => metric.comparator === 'at_least')
  if (!progress.length) return null
  const average = progress.reduce((sum, metric) => sum + metric.ratio, 0) / progress.length
  const constrained = Math.min(
    average,
    ...metrics.filter((metric) => metric.comparator === 'at_most').map((metric) => metric.ratio),
  )
  return {
    score: metrics.every((metric) => metric.met)
      ? 100
      : Math.min(99, Math.round(constrained * 100)),
    metrics,
  }
}
