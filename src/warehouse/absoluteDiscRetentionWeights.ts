import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { driveDiscData } from '../data/gameData'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { Profile } from './absoluteDiscRetentionContract'
import type { RetentionUseFacts } from './absoluteDiscRetentionUseFacts'

export const retentionWeightPolicyId = 'retention-goal-roll-quality-r1'
/** Calibrated roll-quality proxies. These are not damage ratios or exact marginal DPS. */
export const retentionWeightParameters = Object.freeze({ scaling: 0.75, secondaryPen: 0.3 })

export function resolveRetentionQualityWeights(
  constraint: CandidateWarehouseConstraint,
  agentId: string,
  facts: RetentionUseFacts,
) {
  // Guide parsing supplies directions only. Its array order / prose ranking never supplies numbers here.
  const directions = new Set(
    Object.entries(constraint.subStatWeights)
      .filter(([, value]) => (value ?? 0) > 0)
      .map(([stat]) => stat),
  )
  const mechanic = getCurrentAgentEventContract(agentId)
  const standard = driveDiscData?.rules.subStatStepsByRarity.S ?? []
  const step = (stat: string) => standard.find((entry) => entry.stat === stat)?.baseValue ?? 0
  const weights: Record<string, number> = {}
  // Core lines are the objective's quality inputs, not the stat granted by core-skill promotion.
  const coreStats = new Set<string>()
  const isCrit = facts.goal === 'crit_damage'
  const isAnomaly = facts.goal === 'anomaly_damage'
  const isFunction = facts.goal === 'functional'
  const fourthSlot = constraint.mainStats['4'] ?? []
  if (isCrit)
    for (const stat of ['crit_rate', 'crit_dmg'])
      if (
        directions.has(stat) ||
        fourthSlot.some((main) => main === 'crit_rate' || main === 'crit_dmg')
      ) {
        weights[stat] = 1
        coreStats.add(stat)
      }
  if (
    isAnomaly &&
    (directions.has('anomaly_proficiency') || fourthSlot.includes('anomaly_proficiency'))
  ) {
    weights.anomaly_proficiency = 1
    coreStats.add('anomaly_proficiency')
  }
  for (const kind of ['atk', 'hp', 'def'] as const) {
    const percent = `${kind}_percent`
    const flat = `${kind}_flat`
    if (!facts.scalingStats.includes(percent)) continue
    const scaleWeight = isFunction ? 1 : retentionWeightParameters.scaling
    weights[percent] = scaleWeight
    if (mechanic) {
      const base = mechanic.baseStats[`${kind}_base`] + mechanic.baseStats[`${kind}_growth`] * 59
      // Convert an S flat roll and an S percentage roll against a fixed source-bound level60 base.
      // The reference has no account equipment/ownership or inventory-relative normalization.
      const percentRoll = (base * step(percent)) / 100
      if (percentRoll > 0)
        weights[flat] = Math.min(
          1,
          Math.round(((scaleWeight * step(flat)) / percentRoll) * 1e6) / 1e6,
        )
    }
    if (isFunction || isAnomaly) {
      coreStats.add(percent)
      coreStats.add(flat)
    }
  }
  if (
    directions.has('pen') &&
    facts.effects.pen_?.state !== 'incompatible' &&
    facts.goal !== 'functional'
  )
    weights.pen = retentionWeightParameters.secondaryPen
  if (isCrit && directions.has('anomaly_proficiency')) weights.anomaly_proficiency = 0.5 // A sourced secondary direction, never a union of two primary goals.
  if (isFunction && directions.has('anomaly_proficiency')) {
    weights.anomaly_proficiency = 1
    coreStats.add('anomaly_proficiency')
  }
  const known =
    facts.goal !== 'unknown' &&
    Object.values(weights).some((value) => value > 0) &&
    coreStats.size > 0
  const sourceIds = [
    ...facts.sourceIds,
    ...(mechanic
      ? [`${mechanic.source.repository}:${mechanic.source.commit}:${mechanic.source.statsSha256}`]
      : []),
  ]
  return {
    weights: known ? weights : Object.fromEntries([...directions].map((stat) => [stat, 1])),
    coreStats: [...coreStats].filter((stat) => (weights[stat] ?? 0) >= 0.5),
    weightEvidence: {
      id: retentionWeightPolicyId,
      method: known ? 'goal_bound_standard_roll_quality_proxy' : 'uncalibrated_direction_only',
      sourceIds,
    } satisfies NonNullable<Profile['weightEvidence']>,
  }
}
