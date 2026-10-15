/**
 * Normalizes core skill level inputs.
 * Core skill starts at 1 before A; single letters A through F map to levels 2 through 7.
 * Numeric levels 1..7, numeric strings "1".."7", and null are preserved intact.
 * Already stored numeric level 6 must never be mutated to 7 without evidence.
 * Malformed or multi-character labels (e.g. 'G', 'Foo', 'AF', 'F6', ' F', 'F ', '') are not parsed by their first character.
 */
export function normalizeCoreSkillLevel(value: unknown): unknown {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return value
  if (/^[1-7]$/.test(value)) return Number(value)
  if (/^[A-F]$/i.test(value)) return value.toUpperCase().charCodeAt(0) - 63
  return value
}

/**
 * Parses official roster capture core skill levels.
 * Returns an integer level 1..7, or null if missing/malformed.
 * Does not read the first character of invalid names (e.g. 'Foo' -> null).
 */
export function parseOfficialCoreSkillLevel(value: unknown): number | null {
  const normalized = normalizeCoreSkillLevel(value)
  if (
    typeof normalized === 'number' &&
    Number.isInteger(normalized) &&
    normalized >= 1 &&
    normalized <= 7
  ) {
    return normalized
  }
  return null
}
