import type { DriveDisc } from '../domain/schemas'
import type { AccountLoadout } from './optimizeAccountBuilds'
import type { TeamSearchDomain } from './searchTeamAssignments'
import { compareCandidateDiscFacts } from './candidateSearchFacts'

/** Atomic multi-disc proposals; these are visitation seeds, never pruning rules. */
export function* teamDynamicNeighborhood<T extends AccountLoadout>(
  selected: readonly T[],
  domains: readonly TeamSearchDomain<T>[],
  visitHint?: (disc: DriveDisc, agentId: string) => number,
): Generator<DriveDisc[][]> {
  const current = domains.map((domain) =>
    selected
      .find((row) => row.agentId === domain.agentId)!
      .discs.map((row) => row.disc)
      .sort((a, b) => a.slot - b.slot),
  )
  const used = new Set(current.flat().map((disc) => disc.id))
  const copy = () => current.map((row) => [...row])
  function* memberProposals(member: number): Generator<DriveDisc[][]> {
    const domain = domains[member]!
    const available = domain.slots.map((slot) =>
      slot
        .filter((disc) => !used.has(disc.id))
        .sort(
          (a, b) =>
            (visitHint?.(b, domain.agentId) ?? 0) - (visitHint?.(a, domain.agentId) ?? 0) ||
            compareCandidateDiscFacts(a, b),
        ),
    )
    const sets = [...new Set(available.flat().map((disc) => disc.setId))].sort()
    const groups = available.map((slot) => {
      const first = new Map<string, DriveDisc>()
      for (const disc of slot) {
        const key = `${disc.setId}|${disc.mainStat}`
        if (!first.has(key)) first.set(key, disc)
      }
      return [...first.values()]
    })
    // Visit distinct main/set choices before repeated physical copies can
    // consume the bounded local budget. Copies are retained in the raw domain.
    for (let offset = 0; offset < Math.max(...groups.map((slot) => slot.length)); offset++)
      for (let slot = 0; slot < 6; slot++) {
        const disc = groups[slot]![offset]
        if (!disc) continue
        const proposal = copy()
        proposal[member]![slot] = disc
        yield proposal
      }
    const alternatives = [3, 4, 5].map((slot) => groups[slot]!)
    for (const a of alternatives[0]!)
      for (const b of alternatives[1]!)
        for (const c of alternatives[2]!) {
          const proposal = copy()
          proposal[member]![3] = a
          proposal[member]![4] = b
          proposal[member]![5] = c
          yield proposal
        }
    // Whole four-piece transitions include every choice of the two retained slots.
    // Scattered intermediate states need not be an improving path to the final set.
    for (const setId of sets)
      for (let keepA = 0; keepA < 6; keepA++)
        for (let keepB = keepA + 1; keepB < 6; keepB++) {
          const proposal = copy()
          let complete = true
          for (let slot = 0; slot < 6; slot++) {
            if (slot === keepA || slot === keepB) continue
            const disc =
              current[member]![slot]!.setId === setId
                ? current[member]![slot]
                : available[slot]!.find((row) => row.setId === setId)
            if (!disc) {
              complete = false
              break
            }
            proposal[member]![slot] = disc
          }
          if (complete) yield proposal
        }
    // Main-stat groups deliberately ignore source order and can change 4/5/6
    // together. Distinct records remain in the subsequent raw traversal.
  }
  let streams = domains.map((_, member) => memberProposals(member))
  while (streams.length) {
    const remaining: typeof streams = []
    for (const stream of streams) {
      const next = stream.next()
      if (!next.done) {
        yield next.value
        remaining.push(stream)
      }
    }
    streams = remaining
  }
}
