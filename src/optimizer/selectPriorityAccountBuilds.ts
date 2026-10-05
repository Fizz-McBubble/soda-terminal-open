import type { CandidateBuild } from './accountBuildCandidates'
import { compareCandidatePanelPriority as compareCandidatePanelObjective } from './candidateSearchFacts'
import {
  selectTeamObjectiveAssignment,
  type TeamAssignmentObjective,
} from './selectTeamObjectiveAssignment'

export function overlaps(candidate: CandidateBuild, used: Set<string>) {
  return [...candidate.discIds].some((discId) => used.has(discId))
}

export function selectPriorityBuilds(
  priorityIds: string[],
  candidates: Map<string, CandidateBuild[]>,
  objective?: TeamAssignmentObjective,
): CandidateBuild[] {
  // Owner-aware beam pruning must not change the fallback when damage is unavailable.
  const baseline = objective ? selectPriorityBuilds(priorityIds, candidates) : undefined
  let comparisonObjective = objective
  if (objective && baseline?.length === 3 && priorityIds.length === 3) {
    const baselineValue = objective.evaluate(baseline)
    if (baselineValue === null || !Number.isFinite(baselineValue)) return baseline
    comparisonObjective = {
      fingerprint: objective.fingerprint,
      evaluate: (loadouts) =>
        loadouts === baseline ? baselineValue : objective.evaluate(loadouts),
    }
  }
  const beamWidth = 2048
  type State = { selected: CandidateBuild[]; used: Set<string>; score: number; key: string }
  let states: State[] = [{ selected: [], used: new Set(), score: 0, key: '' }]
  const comparePriorityCoverage = (left: State, right: State) => {
    for (const id of priorityIds) {
      const difference =
        Number(right.selected.some((item) => item.agentId === id)) -
        Number(left.selected.some((item) => item.agentId === id))
      if (difference) return difference
    }
    return 0
  }
  for (const agentId of priorityIds) {
    const next: State[] = []
    for (const state of states) {
      next.push(state)
      for (const candidate of candidates.get(agentId) ?? []) {
        if (overlaps(candidate, state.used)) continue
        const used = new Set(state.used)
        candidate.discIds.forEach((discId) => used.add(discId))
        const selected = [...state.selected, candidate]
        next.push({
          selected,
          used,
          score: state.score + candidate.totalScore,
          key: selected
            .map(
              (item) =>
                `${item.agentId}:${[...item.discIds].sort((left, right) => left.localeCompare(right)).join(',')}`,
            )
            .join('|'),
        })
      }
    }
    const seen = new Set<string>()
    states = next
      .sort(
        (left, right) =>
          right.selected.length - left.selected.length ||
          comparePriorityCoverage(left, right) ||
          priorityIds.reduce(
            (difference, id) =>
              difference ||
              compareCandidatePanelObjective(
                left.selected.find((item) => item.agentId === id)?.panelObjective,
                right.selected.find((item) => item.agentId === id)?.panelObjective,
              ),
            0,
          ) ||
          right.score - left.score ||
          left.key.localeCompare(right.key),
      )
      .filter((state) => {
        const key = objective
          ? state.key
          : `${state.selected.map((item) => item.agentId).join(':')}|${[...state.used].sort().join(':')}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, beamWidth)
  }
  const assignments = states.map((state) => state.selected)
  if (baseline && baseline.length >= (assignments[0]?.length ?? 0)) assignments.unshift(baseline)
  return selectTeamObjectiveAssignment(assignments, priorityIds.length, comparisonObjective)
}
