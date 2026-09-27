import { contentHash } from '../application/contentHash'
import type { DriveDisc } from '../domain/schemas'
import type { AccountDriveDisc } from '../accounts/types'

export function driveDiscFactIdentity(disc: DriveDisc) {
  return JSON.stringify({
    setId: disc.setId,
    slot: disc.slot,
    level: disc.level,
    rarity: disc.rarity ?? null,
    mainStat: disc.mainStat,
    subStats: disc.subStats
      .map(({ stat, value, upgrades }) => ({ stat, value, upgrades }))
      .toSorted((left, right) =>
        `${left.stat}:${left.value}:${left.upgrades}`.localeCompare(
          `${right.stat}:${right.value}:${right.upgrades}`,
        ),
      ),
  })
}

export function warehouseFactHash(discs: DriveDisc[]) {
  return contentHash(
    discs
      .map((disc) => ({
        id: disc.id,
        facts: driveDiscFactIdentity(disc),
        source: disc.importSource,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id)),
  )
}

export function reconcileAccountReplacementDiscs(
  incomingDiscs: DriveDisc[],
  existingDiscs: AccountDriveDisc[],
) {
  const availableExisting = new Map(existingDiscs.map((disc) => [disc.id, disc]))
  const existingBySourceIdentity = new Map<string, AccountDriveDisc[]>()
  for (const disc of existingDiscs) {
    const sourceIdentity = disc.importSource?.sourceId
    if (!sourceIdentity) continue
    const matches = existingBySourceIdentity.get(sourceIdentity) ?? []
    matches.push(disc)
    existingBySourceIdentity.set(sourceIdentity, matches)
  }
  const matchedExisting = new Map<number, AccountDriveDisc>()
  for (const [index, disc] of incomingDiscs.entries()) {
    const matches = existingBySourceIdentity.get(disc.importSource?.sourceId ?? '') ?? []
    if (matches.length !== 1 || !availableExisting.has(matches[0]!.id)) continue
    matchedExisting.set(index, matches[0]!)
    availableExisting.delete(matches[0]!.id)
  }

  const remainingIncomingByFact = new Map<string, number[]>()
  for (const [index, disc] of incomingDiscs.entries()) {
    if (matchedExisting.has(index)) continue
    const identity = driveDiscFactIdentity(disc)
    const matches = remainingIncomingByFact.get(identity) ?? []
    matches.push(index)
    remainingIncomingByFact.set(identity, matches)
  }
  const remainingExistingByFact = new Map<string, AccountDriveDisc[]>()
  for (const disc of availableExisting.values()) {
    const identity = driveDiscFactIdentity(disc)
    const matches = remainingExistingByFact.get(identity) ?? []
    matches.push(disc)
    remainingExistingByFact.set(identity, matches)
  }
  for (const [identity, incomingIndexes] of remainingIncomingByFact) {
    const existingMatches = remainingExistingByFact.get(identity) ?? []
    if (incomingIndexes.length !== existingMatches.length) continue
    const sortedIncomingIndexes = incomingIndexes.toSorted((left, right) =>
      incomingDiscs[left]!.id.localeCompare(incomingDiscs[right]!.id),
    )
    existingMatches.sort((left, right) => left.id.localeCompare(right.id))
    sortedIncomingIndexes.forEach((incomingIndex, matchIndex) => {
      matchedExisting.set(incomingIndex, existingMatches[matchIndex]!)
    })
  }

  return {
    preservedMetadata: matchedExisting.size,
    discs: incomingDiscs.map((disc, index) => {
      const existing = matchedExisting.get(index)
      return existing
        ? {
            ...disc,
            id: existing.id,
            locked: existing.locked,
            favorite: existing.favorite,
            tags: [...existing.tags],
            createdAt: existing.createdAt,
          }
        : disc
    }),
  }
}
