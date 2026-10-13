export const targetPanelMetricKeys = [
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
] as const

export type TargetPanelMetricKey = (typeof targetPanelMetricKeys)[number]

export type TargetPanelMetricSemantic = {
  requirement: 'required' | 'optional'
  boundary: 'minimum' | 'cap'
  observation: 'out_of_combat' | 'in_combat' | 'reference'
}

export type TargetPanelSemantics = Partial<Record<TargetPanelMetricKey, TargetPanelMetricSemantic>>

const metricKeyByLabel: Record<string, TargetPanelMetricKey> = {
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

/** Static account panels can only show required, source-backed guide references. */
export function canDisplayStaticPanelTarget(panel: unknown, label: string): boolean {
  if (!panel || typeof panel !== 'object' || Array.isArray(panel)) return false
  const sourcePanel = panel as { value?: unknown; status?: unknown; sourceRefs?: unknown }
  if (
    sourcePanel.status === 'missing' ||
    !Array.isArray(sourcePanel.sourceRefs) ||
    !sourcePanel.sourceRefs.length
  )
    return false
  const key = metricKeyByLabel[label]
  if (!key) return false
  const semantic = readTargetPanelMetricSemantic(sourcePanel.value, key)
  // Source-backed legacy guidance remains readable. A claimed but invalid typed
  // contract fails closed; optional and combat-only targets are never static goals.
  return (
    semantic === undefined ||
    (semantic !== null &&
      semantic.requirement === 'required' &&
      semantic.observation !== 'in_combat')
  )
}

/** Compatibility guard for saved public snapshots predating typed projection. */
export function staticPanelTargetDisplay(value: string | undefined): string | undefined {
  return value && !/可选|战斗内/.test(value) ? value : undefined
}

function isTargetPanelMetricSemantic(value: unknown): value is TargetPanelMetricSemantic {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const semantic = value as Partial<TargetPanelMetricSemantic>
  return (
    (semantic.requirement === 'required' || semantic.requirement === 'optional') &&
    (semantic.boundary === 'minimum' || semantic.boundary === 'cap') &&
    (semantic.observation === 'out_of_combat' ||
      semantic.observation === 'in_combat' ||
      semantic.observation === 'reference')
  )
}

/**
 * `undefined` means a legacy target without the typed semantic contract. `null`
 * means that a target claims the contract but does not provide a valid entry for
 * this metric, so consumers must fail closed instead of guessing.
 */
export function readTargetPanelMetricSemantic(
  value: unknown,
  key: TargetPanelMetricKey,
): TargetPanelMetricSemantic | null | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const semantics = (value as { targetSemantics?: unknown }).targetSemantics
  if (semantics === undefined) return undefined
  if (!semantics || typeof semantics !== 'object' || Array.isArray(semantics)) return null
  const semantic = (semantics as Record<string, unknown>)[key]
  return isTargetPanelMetricSemantic(semantic) ? semantic : null
}

export function targetPanelMetricSemanticEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const semantics = (value as { targetSemantics?: unknown }).targetSemantics
  if (!semantics || typeof semantics !== 'object' || Array.isArray(semantics)) return []
  return targetPanelMetricKeys.flatMap((key) => {
    const semantic = (semantics as Record<string, unknown>)[key]
    return isTargetPanelMetricSemantic(semantic) ? [[key, semantic] as const] : []
  })
}
