import type { AccountLoadout } from './optimizeAccountBuilds'
import { compareCandidatePanelPriority, type SearchPanelObjective } from './candidateSearchFacts'

export type TeamAssignmentObjective = {
  fingerprint: string
  evaluate: (loadouts: readonly AccountLoadout[]) => number | null
}

export const teamAssignmentObjectivePolicy =
  'target-team-raw-domain-search-r8-functional-members-atomic-exchanges'

/** Missing or differently configured functional goals are not equality. */
export function preservesTeamPanelObjectives(
  assignment: readonly { agentId: string; panelObjective?: SearchPanelObjective }[],
  baseline: readonly { agentId: string; panelObjective?: SearchPanelObjective }[],
) {
  if (
    assignment.length !== baseline.length ||
    new Set(assignment.map((row) => row.agentId)).size !== assignment.length
  )
    return false
  return baseline.every((base) => {
    const row = assignment.find((item) => item.agentId === base.agentId)
    if (!row) return false
    const left = row.panelObjective,
      right = base.panelObjective
    if (!left || !right) return left === right
    const stat = right.priorityStat ?? 'anomalyProficiency'
    return (
      stat === (left.priorityStat ?? 'anomalyProficiency') &&
      [left.attackDeficit, right.attackDeficit, left[stat], right[stat]].every(Number.isFinite) &&
      compareCandidatePanelPriority(left, right) === 0
    )
  })
}

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
  for (const assignment of assignments.slice(1, 64)) {
    if (assignment.length !== memberCount) continue
    if (!preservesTeamPanelObjectives(assignment, baseline)) continue
    const value = objective.evaluate(assignment)
    if (value === null || !Number.isFinite(value) || value <= bestValue) continue
    best = assignment
    bestValue = value
  }
  return best
}
