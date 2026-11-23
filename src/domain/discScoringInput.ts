import type { DriveDisc, DriveDiscDataManifest, StatKey } from './schemas'

type DiscRules = DriveDiscDataManifest['rules']

export type ScoringDiscRecordIssue =
  | 'rarity_not_confirmed_s'
  | 'rules_unavailable'
  | 'invalid_identity_or_main'
  | 'invalid_substat_lines'
  | 'inconsistent_substat_record'
  | 'inconsistent_enhancement_history'

/** The existing S-import tolerance is in displayed stat units, not roll ratios. */
export function matchesSSubStatValue(
  stat: StatKey,
  value: number,
  upgrades: number,
  rules: DiscRules,
): boolean {
  const step = rules.subStatStepsByRarity.S.find((item) => item.stat === stat)?.baseValue
  return (
    step !== undefined &&
    Number.isFinite(step) &&
    step > 0 &&
    Number.isFinite(value) &&
    Number.isInteger(upgrades) &&
    upgrades >= 0 &&
    Math.abs(step * (upgrades + 1) - value) <= 0.051
  )
}

/** Qualifies a recorded entity for S-disc scoring; never mutates the record. */
export function scoringDiscRecordIssue(
  disc: DriveDisc,
  rules: DiscRules | null | undefined,
): ScoringDiscRecordIssue | null {
  if (disc.rarity !== 'S') return 'rarity_not_confirmed_s'
  if (!rules?.subStatStepsByRarity?.S || !rules.mainStatsBySlot || !rules.maxLevelByRarity)
    return 'rules_unavailable'
  const maxLevel = rules.maxLevelByRarity.S
  if (
    !disc.id?.trim() ||
    !disc.setId?.trim() ||
    !Number.isInteger(disc.slot) ||
    disc.slot < 1 ||
    disc.slot > 6 ||
    !Number.isInteger(disc.level) ||
    !Number.isInteger(maxLevel) ||
    disc.level < 0 ||
    disc.level > maxLevel ||
    !rules.mainStatsBySlot[String(disc.slot)]?.includes(disc.mainStat)
  )
    return 'invalid_identity_or_main'

  const lines = disc.subStats
  if (
    !Array.isArray(lines) ||
    lines.length < 3 ||
    lines.length > 4 ||
    lines.some((line) => !line || line.stat === disc.mainStat) ||
    new Set(lines.map((line) => line.stat)).size !== lines.length
  )
    return 'invalid_substat_lines'
  if (lines.some((line) => !matchesSSubStatValue(line.stat, line.value, line.upgrades, rules)))
    return 'inconsistent_substat_record'

  // An S disc begins with 3 or 4 lines and gains one line or roll every 3 levels.
  const spent = Math.floor(disc.level / 3)
  const upgrades = lines.reduce((sum, line) => sum + line.upgrades, 0)
  const initialLines = lines.length + upgrades - spent
  if (![3, 4].includes(initialLines) || lines.length !== Math.min(4, initialLines + spent))
    return 'inconsistent_enhancement_history'
  return null
}

/** Selection identity only: record legality is assessed separately above. */
export function completeScoringDiscSelection(discs: readonly DriveDisc[]): boolean {
  return (
    discs.length === 6 &&
    discs.every((disc) => Boolean(disc?.id?.trim()) && Number.isInteger(disc.slot)) &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    [1, 2, 3, 4, 5, 6].every((slot) => discs.some((disc) => disc.slot === slot))
  )
}
