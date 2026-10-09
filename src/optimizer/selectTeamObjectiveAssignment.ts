import type { AccountLoadout } from './optimizeAccountBuilds'
import type { SearchPanelObjective } from './candidateSearchFacts'
import type { DriveDisc } from '../domain/schemas'

export type TeamAssignmentObjective = {
  fingerprint: string
  evaluate: (loadouts: readonly AccountLoadout[]) => number | null
  /** Production objectives request the game domain; test/oracle callers can supply narrower domains. */
  domain?: 'game_legal_inventory'
  baselineDiscIdsByAgent?: Readonly<Record<string, readonly string[]>>
  /** Complete source recommendation seed/fallback, separate from actual equipment. */
  sourceDiscIdsByAgent?: Readonly<Record<string, readonly string[]>>
  /** Marginal visitation hint only. It cannot accept or prune a full assignment. */
  visitHint?: (disc: DriveDisc, agentId: string) => number
  hintProbeEvaluations?: () => number
}

export const teamAssignmentObjectivePolicy =
  'target-team-game-legal-search-r12-source-fallback-and-seed'

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
      // Safe fallback: allow component-wise improvements, not unknown trades.
      // A lower attack deficit must never purchase a loss of the priority stat.
      left.attackDeficit <= right.attackDeficit &&
      left[stat]! >= right[stat]!
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
