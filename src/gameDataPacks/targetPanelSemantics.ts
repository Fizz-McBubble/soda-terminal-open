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
  observation: 'out_of_combat' | 'in_combat'
}

export type TargetPanelSemantics = Partial<Record<TargetPanelMetricKey, TargetPanelMetricSemantic>>

function isTargetPanelMetricSemantic(value: unknown): value is TargetPanelMetricSemantic {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const semantic = value as Partial<TargetPanelMetricSemantic>
  return (
    (semantic.requirement === 'required' || semantic.requirement === 'optional') &&
    (semantic.boundary === 'minimum' || semantic.boundary === 'cap') &&
    (semantic.observation === 'out_of_combat' || semantic.observation === 'in_combat')
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
