/**
 * MIT-derived W-Engine level multiplier table and growth formulas.
 * Upstream source: libs/zzz/stats/src/wengine.ts
 * Pinned upstream commit: 3456cd0f6f5bea10e168074502460dac2fcd6df4
 *
 * In upstream Genshin Optimizer / ZZZ stats, getWengineStats() evaluates:
 *   [base_statkey]: base_statvalue * (1 + atk_multiplier[level] / 10000 + 0.8922 * ascension)
 *   [second_statkey]: second_statvalue * (1 + 0.3 * ascension)
 *
 * Upstream atk_multiplier table has 61 entries (index 0 to 60).
 * Notice: atk_multiplier[0] = 0, but valid levels are 1..60.
 * At level 1, atk_multiplier[1] = 1568 (0.1568).
 * Upstream applies the exact same level multiplier table (atk_multiplier) and ascension factor
 * (0.8922) to both 'atk' and 'def' base stats.
 */

export const UPSTREAM_WENGINE_LEVEL_MULTIPLIER = [
  0, 1568, 3136, 4705, 6273, 7841, 9409, 10977, 12545, 14114, 15682, 17250, 18818, 20386, 21954,
  23523, 25091, 26659, 28227, 29795, 31363, 32932, 34500, 36068, 37636, 39204, 40772, 42341, 43909,
  45477, 47045, 48613, 50181, 51750, 53318, 54886, 56454, 58022, 59590, 61159, 62727, 64295, 65863,
  67431, 68999, 70568, 72136, 73704, 75272, 76840, 78408, 79977, 81545, 83113, 84681, 86249, 87817,
  89386, 90954, 92522, 94090,
] as const

export const UPSTREAM_ASCENSION_BASE_FACTOR = 0.8922
export const UPSTREAM_ASCENSION_SECONDARY_FACTOR = 0.3

export type WEngineBaseStatKey = 'atk' | 'def'

export type TypedWEngineBaseStat = {
  key: WEngineBaseStatKey
  value: number
}

export function defaultAscensionForLevel(level: number): number {
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 60) {
    throw new Error(`Invalid level for ascension derivation: ${level}`)
  }
  return Math.min(5, Math.floor(level / 10))
}

export function calculateWEngineBaseStat(
  baseValue: number,
  level: number,
  ascension?: number,
): number {
  // Historical integer projection remains readable. Formula consumers use the
  // exact helper; a display projection is not the upstream arithmetic result.
  return Math.floor(calculateWEngineBaseStatExact(baseValue, level, ascension))
}

export function calculateWEngineBaseStatExact(
  baseValue: number,
  level: number,
  ascension?: number,
): number {
  if (typeof baseValue !== 'number' || !Number.isFinite(baseValue) || baseValue <= 0) {
    throw new Error(`Invalid baseValue: ${baseValue}; must be finite positive number`)
  }
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 60) {
    throw new Error(`Invalid level: ${level}; must be an integer between 1 and 60`)
  }

  let actualAscension: number
  if (ascension === undefined) {
    actualAscension = defaultAscensionForLevel(level)
  } else {
    if (
      typeof ascension !== 'number' ||
      !Number.isInteger(ascension) ||
      ascension < 0 ||
      ascension > 5
    ) {
      throw new Error(`Invalid ascension: ${ascension}; must be an integer between 0 and 5`)
    }
    actualAscension = ascension
  }

  const multiplier = UPSTREAM_WENGINE_LEVEL_MULTIPLIER[level] / 10000
  return baseValue * (1 + multiplier + UPSTREAM_ASCENSION_BASE_FACTOR * actualAscension)
}

export function calculateWEngineSecondaryStat(
  secondaryBaseValue: number,
  level: number,
  ascension?: number,
): number {
  if (
    typeof secondaryBaseValue !== 'number' ||
    !Number.isFinite(secondaryBaseValue) ||
    secondaryBaseValue <= 0
  ) {
    throw new Error(
      `Invalid secondaryBaseValue: ${secondaryBaseValue}; must be finite positive number`,
    )
  }
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 60) {
    throw new Error(`Invalid level: ${level}; must be an integer between 1 and 60`)
  }

  let actualAscension: number
  if (ascension === undefined) {
    actualAscension = defaultAscensionForLevel(level)
  } else {
    if (
      typeof ascension !== 'number' ||
      !Number.isInteger(ascension) ||
      ascension < 0 ||
      ascension > 5
    ) {
      throw new Error(`Invalid ascension: ${ascension}; must be an integer between 0 and 5`)
    }
    actualAscension = ascension
  }

  return secondaryBaseValue * (1 + UPSTREAM_ASCENSION_SECONDARY_FACTOR * actualAscension)
}

export function evaluateWEngineProgression(input: {
  baseStat: TypedWEngineBaseStat
  secondaryStatKey: string
  secondaryStatBaseValue: number
  level: number
  ascension?: number
}) {
  const baseStatValue = calculateWEngineBaseStat(input.baseStat.value, input.level, input.ascension)
  const secondaryValue = calculateWEngineSecondaryStat(
    input.secondaryStatBaseValue,
    input.level,
    input.ascension,
  )
  return {
    baseStat: {
      key: input.baseStat.key,
      value: baseStatValue,
    },
    secondaryStat: {
      key: input.secondaryStatKey,
      value: secondaryValue,
    },
  }
}
