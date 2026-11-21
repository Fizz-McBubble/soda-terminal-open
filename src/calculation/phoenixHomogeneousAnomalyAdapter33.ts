import { calculateAnomalyDamageCore, standardAnomalyBaseMultiplier } from './anomalyDamageCore'
import {
  calculateReviewedPhoenixAbloomSnapshot33,
  phoenixEventSnapshot33Schema,
  type PhoenixEventSnapshot33Input,
} from './phoenixEventSnapshot33'
import { stableContentHash } from '../gameDataPacks/types'

/** The existing heterogeneous aggregator intentionally rejects these factors.
 * For identical original snapshots there is no aggregation ambiguity: evaluate
 * the actual complete snapshot with the independent core. Obtain the named MV,
 * crit and all identity/timeline checks from the existing reviewed consumer.
 * No missing factor is filled and no source formula/lock is edited. */
export function calculatePhoenixHomogeneousOriginal33(raw: PhoenixEventSnapshot33Input) {
  const parsed = phoenixEventSnapshot33Schema.safeParse(raw)
  if (!parsed.success) return calculateReviewedPhoenixAbloomSnapshot33(raw)
  const input = parsed.data
  const rows = input.originalAnomaly.contributions
  const first = rows[0]!.stats
  if (!rows.every((row) => stableContentHash(row.stats) === stableContentHash(first)))
    return calculateReviewedPhoenixAbloomSnapshot33(raw)
  if (first.anomalyCritRate !== 0 || first.anomalyCritDamage !== 0)
    return {
      status: 'unsupported' as const,
      reason: 'existing_original_anomaly_crit',
      blockers: ['existing_original_anomaly_crit'],
    }
  if (input.coefficientBasis === 'sinburn_fire_attack_coefficient' && first.flatAnomalyDamage !== 0)
    return { status: 'unsupported' as const, reason: 'sinburn_flat_anomaly_unit_unresolved', blockers: ['sinburn_flat_anomaly_unit_unresolved'] }
  // Explicit algebraic separation of KNOWN factors, not missing-data defaults.
  const normalized = structuredClone(input)
  for (const row of normalized.originalAnomaly.contributions)
    for (const key of [
      'anomalyBaseBonus',
      'flatAnomalyDamage',
      'buffBonus',
      'directDamageBonus',
      'defenseIgnore',
    ] as const)
      row.stats[key] = 0
  const checked = calculateReviewedPhoenixAbloomSnapshot33(normalized)
  if (checked.status !== 'supported') return checked
  try {
    const original = calculateAnomalyDamageCore({
      ...first,
      ...input.originalAnomaly.target,
      baseMultiplier: standardAnomalyBaseMultiplier(input.originalAnomaly.attribute),
    })
    const nonCriticalDamage = original.nonCriticalDamage * checked.event.originalDamageScale
    const critRate = checked.anomalyCrit.anomalyCritRate
    const critDamage = checked.anomalyCrit.anomalyCritDamage
    return {
      ...checked,
      damage: {
        nonCriticalDamage,
        criticalDamage: nonCriticalDamage * (1 + critDamage),
        expectedDamage: nonCriticalDamage * (1 + critRate * critDamage),
        factors: {
          ...original.factors,
          anomalyBase: original.factors.anomalyBase * checked.event.originalDamageScale,
          expectedAnomalyCritMultiplier: 1 + critRate * critDamage,
        },
      },
      originalAnomaly: {
        ...checked.originalAnomaly,
        nonCriticalDamage: original.nonCriticalDamage,
      },
      formulaHash: stableContentHash({
        adapter: 'homogeneous-complete-original-snapshot/v1',
        reviewed: checked.formulaHash,
      }),
      sourceRefs: [
        ...checked.sourceRefs,
        'phoenixHomogeneousAnomalyAdapter33:identical-complete-snapshot-factorization',
      ],
    }
  } catch (error) {
    return {
      status: 'unsupported' as const,
      reason: 'homogeneous_original_formula_rejected',
      blockers: [error instanceof Error ? error.message : String(error)],
    }
  }
}
