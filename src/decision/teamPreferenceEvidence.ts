import { resolveSourcePreferenceOrder } from './sourcePreferenceOrder'

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
  Array.isArray(ids) &&
  ids.length === 3 &&
  new Set(ids).size === 3 &&
  ids.every((id) => typeof id === 'string' && id.trim().length > 0 && id === id.trim())
const copyFact = (fact: TeamPreferenceFact): TeamPreferenceFact => ({
  ...fact,
  preferredMemberIds: [...fact.preferredMemberIds],
  alternativeMemberIds: [...fact.alternativeMemberIds],
})

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
  // Pin accepted evidence to construction time; callers cannot rewrite a source
  // relationship through either their original object or a returned view.
  const snapshot = eligible.map(copyFact)
  const edges = new Map<string, Set<string>>()
  for (const fact of snapshot) {
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
  const conflictingFacts = snapshot.filter((fact) =>
    reachable(keyOf(fact.alternativeMemberIds), keyOf(fact.preferredMemberIds)),
  )
  const conflicts = new Set(conflictingFacts)
  const acceptedFacts = snapshot.filter((fact) => !conflicts.has(fact))
  return {
    get acceptedFacts() {
      return acceptedFacts.map(copyFact)
    },
    get conflictingFacts() {
      return conflictingFacts.map(copyFact)
    },
    forTeam(memberIds: readonly string[]) {
      if (!exactThree(memberIds)) return []
      const key = keyOf(memberIds)
      return acceptedFacts
        .filter(
          (fact) =>
            keyOf(fact.preferredMemberIds) === key || keyOf(fact.alternativeMemberIds) === key,
        )
        .map(copyFact)
    },
    order<T>(items: readonly T[], members: (item: T) => readonly string[]): T[] {
      return resolveSourcePreferenceOrder(
        items,
        (item) => keyOf(members(item)),
        acceptedFacts.map(
          (fact) => [keyOf(fact.preferredMemberIds), keyOf(fact.alternativeMemberIds)] as const,
        ),
      ).ordered
    },
  }
}
