import type { DriveDisc } from '../domain/schemas'
import type { CandidateSubstatPriority } from '../gameDataPacks/candidateSubstatPriority'
import {
  candidatePriorityPrefixVector,
  candidatePriorityDominates,
} from '../gameDataPacks/candidateSubstatPriority'
import { compareCandidateDiscFacts } from './candidateSearchFacts'

/** Diverse search seeds only; canonical solving and actual objectives decide acceptance. */
export function candidateDiscProposals(
  discs: readonly DriveDisc[],
  priority: CandidateSubstatPriority,
  usefulStats: readonly string[],
  standardSteps: Readonly<Record<string, number>>,
  score: (disc: DriveDisc) => number,
): DriveDisc[] {
  const units = (disc: DriveDisc) => {
    if (
      disc.subStats.some(
        (line) =>
          !Number.isFinite(standardSteps[line.stat]) ||
          standardSteps[line.stat]! <= 0 ||
          !Number.isFinite(line.value) ||
          line.value < 0,
      )
    )
      return null
    return Object.fromEntries(
      disc.subStats.map((line) => [line.stat, line.value / standardSteps[line.stat]!]),
    )
  }
  const rows = discs.flatMap((disc) => {
    const values = units(disc)
    if (!values) return []
    const numericScore = score(disc)
    if (
      !Number.isFinite(numericScore) ||
      Object.values(values).some((value) => !Number.isFinite(value) || value < 0)
    )
      return []
    return [
      {
        disc,
        units: values,
        vector: candidatePriorityPrefixVector(priority, values),
        score: numericScore,
      },
    ]
  })
  const numericOrder = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.score - a.score || compareCandidateDiscFacts(a.disc, b.disc)
  // Dominance counts give a transitive order; partial comparisons alone do not.
  const ordered = rows
    .map((row) => ({
      ...row,
      dominatedBy: rows.reduce(
        (count, other) => count + Number(candidatePriorityDominates(other.vector, row.vector)),
        0,
      ),
    }))
    .sort((a, b) => a.dominatedBy - b.dominatedBy || numericOrder(a, b))
  const chosen: DriveDisc[] = []
  const add = (disc: DriveDisc | undefined) => {
    if (disc && !chosen.some((row) => row.id === disc.id)) chosen.push(disc)
  }
  add(ordered[0]?.disc)
  for (const main of [...new Set(discs.map((disc) => disc.mainStat))].sort())
    add(ordered.find((row) => row.disc.mainStat === main)?.disc)
  const directions = priority.kind === 'ordered' ? priority.tiers.flat() : [...usefulStats].sort()
  for (const stat of directions)
    add(
      [...rows].sort((a, b) => (b.units[stat] ?? 0) - (a.units[stat] ?? 0) || numericOrder(a, b))[0]
        ?.disc,
    )
  return chosen
}
