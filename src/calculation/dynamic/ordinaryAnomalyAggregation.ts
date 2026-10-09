import { canonical, finite, integer } from './numeric'
export type OrdinaryAnomalySnapshot = {
  attackerLevel: number
  attack: number
  anomalyProficiency: number
  anomalyBaseBonus: number
  flatAnomalyDamage: number
  anomalyCritRate: number
  anomalyCritDamage: number
  damageBonus: number
  buffBonus: number
  directDamageBonus: number
  defenseIgnore: number
  penetrationRatio: number
  penetrationFlat: number
  resistanceIgnore: number
}
export const ordinaryAggregationIdentity = {
  version: 'zsim-source-qualified-ordinary-heterogeneous-snapshots-r1',
  repository: 'ZSim-Dev/ZSim',
  commit: 'e248e9f149a6b889290579d8e673e132be9bde31',
  paths: [
    'zsim/sim_progress/anomaly_bar/AnomalyBarClass.py:257-283',
    'zsim/sim_progress/ScheduledEvent/CalAnomaly.py:195-231',
  ],
  sourceBlobs: [
    '22faea0bb7acfaca278fd7d0d21db3aeb604c62f',
    'd7d58208cc2d2509fd4e855305d84646bd855712',
  ],
} as const
/** This adopts a named upstream aggregation method, not a new claim of measured
 * game accuracy. GO's per-owner kernel does not define a conflicting multi-owner
 * aggregation. Restricted to ordinary same-level snapshots: additional mechanisms
 * need explicit adapters instead of inheriting an unverified averaging rule.
 */
export function aggregateOrdinaryAnomalySnapshots(input: {
  rows: readonly {
    id: string
    buildup: number
    stats: OrdinaryAnomalySnapshot
  }[]
  effectiveAgentBuildup: number
}) {
  const fields = [
    'attackerLevel',
    'attack',
    'anomalyProficiency',
    'anomalyBaseBonus',
    'flatAnomalyDamage',
    'anomalyCritRate',
    'anomalyCritDamage',
    'damageBonus',
    'buffBonus',
    'directDamageBonus',
    'defenseIgnore',
    'penetrationRatio',
    'penetrationFlat',
    'resistanceIgnore',
  ] as const
  if (!input.rows.length || new Set(input.rows.map((r) => r.id)).size !== input.rows.length)
    throw new Error('invalid_snapshot_rows')
  finite(input.effectiveAgentBuildup, 'effective_agent_buildup', Number.MIN_VALUE)
  const zeroOnly = [
    'anomalyBaseBonus',
    'flatAnomalyDamage',
    'anomalyCritRate',
    'anomalyCritDamage',
    'buffBonus',
    'directDamageBonus',
    'defenseIgnore',
  ] as const
  const first = input.rows[0]!.stats
  let sum = 0
  for (const r of input.rows) {
    if (!r.id) throw new Error('missing_snapshot_id')
    finite(r.buildup, 'accepted_snapshot_buildup', Number.MIN_VALUE)
    for (const field of fields) finite(r.stats[field], field)
    integer(r.stats.attackerLevel, 'attacker_level', 1, 60)
    finite(r.stats.attack, 'attack', Number.MIN_VALUE)
    for (const field of ['anomalyProficiency', 'penetrationFlat'] as const)
      finite(r.stats[field], field, 0)
    if (r.stats.attackerLevel !== first.attackerLevel)
      throw new Error('mixed_levels_require_separate_adoption')
    if (zeroOnly.some((field) => r.stats[field] !== 0))
      throw new Error('nonordinary_snapshot_requires_adapter')
    sum += r.buildup
  }
  if (
    !Number.isFinite(sum) ||
    Math.abs(sum - input.effectiveAgentBuildup) > 1e-12 * Math.max(sum, input.effectiveAgentBuildup)
  )
    throw new Error('incomplete_effective_buildup')
  const virtual = Object.fromEntries(
    fields.map((field) => [
      field,
      input.rows.reduce((n, r) => n + r.stats[field] * (r.buildup / sum), 0),
    ]),
  ) as OrdinaryAnomalySnapshot
  // Equal integer levels stay exact; no unreviewed mixed-level rounding assumption.
  virtual.attackerLevel = first.attackerLevel
  for (const value of Object.values(virtual)) finite(value, 'aggregate_value')
  return {
    virtualSnapshot: virtual,
    contributionWeights: input.rows.map((r) => ({ id: r.id, share: r.buildup / sum })),
    inputIdentity: canonical(input),
    source: ordinaryAggregationIdentity,
    authority: 'source_qualified_ordinary_named_settlement' as const,
    independentlyMeasuredInGame: false as const,
    formalCycleReady: false as const,
  }
}
