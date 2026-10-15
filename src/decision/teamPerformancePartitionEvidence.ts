export type PerformanceInput = {
  gameVersion?: string
  targetTrios: readonly {
    id: string
    stableMemberIds: readonly string[]
    sourceSlugByStableMemberId?: Readonly<Record<string, string | undefined>>
  }[]
  sources: readonly {
    url: string
    phase: string
    partition?: string
    metric?: { kind: string; direction: string; unit: string }
    observations: readonly {
      targetTrioId: string
      characterSlugs?: readonly string[]
      avgRoundM0: number
      m0ObservationStatus: string
    }[]
  }[]
}

const exactKey = (ids: readonly unknown[]) =>
  ids.length === 3 &&
  new Set(ids).size === 3 &&
  ids.every((id) => typeof id === 'string' && id.trim())
    ? JSON.stringify([...ids].sort())
    : null

/** Build a snapshot once, then resolve a pair in O(number of partitions).
 * No mode/version pooling, implicit M1 fallback, or synthetic confidence weight. */
export function createPerformancePartitionEvidenceIndex(datasets: readonly PerformanceInput[]) {
  const partitions = datasets.flatMap((input) => {
    const targets = new Map<string, PerformanceInput['targetTrios'][number]>()
    const ambiguous = new Set<string>()
    for (const target of input.targetTrios) {
      if (targets.has(target.id)) ambiguous.add(target.id)
      targets.set(target.id, target)
    }
    const keys = new Map([...targets].map(([id, target]) => [id, exactKey(target.stableMemberIds)]))
    return input.sources.flatMap((source) => {
      const metric = source.metric
      if (
        !metric ||
        !metric.kind.trim() ||
        !metric.unit.trim() ||
        !['higher_is_better', 'lower_is_better'].includes(metric.direction)
      )
        return []
      const values = new Map<string, number | null>()
      for (const row of source.observations) {
        const key = keys.get(row.targetTrioId)
        if (
          !key ||
          ambiguous.has(row.targetTrioId) ||
          row.m0ObservationStatus !== 'observed' ||
          !Number.isFinite(row.avgRoundM0) ||
          row.avgRoundM0 <= 0
        )
          continue
        const slugs = targets.get(row.targetTrioId)!.sourceSlugByStableMemberId
        if (
          slugs &&
          (exactKey(Object.keys(slugs)) !== key ||
            !row.characterSlugs ||
            exactKey(Object.values(slugs)) === null ||
            exactKey(row.characterSlugs) !== exactKey(Object.values(slugs)))
        )
          continue
        // Multiple usable observations for one identity are ambiguous, not an
        // invitation to choose the largest row or average unlike observations.
        values.set(key, values.has(key) ? null : row.avgRoundM0)
      }
      return [
        {
          sourceUrl: source.url,
          phase: source.phase,
          partition: source.partition ?? null,
          evidenceVersion: input.gameVersion ?? null,
          metric: structuredClone(metric),
          values,
        },
      ]
    })
  })
  return {
    sourcePartitionCount: partitions.length,
    review(strongerIds: readonly string[], weakerIds: readonly string[]) {
      const strongerKey = exactKey(strongerIds),
        weakerKey = exactKey(weakerIds)
      const validIdentity = Boolean(strongerKey && weakerKey && strongerKey !== weakerKey)
      const comparisons = !validIdentity
        ? []
        : partitions.flatMap((partition) => {
            const a = partition.values.get(strongerKey!),
              b = partition.values.get(weakerKey!)
            if (a == null || b == null) return []
            const direction =
              a === b
                ? 0
                : (a > b ? 1 : -1) * (partition.metric.direction === 'higher_is_better' ? 1 : -1)
            return [
              {
                sourceUrl: partition.sourceUrl,
                phase: partition.phase,
                partition: partition.partition,
                evidenceVersion: partition.evidenceVersion,
                metric: structuredClone(partition.metric),
                strongerValue: a,
                weakerValue: b,
                relation:
                  direction > 0
                    ? ('supports_preference' as const)
                    : direction < 0
                      ? ('opposes_preference' as const)
                      : ('tied' as const),
              },
            ]
          })
      const opposed = comparisons.some((row) => row.relation === 'opposes_preference')
      return {
        status: opposed ? ('partition_dependent' as const) : ('retained_local_preference' as const),
        comparisons,
        identityValid: validIdentity,
        defaultSameBandOrderingEligible: validIdentity && !opposed,
        numericalStrengthAdjudication: false as const,
      }
    },
  }
}

/** Explicit supplied data is snapshotted afresh, never cached by mutable object identity. */
export function reviewProductionPairwiseDatasets(
  strongerIds: readonly string[],
  weakerIds: readonly string[],
  datasets: readonly PerformanceInput[],
) {
  return createPerformancePartitionEvidenceIndex(datasets).review(strongerIds, weakerIds)
}
