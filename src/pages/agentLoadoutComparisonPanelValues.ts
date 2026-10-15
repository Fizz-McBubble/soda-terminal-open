// Only these metrics have an established graduation-target contract.
export const targetPanelMetricKeys = new Set([
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
])

export function finiteComparisonPanelStats(
  values: Record<string, unknown> = {},
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  )
}
