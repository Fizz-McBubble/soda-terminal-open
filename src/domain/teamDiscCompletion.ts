import type { DriveDisc } from './schemas'

type AssignedMember = { agentId: string; discIds: readonly string[] }

/** Count occupied slots in the selected trio, using only unambiguous physical S discs. */
export function teamDiscCompletion(
  memberIds: readonly string[],
  assignments: readonly AssignedMember[],
  inventory: readonly Pick<DriveDisc, 'id' | 'slot' | 'rarity'>[],
) {
  const byId = new Map<string, (typeof inventory)[number] | null>()
  for (const disc of inventory) byId.set(disc.id, byId.has(disc.id) ? null : disc)
  const uses = new Map<string, number>()
  for (const member of assignments)
    for (const id of member.discIds) uses.set(id, (uses.get(id) ?? 0) + 1)
  const counts = new Map<string, number>()
  let completeMemberCount = 0
  for (const agentId of new Set(memberIds)) {
    const matches = assignments.filter((member) => member.agentId === agentId)
    const ids = matches.length === 1 ? matches[0]!.discIds : []
    const slots = new Set<number>()
    for (const id of ids) {
      const disc = byId.get(id)
      if (
        id &&
        uses.get(id) === 1 &&
        disc?.rarity === 'S' &&
        Number.isInteger(disc.slot) &&
        disc.slot >= 1 &&
        disc.slot <= 6
      )
        slots.add(disc.slot)
    }
    counts.set(agentId, slots.size)
    if (ids.length === 6 && slots.size === 6) completeMemberCount++
  }
  return {
    counts,
    matchedSlots: [...counts.values()].reduce((sum, count) => sum + count, 0),
    completeMemberCount,
    complete:
      memberIds.length === 3 &&
      counts.size === 3 &&
      assignments.length === 3 &&
      completeMemberCount === 3,
  }
}
