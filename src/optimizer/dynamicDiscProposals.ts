import type { DriveDisc } from '../domain/schemas'
import type { DevelopmentStatWeights } from '../decision/developmentStatWeights'
import { compareCandidateDiscFacts } from './candidateSearchFacts'

/** A local, non-admissible search heuristic. It cannot justify pruning or accepting a swap. */
export function dynamicDiscProposals(
  pool: readonly DriveDisc[],
  current: DriveDisc,
  weights: DevelopmentStatWeights,
): DriveDisc[] {
  if (!['supported', 'limited'].includes(weights.status)) return []
  const known = new Map(
    weights.rows.flatMap((row) =>
      row.status !== 'unsupported' &&
      row.normalizedWeight !== null &&
      Number.isFinite(row.normalizedWeight) &&
      Number.isFinite(row.step) &&
      row.step > 0
        ? [[row.stat, { step: row.step, weight: row.normalizedWeight }] as const]
        : [],
    ),
  )
  if (!known.size) return []
  const unknown = (disc: DriveDisc) =>
    JSON.stringify(
      disc.subStats
        .filter((line) => !known.has(line.stat))
        .map((line) => [line.stat, line.value])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    )
  const unmodeled = unknown(current)
  const score = (disc: DriveDisc) =>
    disc.subStats.reduce((sum, line) => {
      const row = known.get(line.stat)
      return sum + (row ? (line.value / row.step) * row.weight : 0)
    }, 0)
  // Main-stat or unmodeled-stat trades go through the existing diverse/source lanes.
  // Do not value an unknown stat at zero or extrapolate across a different main stat.
  return pool
    .filter(
      (disc) =>
        disc.id !== current.id &&
        disc.slot === current.slot &&
        disc.setId === current.setId &&
        disc.mainStat === current.mainStat &&
        disc.level === current.level &&
        (disc.rarity ?? 'S') === (current.rarity ?? 'S') &&
        unknown(disc) === unmodeled &&
        Number.isFinite(score(disc)),
    )
    .sort((a, b) => score(b) - score(a) || compareCandidateDiscFacts(a, b))
    .slice(0, 2)
}
