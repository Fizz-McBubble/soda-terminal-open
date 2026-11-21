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
  panel: { status: 'ok' | 'unsupported'; values: Record<string, unknown> } | null | undefined,
): Record<string, number> {
  if (panel?.status !== 'ok') return {}
  return Object.fromEntries(
    Object.entries(panel.values).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  )
}

export function comparisonStatDeltaSummary(
  stats: readonly { key: string; label: string; unit: string }[],
  baseline: Record<string, number>,
  candidate: Record<string, number>,
  baselineAvailable: boolean,
): string {
  if (!baselineAvailable) return '尚无比较基线'
  const deltas = stats.map((stat) => ({
    stat,
    delta:
      Number.isFinite(baseline[stat.key]) && Number.isFinite(candidate[stat.key])
        ? candidate[stat.key]! - baseline[stat.key]!
        : null,
  }))
  const changes = deltas
    .filter(
      (item): item is typeof item & { delta: number } => item.delta !== null && item.delta !== 0,
    )
    .slice(0, 2)
    .map(({ stat, delta }) => {
      const rounded = Math.round(delta * 10) / 10
      return `${stat.label} ${rounded > 0 ? '+' : ''}${rounded}${stat.unit}`
    })
  const missing = deltas.length === 0 || deltas.some((item) => item.delta === null)
  if (changes.length) return `${changes.join(' · ')}${missing ? ' · 部分属性待核对' : ''}`
  return missing ? '属性待核对' : '所选属性无变化'
}
