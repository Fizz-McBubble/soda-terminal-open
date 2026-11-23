import type { DriveDisc } from '../domain/schemas'

export const copyGroupKey = (disc: DriveDisc) => `${disc.setId}|${disc.slot}|${disc.mainStat}`

/** Counts are local to the captured input; saved plans remain independent contexts. */
export function buildWarehouseCopyDemandCounts(
  eligibleDiscs: readonly DriveDisc[],
  discsById: ReadonlyMap<string, DriveDisc>,
  protectedDemandContexts: readonly { discIds: readonly string[] }[],
) {
  const physicalCopiesByKey = new Map<string, number>()
  for (const disc of eligibleDiscs) {
    const key = copyGroupKey(disc)
    physicalCopiesByKey.set(key, (physicalCopiesByKey.get(key) ?? 0) + 1)
  }
  const protectedDemandByKey = new Map<string, number>()
  for (const context of protectedDemandContexts) {
    const counts = new Map<string, number>()
    for (const id of new Set(context.discIds)) {
      const disc = discsById.get(id)
      if (!disc || disc.rarity !== 'S') continue
      const key = copyGroupKey(disc)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    for (const [key, count] of counts)
      protectedDemandByKey.set(key, Math.max(protectedDemandByKey.get(key) ?? 0, count))
  }
  return { physicalCopiesByKey, protectedDemandByKey }
}
