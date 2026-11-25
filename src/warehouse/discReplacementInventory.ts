import type { DriveDisc } from '../domain/schemas'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import { driveDiscData } from '../data/gameData'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { copyGroupKey } from './warehouseCopyDemandCounts'

export type DiscReplacementInventory = {
  hasDuplicateId: (id: string) => boolean
  candidatesFor: (target: DriveDisc) => readonly DriveDisc[]
}

/** Index the current capture once while preserving physical identity and comparison order. */
export function prepareDiscReplacementInventory(
  discs: readonly DriveDisc[],
): DiscReplacementInventory {
  const countsById = new Map<string, number>()
  for (const disc of discs) countsById.set(disc.id, (countsById.get(disc.id) ?? 0) + 1)

  const byClass = new Map<string, DriveDisc[]>()
  for (const disc of discs) {
    if (countsById.get(disc.id) !== 1) continue
    const key = copyGroupKey(disc)
    const existing = byClass.get(key)
    if (existing) existing.push(disc)
    else byClass.set(key, [disc])
  }
  for (const group of byClass.values()) group.sort((left, right) => left.id.localeCompare(right.id))

  return {
    hasDuplicateId: (id) => (countsById.get(id) ?? 0) > 1,
    candidatesFor: (target) => byClass.get(copyGroupKey(target)) ?? [],
  }
}

export function isSameReplacementClass(target: DriveDisc, candidate: DriveDisc) {
  if (
    candidate.id === target.id ||
    candidate.setId !== target.setId ||
    candidate.slot !== target.slot ||
    candidate.mainStat !== target.mainStat
  )
    return false
  const candidateHistory = deriveSubStatHistory(candidate)
  const maxLevel = driveDiscData?.rules.maxLevelByRarity[candidate.rarity ?? 'S']
  const targetMain = resolveDriveDiscMainStatValue(target)
  const candidateMain = resolveDriveDiscMainStatValue(candidate)
  return (
    candidateHistory.status === 'known' &&
    maxLevel !== undefined &&
    candidate.level <= maxLevel &&
    new Set(candidate.subStats.map((item) => item.stat)).size === candidate.subStats.length &&
    candidate.subStats.every(
      (item) =>
        Number.isFinite(item.value) &&
        item.value >= 0 &&
        Number.isInteger(item.upgrades) &&
        item.upgrades >= 0,
    ) &&
    targetMain !== null &&
    candidateMain !== null &&
    candidateMain.value >= targetMain.value
  )
}
