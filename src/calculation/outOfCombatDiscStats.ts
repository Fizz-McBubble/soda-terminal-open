import { driveDiscData } from '../data/gameData'
import type { DriveDisc, StatKey } from '../domain/schemas'

/** Source-rule disc growth and legal six-slot validation used by menu projections. */
export function resolveDriveDiscMainStatValue(
  disc: DriveDisc,
): { stat: StatKey; value: number } | null {
  const rarity = disc.rarity ?? 'S'
  const rule = driveDiscData?.rules.mainStatBaseByRarity[rarity].find(
    (item) => item.stat === disc.mainStat,
  )
  const maxLevel = driveDiscData?.rules.maxLevelByRarity[rarity]
  if (!rule || maxLevel === undefined) return null

  const raw = rule.baseValue * (1 + (3 * disc.level) / maxLevel)
  return { stat: disc.mainStat, value: rule.unit === 'flat' ? Math.round(raw) : raw }
}

export function hasLegalSixDriveDiscs(discs: readonly DriveDisc[]): boolean {
  const slots = discs.map((disc) => disc.slot)
  return (
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(slots).size === 6 &&
    [1, 2, 3, 4, 5, 6].every((slot) => slots.includes(slot as DriveDisc['slot'])) &&
    discs.every(
      (disc) =>
        (driveDiscData?.rules.mainStatsBySlot[String(disc.slot)] ?? []).includes(disc.mainStat) &&
        Number.isInteger(disc.level) &&
        disc.level >= 0 &&
        disc.level <= (driveDiscData?.rules.maxLevelByRarity[disc.rarity ?? 'S'] ?? -1),
    )
  )
}
