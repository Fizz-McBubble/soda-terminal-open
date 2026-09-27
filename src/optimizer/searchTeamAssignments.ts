import type { DriveDisc } from '../domain/schemas'
import type { AccountLoadout } from './optimizeAccountBuilds'
import { canStillCompleteSetPattern, compareCandidatePanelObjective } from './optimizeBuild'
import type { TeamAssignmentObjective } from './selectTeamObjectiveAssignment'

export type TeamSearchDomain<T extends AccountLoadout> = {
  agentId: string
  slots: DriveDisc[][]
  patterns: Record<string, number>[]
  compile: (discs: DriveDisc[]) => T | null
}

export type TeamSearchEvidence = {
  status: 'complete' | 'feasible' | 'budget_exhausted' | 'unsupported'
  visitedNodes: number
  evaluatedAssignments: number
  domain: 'profile_legal_discs'
  /** Necessary-condition failures proved across every supplied set branch. */
  shortages?: TeamInventoryShortage[]
}

export type TeamInventoryShortage = {
  agentIds: string[]
  required: number
  available: number
} & ({ kind: 'set'; setId: string } | { kind: 'slot'; slot: number })

function provenInventoryShortages<T extends AccountLoadout>(domains: TeamSearchDomain<T>[]) {
  const shortages: TeamInventoryShortage[] = []
  // At most seven nonempty member subsets for a three-person team. Looking at
  // subsets also catches two members competing for one slot while the third
  // member has plenty of unrelated discs. Counts use physical identities.
  for (let mask = 1; mask < 1 << domains.length; mask++) {
    const members = domains.filter((_, index) => mask & (1 << index))
    const agentIds = members.map((member) => member.agentId)
    const setIds = new Set(members.flatMap((member) => member.patterns.flatMap(Object.keys)))
    for (const setId of setIds) {
      const required = members.reduce(
        (total, member) =>
          total +
          (member.patterns.length
            ? Math.min(...member.patterns.map((pattern) => pattern[setId] ?? 0))
            : 0),
        0,
      )
      const available = new Set(
        members.flatMap((member) =>
          member.slots
            .flat()
            .filter((disc) => disc.setId === setId)
            .map((disc) => disc.id),
        ),
      ).size
      if (required > available)
        shortages.push({ kind: 'set', setId, agentIds, required, available })
    }
    for (let slot = 0; slot < 6; slot++) {
      const required = members.length
      const available = new Set(
        members.flatMap((member) => member.slots[slot]!.map((disc) => disc.id)),
      ).size
      if (required > available)
        shortages.push({ kind: 'slot', slot: slot + 1, agentIds, required, available })
    }
  }
  // A short explanation is enough; retain the strongest proof of each kind.
  shortages.sort(
    (left, right) =>
      right.required - right.available - (left.required - left.available) ||
      left.agentIds.length - right.agentIds.length ||
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
  )
  return ['set', 'slot'].flatMap((kind) => shortages.find((item) => item.kind === kind) ?? [])
}

/** Enumerate the raw legal domain. Only identity and set feasibility prune it.
 * The opaque objective has no proven upper bound: a budget stop is not pruning.
 */
