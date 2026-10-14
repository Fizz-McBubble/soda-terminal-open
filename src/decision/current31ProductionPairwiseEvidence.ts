import performance from '../gameDataPacks/data/reviewed-team-performance.3.1.json'

type PerformanceInput = {
  targetTrios: readonly { id: string; stableMemberIds: readonly string[] }[]
  sources: readonly {
    url: string
    phase: string
    metric?: { kind: string; direction: string; unit: string }
    observations: readonly {
      targetTrioId: string
      avgRoundM0: number
      m0ObservationStatus: string
    }[]
  }[]
}

const key = (ids: readonly string[]) => [...ids].sort().join('|')

/** Published cohort observations can contradict an unconditional preference.
 * They cannot prove the opposite theoretical order: builds, sample counts and
 * uncertainty are not available here. Compare only within one source partition. */
export function reviewCurrent31ProductionPairwiseEvidence(
  strongerIds: readonly string[],
  weakerIds: readonly string[],
  input: PerformanceInput = performance,
) {
  const targets = (ids: readonly string[]) =>
    new Set(
      input.targetTrios.filter((row) => key(row.stableMemberIds) === key(ids)).map((row) => row.id),
    )
  const stronger = targets(strongerIds)
  const weaker = targets(weakerIds)
  const comparisons = input.sources.flatMap((source) => {
    const metric = source.metric
    if (!metric || !['higher_is_better', 'lower_is_better'].includes(metric.direction)) return []
    const observed = (ids: Set<string>) =>
      source.observations.filter(
        (row) =>
          ids.has(row.targetTrioId) &&
          row.m0ObservationStatus === 'observed' &&
          Number.isFinite(row.avgRoundM0) &&
          row.avgRoundM0 > 0,
      )
    const left = observed(stronger)
    const right = observed(weaker)
    // Multiple rows cannot be silently averaged or selected by the best score.
    if (left.length !== 1 || right.length !== 1) return []
    const difference =
      (left[0]!.avgRoundM0 - right[0]!.avgRoundM0) *
      (metric.direction === 'higher_is_better' ? 1 : -1)
    return [
      {
        sourceUrl: source.url,
        phase: source.phase,
        metric: { ...metric },
        strongerValue: left[0]!.avgRoundM0,
        weakerValue: right[0]!.avgRoundM0,
        relation:
          difference > 0
            ? ('supports_preference' as const)
            : difference < 0
              ? ('opposes_preference' as const)
              : ('tied' as const),
      },
    ]
  })
  const opposed = comparisons.some((row) => row.relation === 'opposes_preference')
  return {
    status: opposed ? ('partition_dependent' as const) : ('retained_local_preference' as const),
    comparisons,
    // No observations preserve the existing local adjudication, never upgrade
    // it to independent evidence. Opposing data withholds default hard ordering.
    defaultSameBandOrderingEligible: !opposed,
    numericalStrengthAdjudication: false as const,
  }
}
