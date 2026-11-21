import type { GoldenTop10Data } from './types'

type Benchmark = NonNullable<GoldenTop10Data['valueBenchmarks']>[number]

export type ComparisonImpactTone = 'positive' | 'negative' | 'even' | 'unknown' | 'stale'

export function comparisonImpactTone(
  benchmark: Benchmark | undefined,
  stale: boolean,
): ComparisonImpactTone {
  if (stale || benchmark?.status === 'stale') return 'stale'
  if (!benchmark || benchmark.status !== 'supported') return 'unknown'
  const delta =
    benchmark.coverage.domain === 'prepared_anomaly_settlement' ||
    benchmark.comparisonBasis?.rankingMethod === 'fixed_single_action_damage_delta'
      ? benchmark.totalDamageDelta
      : benchmark.planningDpsDelta
  if (delta === null) return 'unknown'
  if (delta > 0) return 'positive'
  if (delta < 0) return 'negative'
  return 'even'
}
