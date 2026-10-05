import { compareCandidateDiscFacts, type CandidateSearchDisc } from './candidateSearchFacts'
import { canStillCompleteSetPattern } from './optimizerSetPatterns'

type Loadout<D> = { agentId: string; discs: readonly { disc: D }[] }
type Domain<D> = {
  agentId: string
  slots: readonly (readonly D[])[]
  patterns?: Record<string, number>[]
}

function* roundRobin<T>(streams: Generator<T>[]): Generator<T> {
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

/** Visitation proposals, never safe-pruning bounds. Every move must be compiled. */
export function* teamSearchNeighborhood<D extends CandidateSearchDisc>(
  selected: readonly Loadout<D>[],
  domains: readonly Domain<D>[],
): Generator<D[][]> {
  const current = domains.map((domain) =>
    [...(selected.find((row) => row.agentId === domain.agentId)?.discs ?? [])]
      .map((row) => row.disc)
      .sort((a, b) => a.slot - b.slot),
  )
  if (current.some((row) => row.length !== 6)) return
  const used = new Set(current.flat().map((disc) => disc.id))
  if (used.size !== 18) return
  // Input member order is not a search feature. Keep output in domain order.
  const members = domains
    .map((domain, member) => ({ agentId: domain.agentId, member }))
    .sort((a, b) => a.agentId.localeCompare(b.agentId))
    .map(({ member }) => member)
  const copy = () => current.map((row) => [...row])
  const allows = (member: number, slot: number, disc: D) =>
    domains[member]!.slots[slot]!.some((allowed) => allowed.id === disc.id)
  function* swaps() {
    for (let first = 0; first < members.length; first++) {
      for (let second = first + 1; second < members.length; second++) {
        const left = members[first]!,
          right = members[second]!
        for (let slot = 0; slot < 6; slot++) {
          const a = current[left]![slot]!,
            b = current[right]![slot]!
          if (!allows(left, slot, b) || !allows(right, slot, a)) continue
          const proposal = copy()
          proposal[left]![slot] = b
          proposal[right]![slot] = a
          yield proposal
        }
      }
    }
  }
  const lanes = members.flatMap((member) =>
    domains[member]!.slots.map((slot, position) => ({
      member,
      position,
      discs: [
        ...new Map(
          slot.filter((disc) => !used.has(disc.id)).map((disc) => [disc.id, disc]),
        ).values(),
      ].sort(compareCandidateDiscFacts),
    })),
  )
  function* replacements() {
    const maximum = Math.max(0, ...lanes.map((lane) => lane.discs.length))
    for (let offset = 0; offset < maximum; offset++) {
      for (const lane of lanes) {
        const next = lane.discs[offset]
        if (!next) continue
        const proposal = copy()
        proposal[lane.member]![lane.position] = next
        yield proposal
      }
    }
  }
  function* setExchanges() {
    const pairs: Generator<D[][]>[] = []
    for (const member of members) {
      const changing = lanes
        .filter((lane) => lane.member === member)
        .map((lane) => ({
          ...lane,
          discs: lane.discs.filter((disc) => disc.setId !== current[member]![lane.position]!.setId),
        }))
      for (let first = 0; first < changing.length; first++) {
        for (let second = first + 1; second < changing.length; second++) {
          const a = changing[first]!,
            b = changing[second]!
          // Set legality depends on set identities, not on the Cartesian number
          // of physical copies. Reject illegal set pairs before visiting copies.
          pairs.push(
            (function* () {
              const groups = (discs: D[]) => {
                const result = new Map<string, D[]>()
                for (const disc of discs) {
                  const group = result.get(disc.setId) ?? []
                  group.push(disc)
                  result.set(disc.setId, group)
                }
                return result
              }
              for (const leftGroup of groups(a.discs).values()) {
                for (const rightGroup of groups(b.discs).values()) {
                  const example = [...current[member]!]
                  example[a.position] = leftGroup[0]!
                  example[b.position] = rightGroup[0]!
                  const counts: Record<string, number> = {}
                  for (const disc of example) counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
                  const patterns = domains[member]!.patterns
                  if (patterns && !canStillCompleteSetPattern(counts, 0, patterns)) continue
                  for (const left of leftGroup)
                    for (const right of rightGroup) {
                      const proposal = copy()
                      proposal[member]![a.position] = left
                      proposal[member]![b.position] = right
                      yield proposal
                    }
                }
              }
            })(),
          )
        }
      }
    }
    yield* roundRobin(pairs)
  }
  function* cycles() {
    if (members.length !== 3) return
    for (let slot = 0; slot < 6; slot++)
      for (const direction of [1, 2]) {
        const proposal = copy()
        if (
          !members.every((member, index) =>
            allows(member, slot, current[members[(index + direction) % 3]!]![slot]!),
          )
        )
          continue
        members.forEach((member, index) => {
          proposal[member]![slot] = current[members[(index + direction) % 3]!]![slot]!
        })
        yield proposal
      }
  }
  function* doubleSwaps() {
    for (let first = 0; first < members.length; first++) {
      for (let second = first + 1; second < members.length; second++) {
        const left = members[first]!,
          right = members[second]!
        for (let a = 0; a < 6; a++)
          for (let b = a + 1; b < 6; b++) {
            const la = current[left]![a]!,
              ra = current[right]![a]!
            const lb = current[left]![b]!,
              rb = current[right]![b]!
            if (
              la.setId === ra.setId ||
              la.setId !== rb.setId ||
              lb.setId !== ra.setId ||
              !allows(left, a, ra) ||
              !allows(right, a, la) ||
              !allows(left, b, rb) ||
              !allows(right, b, lb)
            )
              continue
            const proposal = copy()
            proposal[left]![a] = ra
            proposal[right]![a] = la
            proposal[left]![b] = rb
            proposal[right]![b] = lb
            yield proposal
          }
      }
    }
  }
  // Balance atomic move families; a large single-slot pool must not starve
  // the first legal set exchange or a three-owner cycle. Compile still decides.
  yield* roundRobin([swaps(), replacements(), setExchanges(), cycles(), doubleSwaps()])
}
