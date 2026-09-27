import type { DriveDisc, StatKey } from '../domain/schemas'
import type { SubStatHistory } from '../evaluation/subStatHistory'
import { evaluationRules } from '../evaluation/rules'
import { normalizedScore, weightFor, rollScale, realizedScore } from './discEnhancementScoring'
export type PotentialDimension = {
  id: string
  agentId: string | null
  weights: Partial<Record<StatKey, number>>
}

export type DimensionCeiling = {
  dimension: PotentialDimension
  realized: number
  optimistic: number
  knownNonTargetRolls: number
  realizedEffectiveRolls: number
  optimisticEffectiveRolls: number
}

export const legalSubStats = (
  Object.entries(evaluationRules.stats) as Array<[StatKey, (typeof evaluationRules.stats)[StatKey]]>
)
  .filter(([, rule]) => rule.subStat)
  .map(([stat]) => stat)
  .sort()

function bestStat(stats: StatKey[], weights: Partial<Record<StatKey, number>>): StatKey | null {
  return (
    [...stats].sort(
      (left, right) =>
        weightFor(weights, right) - weightFor(weights, left) || left.localeCompare(right),
    )[0] ?? null
  )
}

export function optimisticCeiling(
  disc: DriveDisc,
  history: Extract<SubStatHistory, { status: 'known' }>,
  dimension: PotentialDimension,
): DimensionCeiling | null {
  const legalForDisc = legalSubStats.filter((stat) => stat !== disc.mainStat)
  const rollWeights = Object.fromEntries(
    legalForDisc.map((stat) => [stat, weightFor(dimension.weights, stat) * rollScale(disc, stat)]),
  )
  const visibleStats = disc.subStats.map((subStat) => subStat.stat)
  let optimistic = realizedScore(disc, dimension.weights)
  const realizedEffectiveRolls = disc.subStats.reduce(
    (sum, subStat) =>
      sum + (weightFor(dimension.weights, subStat.stat) > 0 ? subStat.upgrades + 1 : 0),
    0,
  )
  let optimisticEffectiveRolls = realizedEffectiveRolls
  let hasEffectiveVisibleStat = disc.subStats.some(
    (subStat) => weightFor(dimension.weights, subStat.stat) > 0,
  )

  if (history.unlocksRemaining) {
    const unknownFourth = bestStat(
      legalForDisc.filter((stat) => !visibleStats.includes(stat)),
      rollWeights,
    )
    if (!unknownFourth) return null
    visibleStats.push(unknownFourth)
    optimistic += weightFor(dimension.weights, unknownFourth) * rollScale(disc, unknownFourth)
    if (weightFor(dimension.weights, unknownFourth) > 0) {
      optimisticEffectiveRolls += 1
      hasEffectiveVisibleStat = true
    }
  }

  const bestRemaining = bestStat(visibleStats, rollWeights)
  if (history.remainingRollOpportunities > 0 && !bestRemaining) return null
  if (bestRemaining) {
    optimistic +=
      history.remainingRollOpportunities *
      weightFor(dimension.weights, bestRemaining) *
      rollScale(disc, bestRemaining)
  }
  if (hasEffectiveVisibleStat) {
    optimisticEffectiveRolls += history.remainingRollOpportunities
  }

  const knownNonTargetRolls = disc.subStats.reduce(
    (sum, subStat) =>
      sum + (weightFor(dimension.weights, subStat.stat) <= 0 ? subStat.upgrades : 0),
    0,
  )

  return {
    dimension,
    realized: realizedScore(disc, dimension.weights),
    optimistic: normalizedScore(optimistic),
    knownNonTargetRolls,
    realizedEffectiveRolls,
    optimisticEffectiveRolls,
  }
}
