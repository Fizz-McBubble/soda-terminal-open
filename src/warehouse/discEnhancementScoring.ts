import type { DriveDisc, StatKey } from '../domain/schemas'
import { driveDiscData } from '../data/gameData'

export function normalizedScore(value: number) {
  return Math.round(value * 100_000) / 100_000
}

export function weightFor(weights: Partial<Record<StatKey, number>>, stat: StatKey) {
  return weights[stat] ?? 0
}

export function rollScale(disc: DriveDisc, stat: StatKey) {
  const steps = driveDiscData?.rules.subStatStepsByRarity
  const base = steps?.[disc.rarity ?? 'S'].find((item) => item.stat === stat)?.baseValue
  const standard = steps?.S.find((item) => item.stat === stat)?.baseValue
  return base && standard ? base / standard : 0
}

export function realizedScore(
  disc: DriveDisc,
  weights: Partial<Record<StatKey, number>>,
  side: 'target' | 'alternative' = 'target',
) {
  return normalizedScore(
    disc.subStats.reduce((sum, subStat) => {
      const standard = driveDiscData?.rules.subStatStepsByRarity.S.find(
        (item) => item.stat === subStat.stat,
      )?.baseValue
      if (!standard) return sum
      const recorded = rollScale(disc, subStat.stat) * (subStat.upgrades + 1)
      const observed = subStat.value / standard
      // Conflicting numbers must never strengthen a cleanup claim: upper-bound
      // the retained target and lower-bound the proposed physical replacement.
      const rolls = side === 'target' ? Math.max(recorded, observed) : Math.min(recorded, observed)
      return sum + weightFor(weights, subStat.stat) * rolls
    }, 0),
  )
}

export function hasConsistentDevelopmentStats(disc: DriveDisc) {
  return disc.subStats.every((stat) => {
    const step = driveDiscData?.rules.subStatStepsByRarity[disc.rarity ?? 'S'].find(
      (item) => item.stat === stat.stat,
    )?.baseValue
    return (
      step !== undefined &&
      normalizedScore(stat.value) === normalizedScore(step * (stat.upgrades + 1))
    )
  })
}
