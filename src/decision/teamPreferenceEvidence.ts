export type TeamPreferenceFact = {
  claimId: string
  preferredMemberIds: readonly string[]
  alternativeMemberIds: readonly string[]
  sourceVersion: string
  sourceUrl: string
  checkedAt: string
  locator: string
  reason: string
  sourceSha256: string
  withdrawn?: boolean
}

const keyOf = (ids: readonly string[]) => [...ids].sort().join('|')
const exactThree = (ids: readonly string[]) =>
  ids.length === 3 && new Set(ids).size === 3 && ids.every((id) => id.trim().length > 0)

/** A guide's fixed-core substitution preference is not a global strength band.
 * Disputed cycles are excluded before a stable topological ordering is used. */
export function createTeamPreferenceIndex(
  facts: readonly TeamPreferenceFact[],
  currentVersion: string,
) {
  const eligible = facts.filter(
    (fact) =>
      !fact.withdrawn &&
      fact.sourceVersion === currentVersion &&
      exactThree(fact.preferredMemberIds) &&
      exactThree(fact.alternativeMemberIds) &&
      fact.preferredMemberIds.filter((id) => fact.alternativeMemberIds.includes(id)).length === 2 &&
      /^https?:\/\//.test(fact.sourceUrl) &&
      Number.isFinite(Date.parse(fact.checkedAt)) &&
      /^[a-f\d]{64}$/i.test(fact.sourceSha256) &&
      [fact.claimId, fact.locator, fact.reason].every((value) => value.trim().length > 0),
  )
  const edges = new Map<string, Set<string>>()
  for (const fact of eligible) {
    const key = keyOf(fact.preferredMemberIds)
    const next = edges.get(key) ?? new Set<string>()
    next.add(keyOf(fact.alternativeMemberIds))
    edges.set(key, next)
  }
  const reachable = (start: string, target: string) => {
    const pending = [start]
    const seen = new Set<string>()
    while (pending.length) {
      const node = pending.pop()!
      if (node === target) return true
      if (seen.has(node)) continue
      seen.add(node)
      pending.push(...(edges.get(node) ?? []))
    }
    return false
  }
  const conflictingFacts = eligible.filter((fact) =>
    reachable(keyOf(fact.alternativeMemberIds), keyOf(fact.preferredMemberIds)),
  )
  const conflicts = new Set(conflictingFacts)
  const acceptedFacts = eligible.filter((fact) => !conflicts.has(fact))
  return {
    acceptedFacts,
    conflictingFacts,
    forTeam(memberIds: readonly string[]) {
      if (!exactThree(memberIds)) return []
      const key = keyOf(memberIds)
      return acceptedFacts.filter(
        (fact) =>
          keyOf(fact.preferredMemberIds) === key || keyOf(fact.alternativeMemberIds) === key,
      )
    },
    order<T>(items: readonly T[], members: (item: T) => readonly string[]): T[] {
      const pending = [...items]
      const output: T[] = []
      const relations = acceptedFacts.map(
        (fact) => [keyOf(fact.preferredMemberIds), keyOf(fact.alternativeMemberIds)] as const,
      )
      // Only the supplied visible options participate. A missing preferred team
      // cannot hide or demote the available substitute; input order breaks ties.
      while (pending.length) {
        const keys = new Set(pending.map((item) => keyOf(members(item))))
        const index = pending.findIndex(
          (item) =>
            !relations.some(
              ([preferred, alternative]) =>
                alternative === keyOf(members(item)) && keys.has(preferred),
            ),
        )
        output.push(...pending.splice(index < 0 ? 0 : index, 1))
      }
      return output
    },
  }
}
