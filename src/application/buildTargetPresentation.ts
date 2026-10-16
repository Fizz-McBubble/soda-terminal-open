import type { CharacterPanelLabel } from '../pages/agentDevelopmentWorkbenchViewModel'
import {
  readTargetPanelMetricSemantic,
  type TargetPanelMetricKey,
  type TargetPanelMetricSemantic,
} from '../gameDataPacks/targetPanelSemantics'
import { resolveReviewedZhaoHpTarget } from '../gameDataPacks/reviewedZhaoSupportTarget'

export type TargetPanel = {
  conditions?: readonly string[]
  sourceRefs?: readonly { id: string }[]
  value: unknown
  status: 'formal' | 'verified_candidate' | 'candidate' | 'missing'
} | null

const panelKeys: Record<CharacterPanelLabel, TargetPanelMetricKey> = {
  生命值: 'hp',
  攻击力: 'atk',
  防御力: 'def',
  冲击力: 'impact',
  暴击率: 'critRate',
  暴击伤害: 'critDamage',
  异常掌控: 'anomalyMastery',
  异常精通: 'anomalyProficiency',
  穿透率: 'penRatio',
  能量自动回复: 'energyRegen',
}
const targetKeys: Partial<Record<CharacterPanelLabel, string[]>> = {
  生命值: ['生命值', 'hp', 'hp_flat'],
  攻击力: ['攻击力', 'attack', 'atk'],
  防御力: ['防御力', 'defense', 'def'],
  冲击力: ['冲击力', 'impact'],
  暴击率: ['暴击率', 'critRate', 'crit_rate'],
  暴击伤害: ['暴击伤害', 'critDamage', 'crit_dmg'],
  异常掌控: ['异常掌控', 'anomalyMastery', 'anomaly_mastery'],
  异常精通: ['异常精通', 'anomalyProficiency', 'anomaly_proficiency'],
  穿透率: ['穿透率', 'pen_ratio'],
  能量自动回复: ['能量自动回复', 'energyRegen', 'energy_regen'],
}

function usesPercent(label: CharacterPanelLabel) {
  return ['暴击率', '暴击伤害', '穿透率'].includes(label)
}
function readTargetValue(panel: TargetPanel, label: CharacterPanelLabel) {
  if (
    !panel ||
    panel.status === 'missing' ||
    !panel.value ||
    typeof panel.value !== 'object' ||
    Array.isArray(panel.value)
  )
    return null
  const values = panel.value as Record<string, unknown>
  const value = targetKeys[label]
    ?.map((key) => values[key])
    .find(
      (item): item is number | { min?: number; max?: number; upperOpen?: boolean } =>
        (typeof item === 'number' && Number.isFinite(item)) ||
        (Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          (typeof (item as { min?: unknown }).min === 'number' ||
            typeof (item as { max?: unknown }).max === 'number')),
    )
  if (value === undefined) return null
  if (
    typeof value !== 'number' &&
    ((value.min !== undefined && !Number.isFinite(value.min)) ||
      (value.max !== undefined &&
        (!Number.isFinite(value.max) || (value.min !== undefined && value.max < value.min))))
  )
    return null
  const inferredBoundary =
    typeof value !== 'number' && value.min === undefined ? ('cap' as const) : ('minimum' as const)
  const semantic = readTargetPanelMetricSemantic(values, panelKeys[label])
  if (semantic === null || (semantic && semantic.boundary !== inferredBoundary)) return null
  return {
    value,
    semantic:
      semantic ??
      ({
        requirement: 'required',
        boundary: inferredBoundary,
        observation: 'out_of_combat',
      } satisfies TargetPanelMetricSemantic),
  }
}

/** Shared lower bound for numeric and range guidance; never synthesizes a target. */
export function targetPanelLowerBound(panel: TargetPanel, label: CharacterPanelLabel) {
  const target = readTargetValue(panel, label)
  if (
    target === null ||
    target.semantic.requirement === 'optional' ||
    target.semantic.boundary === 'cap' ||
    target.semantic.observation !== 'out_of_combat'
  )
    return null
  return typeof target.value === 'number' ? target.value : (target.value.min ?? null)
}

