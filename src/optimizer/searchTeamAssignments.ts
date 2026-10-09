import type { DriveDisc } from '../domain/schemas'
import type { AccountLoadout } from './optimizeAccountBuilds'
import { canStillCompleteSetPattern } from './optimizerSetPatterns'
import { candidateDiscFactKey, compareCandidateDiscFacts } from './candidateSearchFacts'
import { teamSearchNeighborhood } from './teamSearchNeighborhood'
import { teamDynamicNeighborhood } from './teamDynamicNeighborhood'
import {
  preservesTeamPanelObjectives,
  type TeamAssignmentObjective,
} from './selectTeamObjectiveAssignment'

export type TeamSearchDomain<T extends AccountLoadout> = {
  agentId: string
  slots: DriveDisc[][]
  /** Undefined means game-legal scattered combinations, not a missing source pattern. */
  patterns?: Record<string, number>[]
  compile: (discs: DriveDisc[]) => T | null
}

export type TeamSearchEvidence = {
  status: 'complete' | 'feasible' | 'budget_exhausted' | 'unsupported'
  visitedNodes: number
  evaluatedAssignments: number
  /** Extra read-only marginal probes, separate from physical assignment evaluations. */
  hintProbeEvaluations?: number
  domain: 'profile_legal_discs' | 'game_legal_inventory'
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
    const setIds = new Set(members.flatMap((member) => member.patterns?.flatMap(Object.keys) ?? []))
    for (const setId of setIds) {
      const required = members.reduce(
        (total, member) =>
          total +
          (member.patterns?.length
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

/** Improve the incumbent with bounded legal exchanges, then visit the raw
 * domain. The objective alone accepts moves. No heuristic is used for pruning. */
export function searchTeamAssignments<T extends AccountLoadout>(
  baseline: T[],
  domains: TeamSearchDomain<T>[],
  objective?: TeamAssignmentObjective,
  budget = { evaluations: 64, nodes: 20000 },
  seeds?: readonly (readonly T[])[],
): { selected: T[]; evidence: TeamSearchEvidence } {
  const evidence: TeamSearchEvidence = {
    status: 'unsupported',
    visitedNodes: 0,
    evaluatedAssignments: 0,
    domain: objective?.domain ?? 'profile_legal_discs',
  }
  let selected = baseline
  if (domains.length !== 3 || new Set(domains.map((row) => row.agentId)).size !== 3)
    return { selected, evidence }
  if (
    !Number.isSafeInteger(budget.evaluations) ||
    budget.evaluations < 1 ||
    !Number.isSafeInteger(budget.nodes) ||
    budget.nodes < 1
  ) {
    evidence.status = 'budget_exhausted'
    return { selected, evidence }
  }
  const facts = new Map<string, string>()
  for (const domain of domains) {
    if (domain.slots.length !== 6) return { selected, evidence }
    for (let slot = 0; slot < 6; slot++) {
      for (const disc of domain.slots[slot]!) {
        if (disc.slot !== slot + 1) return { selected, evidence }
        const fact = candidateDiscFactKey(disc)
        if (facts.has(disc.id) && facts.get(disc.id) !== fact) return { selected, evidence }
        facts.set(disc.id, fact)
      }
    }
  }
  const key = (items: readonly AccountLoadout[]) =>
    JSON.stringify(
      items
        .map((item) => [item.agentId, item.discs.map((choice) => choice.disc.id).sort()])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    )
  const isLegalAssignment = (assignment: readonly AccountLoadout[]) =>
    assignment.length === 3 &&
    new Set(assignment.flatMap((row) => row.discs.map((item) => item.disc.id))).size === 18 &&
    domains.every((domain) => {
      const row = assignment.find((item) => item.agentId === domain.agentId)
      if (
        !row ||
        row.discs.length !== 6 ||
        new Set(row.discs.map((item) => item.disc.slot)).size !== 6
      )
        return false
      const counts: Record<string, number> = {}
      for (const { disc } of row.discs) {
        if (
          !domain.slots[disc.slot - 1]?.some(
            (allowed) =>
              allowed.id === disc.id &&
              candidateDiscFactKey(allowed) === candidateDiscFactKey(disc),
          )
        )
          return false
        counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
      }
      return !domain.patterns || canStillCompleteSetPattern(counts, 0, domain.patterns)
    })
  const fullBaseline = baseline.length === 3
  if (fullBaseline && !isLegalAssignment(baseline)) return { selected, evidence }
  let panelBaseline = baseline
  let best = fullBaseline ? objective?.evaluate(baseline) : null
  if (fullBaseline && objective) evidence.evaluatedAssignments++
  if (fullBaseline && (best == null || !Number.isFinite(best))) return { selected, evidence }
  const seen = new Set<string>(fullBaseline ? [key(baseline)] : [])
  const compiled = domains.map(() => new Map<string, T | null>())
  let stopped = false,
    foundFeasible = false
  const compile = (selection: DriveDisc[][]): T[] | null => {
    const result = domains.map((domain, member) => {
      const discs = selection[member]!
      if (discs.length !== 6 || new Set(discs.map((disc) => disc.slot)).size !== 6) return null
      const counts: Record<string, number> = {}
      for (const disc of discs) counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
      if (domain.patterns && !canStillCompleteSetPattern(counts, 0, domain.patterns)) return null
      const identity = JSON.stringify(discs.map((disc) => disc.id).sort())
      const cache = compiled[member]!
      if (!cache.has(identity))
        cache.set(identity, domain.compile([...discs].sort((a, b) => a.slot - b.slot)))
      return cache.get(identity)!
    })
    if (result.some((item) => !item)) return null
    const complete = result as T[]
    if (new Set(complete.flatMap((item) => item.discs.map((row) => row.disc.id))).size !== 18)
      return null
    return complete
  }
  const consider = (complete: T[]) => {
    if (selected.length === 3 && !preservesTeamPanelObjectives(complete, panelBaseline)) return
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
      selected = complete
      best = value
    }
  }
  for (const seed of seeds ?? []) {
    if (isLegalAssignment(seed)) consider([...seed])
  }
  const canRefine = fullBaseline || (selected.length === 3 && best != null && Number.isFinite(best))
  // Reserve a quarter of the original evaluation budget for non-local search.
  const localLimit = Math.max(1, Math.floor(budget.evaluations * 0.75))
  const localNodeLimit = Math.min(budget.nodes, Math.max(1, Math.floor(budget.nodes / 4)))
  if (canRefine && objective) {
    while (evidence.evaluatedAssignments < localLimit && evidence.visitedNodes < localNodeLimit) {
      const previous = key(selected)
      const local = teamSearchNeighborhood(selected, domains, objective.visitHint)
      const dynamic =
        objective.domain === 'game_legal_inventory'
          ? teamDynamicNeighborhood(selected, domains, objective.visitHint)
          : null
      function* proposals() {
        while (true) {
          const first = local.next(),
            second = dynamic?.next()
          if (!first.done) yield first.value
          if (second && !second.done) yield second.value
          if (first.done && (!second || second.done)) return
        }
      }
      for (const proposal of proposals()) {
        if (evidence.evaluatedAssignments >= localLimit || evidence.visitedNodes >= localNodeLimit)
          break
        evidence.visitedNodes++
        const complete = compile(proposal)
        if (complete) consider(complete)
        if (stopped) break
      }
      if (stopped || key(selected) === previous) break
    }
  }
  const chosen: DriveDisc[][] = domains.map(() => [])
  const counts: Record<string, number>[] = domains.map(() => ({}))
  const used = new Set<string>()
  const incumbentByAgent = new Map(
    selected.map((row) => [row.agentId, new Set(row.discs.map((item) => item.disc.id))]),
  )
  const slots = domains
    .flatMap((domain, member) =>
      domain.slots.map((discs, slot) => ({
        member,
        slot,
        discs: [...new Map(discs.map((disc) => [disc.id, disc])).values()].sort(
          (a, b) =>
            Number(incumbentByAgent.get(domain.agentId)?.has(b.id) ?? false) -
              Number(incumbentByAgent.get(domain.agentId)?.has(a.id) ?? false) ||
            (objective?.visitHint?.(b, domain.agentId) ?? 0) -
              (objective?.visitHint?.(a, domain.agentId) ?? 0) ||
            compareCandidateDiscFacts(a, b),
        ),
      })),
    )
    .sort(
      (a, b) =>
        a.discs.length - b.discs.length ||
        domains[a.member]!.agentId.localeCompare(domains[b.member]!.agentId) ||
        a.slot - b.slot,
    )
  function visit(depth: number) {
    if (stopped) return
    if (evidence.visitedNodes >= budget.nodes) {
      stopped = true
      return
    }
    evidence.visitedNodes++
    if (depth === slots.length) {
      const complete = compile(chosen)
      if (complete) consider(complete)
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
        !domains[member]!.patterns ||
        canStillCompleteSetPattern(
          memberCounts,
          6 - chosen[member]!.length,
          domains[member]!.patterns!,
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
  if (objective?.hintProbeEvaluations)
    evidence.hintProbeEvaluations = objective.hintProbeEvaluations()
  evidence.status = foundFeasible ? 'feasible' : stopped ? 'budget_exhausted' : 'complete'
  if (evidence.status === 'complete' && selected.length !== 3) {
    const shortages = provenInventoryShortages(domains)
    if (shortages.length) evidence.shortages = shortages
  }
  return { selected, evidence }
}
