import type { AccountLoadout } from './optimizeAccountBuilds'
import { compareCandidatePanelObjective } from './optimizeBuild'

export type TeamAssignmentObjective = {
  fingerprint: string
  evaluate: (loadouts: readonly AccountLoadout[]) => number | null
}

export const teamAssignmentObjectivePolicy =
  'target-team-raw-domain-search-r6-proven-inventory-shortages'

/** Rerank a bounded, already feasible domain; never manufacture missing damage. */
export function selectTeamObjectiveAssignment<T extends AccountLoadout>(
  assignments: readonly T[][],
  memberCount: number,
  objective?: TeamAssignmentObjective,
): T[] {
  const baseline = assignments[0] ?? []
  if (!objective || memberCount !== 3 || baseline.length !== memberCount) return baseline
  let best = baseline
  let bestValue = objective.evaluate(baseline)
  if (bestValue === null || !Number.isFinite(bestValue)) return baseline
  const baselinePanel = baseline.find((item) => item.panelObjective)?.panelObjective
  for (const assignment of assignments.slice(1, 64)) {
    if (assignment.length !== memberCount) continue
    // Preserve the accepted cultivation target before comparing combat output.
    if (
      compareCandidatePanelObjective(
        assignment.find((item) => item.panelObjective)?.panelObjective,
        baselinePanel,
      ) !== 0
    )
      continue
    const value = objective.evaluate(assignment)
    if (value === null || !Number.isFinite(value) || value <= bestValue) continue
    best = assignment
    bestValue = value
  }
  return best
}