export function targetPanelDisplayValue(panel: TargetPanel, label: CharacterPanelLabel) {
  const target = readTargetValue(panel, label)
  if (target === null) {
    // Reviewed skill-level variants are display guidance, never an unconditional
    // numeric bound. Keep their conditions when no single target is meaningful.
    if (!panel || panel.status === 'missing' || !panel.value || typeof panel.value !== 'object')
      return null
    const values = panel.value as Record<string, unknown>
    if (targetKeys[label]?.some((key) => Object.hasOwn(values, key))) return null
    const variants = values.displayVariants
    if (!Array.isArray(variants)) return null
    const matching = variants.filter(
      (entry): entry is string => typeof entry === 'string' && entry.startsWith(`${label} `),
    )
    return matching.length
      ? matching.map((entry) => entry.slice(label.length).trim()).join(' / ')
      : null
  }
  const { value, semantic } = target
  if (
    label === '暴击率' &&
    semantic.boundary === 'cap' &&
    typeof value !== 'number' &&
    value.max === 50 &&
    panel?.sourceRefs?.some((ref) => ref.id === 'prydwen-ye-shunguang-2.5-2026-08-05')
  )
    return '50%（满核心·沧浪增益生效）'
  return formatNumericTarget(target, label)
}

function formatNumericTarget(
  target: NonNullable<ReturnType<typeof readTargetValue>>,
  label: CharacterPanelLabel,
) {
  const { value, semantic } = target
  // Preserve guide precision separately from the current game's menu rounding.
  const displayTarget = (number: number) => `${number}${usesPercent(label) ? '%' : ''}`
  const base =
    typeof value === 'number'
      ? displayTarget(value)
      : value.min === undefined
        ? `≤${displayTarget(value.max!)}`
        : value.max === undefined
          ? `${displayTarget(value.min)}+`
          : `${displayTarget(value.min)}–${displayTarget(value.max)}${value.upperOpen ? '+' : ''}`
  const qualifiers = [
    ...(semantic.requirement === 'optional' ? ['可选'] : []),
    ...(semantic.observation === 'in_combat' ? ['战斗内'] : []),
  ]
  return qualifiers.length ? `${base}（${qualifiers.join(' · ')}）` : base
}

export type BuildTargetPresentation = { value: string | null; conditions: readonly string[] }

/** Short source values and full applicability travel together; no condition becomes a numeric gate. */
export function targetPanelPresentation(
  panel: TargetPanel,
  label: CharacterPanelLabel,
  context?: { agentId: string; coreLevel?: number | null },
): BuildTargetPresentation {
  const conditions = [...(panel?.conditions ?? [])]
  const target = readTargetValue(panel, label)
  if (!target) {
    const variants =
      panel?.value && typeof panel.value === 'object'
        ? (panel.value as { displayVariants?: unknown }).displayVariants
        : undefined
    if (Array.isArray(variants))
      conditions.push(
        ...variants.filter(
          (entry): entry is string => typeof entry === 'string' && entry.startsWith(label + ' '),
        ),
      )
    // Retain qualified source variants verbatim; never extract an unconditional number from them.
    return { value: targetPanelDisplayValue(panel, label), conditions: [...new Set(conditions)] }
  }
  const guide = formatNumericTarget(target, label)
  if (target.semantic.requirement === 'optional')
    conditions.push('此属性为来源可选参考，不作为通用毕业要求。')
  if (target.semantic.observation === 'in_combat')
    conditions.push('此参考按战斗内数值计，不能直接用局外面板判断达标。')
  if (
    label === '暴击率' &&
    typeof target.value !== 'number' &&
    target.value.max === 50 &&
    target.semantic.boundary === 'cap' &&
    panel?.sourceRefs?.some((ref) => ref.id === 'prydwen-ye-shunguang-2.5-2026-08-05')
  )
    conditions.push(
      '暴击率50%是满核心、沧浪行歌四件套增益生效时的配置参考，不是所有配装的物理上限。',
    )
  const hp =
    label === '生命值' &&
    context &&
    target.semantic.requirement === 'required' &&
    target.semantic.observation === 'out_of_combat'
      ? resolveReviewedZhaoHpTarget(context)
      : null
  if (hp) {
    conditions.push(
      ...hp.conditions,
      '来源攻略的生命参考为' + guide + '，与追加能力的初始生命满档目标分开保留。',
    )
    return { value: String(hp.minimum) + '+', conditions: [...new Set(conditions)] }
  }
  return { value: guide, conditions: [...new Set(conditions)] }
}