export function searchTeamAssignments<T extends AccountLoadout>(
  baseline: T[],
  domains: TeamSearchDomain<T>[],
  objective?: TeamAssignmentObjective,
  budget = { evaluations: 64, nodes: 20000 },
): { selected: T[]; evidence: TeamSearchEvidence } {
  const evidence: TeamSearchEvidence = {
    status: 'unsupported',
    visitedNodes: 0,
    evaluatedAssignments: 0,
    domain: 'profile_legal_discs',
  }
  let selected = baseline
  if (domains.length !== 3) return { selected, evidence }
  const needsCompleteAssignment = baseline.length !== 3
  let panelBaseline = baseline
  let best = baseline.length === 3 ? objective?.evaluate(baseline) : null
  if (baseline.length === 3 && objective) evidence.evaluatedAssignments++
  // An unavailable combat objective preserves an already complete assignment.
  // It must not prevent an incomplete team from finding eighteen legal discs.
  if (!needsCompleteAssignment && (best == null || !Number.isFinite(best)))
    return { selected, evidence }
  const key = (items: readonly AccountLoadout[]) =>
    items
      .map(
        (item) =>
          `${item.agentId}:${item.discs
            .map((choice) => choice.disc.id)
            .sort()
            .join(',')}`,
      )
      .sort()
      .join('|')
  const seen = new Set([key(baseline)])
  const slots = domains
    .flatMap((domain, member) =>
      domain.slots.map((discs, slot) => ({
        member,
        slot,
        discs: [...discs].sort((a, b) => a.id.localeCompare(b.id)),
      })),
    )
    .sort((a, b) => a.discs.length - b.discs.length || b.member - a.member || b.slot - a.slot)
  const used = new Set<string>()
  const chosen: DriveDisc[][] = domains.map(() => [])
  const counts: Record<string, number>[] = domains.map(() => ({}))
  // A member's compile closure fixes its profile and account parameters for
  // this search. Reusing that same six-disc result cannot change team value;
  // the team objective still runs separately for each complete assignment.
  const compiledByMember = domains.map(() => new Map<string, T | null>())
  let stopped = false
  let foundFeasible = false
  function visit(depth: number) {
    if (stopped) return
    if (evidence.visitedNodes >= budget.nodes) {
      stopped = true
      return
    }
    evidence.visitedNodes++
    if (depth === slots.length) {
      const assignment = domains.map((domain, member) => {
        const discs = chosen[member]!
        const identity = JSON.stringify(discs.map((disc) => disc.id).sort())
        const cache = compiledByMember[member]!
        if (!cache.has(identity)) cache.set(identity, domain.compile(discs))
        return cache.get(identity)!
      })
      if (assignment.some((item) => item === null)) return
      const complete = assignment as T[]
      if (
        selected.length === 3 &&
        complete.some(
          (item) =>
            compareCandidatePanelObjective(
              item.panelObjective,
              panelBaseline.find((base) => base.agentId === item.agentId)?.panelObjective,
            ) !== 0,
        )
      )
        return
      const identity = key(complete)
      if (seen.has(identity)) return
      if (evidence.evaluatedAssignments >= budget.evaluations) {
        stopped = true
        return
      }
      seen.add(identity)
      evidence.evaluatedAssignments++
      const value = objective?.evaluate(complete)
      if (selected.length !== 3) {
        selected = complete
        panelBaseline = complete
        best = value
        if (value == null || !Number.isFinite(value)) {
          foundFeasible = true
          stopped = true
        }
      } else if (value != null && Number.isFinite(value) && value > best!) {
        best = value
        selected = complete
      }
      return
    }
    const { member, discs } = slots[depth]!
    for (const disc of discs) {
      if (stopped) return
      if (used.has(disc.id)) continue
      const memberCounts = counts[member]!
      memberCounts[disc.setId] = (memberCounts[disc.setId] ?? 0) + 1
      chosen[member]!.push(disc)
      if (
        canStillCompleteSetPattern(
          memberCounts,
          6 - chosen[member]!.length,
          domains[member]!.patterns,
        )
      ) {
        used.add(disc.id)
        visit(depth + 1)
        used.delete(disc.id)
      }
      chosen[member]!.pop()
      if (--memberCounts[disc.setId]! === 0) delete memberCounts[disc.setId]
    }
  }
  visit(0)
  evidence.status = foundFeasible ? 'feasible' : stopped ? 'budget_exhausted' : 'complete'
  if (evidence.status === 'complete' && selected.length !== 3) {
    const shortages = provenInventoryShortages(domains)
    if (shortages.length) evidence.shortages = shortages
  }
  return { selected, evidence }
}
