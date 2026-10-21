import { stableContentHash } from '../gameDataPacks/types'
import type { CapacityEffect } from './teamStrengthSourceCapacityPolicy'

/** Fractions at different formula positions have different denominators. They
 * remain separate even when they share the same numerical value. No frequency,
 * original anomaly snapshot or flat damage is inferred from a buff envelope. */
export const teamAnomalyCapacityFeatureNames = [
  'source_support_anomaly_damage_bonus',
  'source_support_anomaly_buff_bonus',
  'source_support_anomaly_defense_ignore',
  'source_support_anomaly_resistance_ignore',
  'source_support_disorder_additive_bonus',
  'source_support_disorder_buff_bonus',
  'source_support_anomaly_motion_value_fraction',
  'source_support_abloom_original_anomaly_fraction',
  'source_support_anomaly_buildup_bonus',
  'source_support_anomaly_buildup_resistance_reduction',
] as const
export type TeamAnomalyCapacityCoordinates = Record<
  (typeof teamAnomalyCapacityFeatureNames)[number],
  number
>
export const teamAnomalyCapacityCoordinateIdentity = stableContentHash({
  version: 'source-receiver-and-damage-family-separated-capacities/v1',
  features: teamAnomalyCapacityFeatureNames,
  aggregation:
    'maximum-benefit-within-one-formula-position; buildup-resistance-benefit-is-negative-source-delta',
  exclusions:
    'self-effects; missing-receiver; nonbeneficial-signed-delta; unbound-base-or-flat-disorder',
  inference: 'no-shared-denominator-no-absolute-value-no-rotation-or-throughput',
})

export function projectTeamAnomalyCapacityCoordinates(effects: readonly CapacityEffect[]) {
  const coordinates = Object.fromEntries(
    teamAnomalyCapacityFeatureNames.map((name) => [name, 0]),
  ) as TeamAnomalyCapacityCoordinates
  const gaps: { effect: CapacityEffect; reason: string }[] = []
  for (const effect of effects) {
    if (
      effect.providerAgentId === effect.recipientAgentId ||
      !['anomaly', 'abloom'].includes(effect.channel)
    )
      continue
    const path = effect.receiverPath
    let name: (typeof teamAnomalyCapacityFeatureNames)[number] | undefined
    if (path && /\.anomBuildupRes_(?:\.|$)/.test(path))
      name = 'source_support_anomaly_buildup_resistance_reduction'
    else if (path && /\.anomBuildup_(?:\.|$)/.test(path))
      name = 'source_support_anomaly_buildup_bonus'
    else if (path && /\.addl_disorder_(?:\.|$)/.test(path))
      name = 'source_support_disorder_additive_bonus'
    else if (path && /\.anom_mv_mult_(?:\.|$)/.test(path))
      name =
        effect.channel === 'abloom'
          ? 'source_support_abloom_original_anomaly_fraction'
          : 'source_support_anomaly_motion_value_fraction'
    else if (path && /\.buff_(?:\.|$)/.test(path))
      name =
        effect.damageType === 'disorder'
          ? 'source_support_disorder_buff_bonus'
          : effect.damageType === 'anomaly'
            ? 'source_support_anomaly_buff_bonus'
            : undefined
    else if (path && /\.defIgn_(?:\.|$)/.test(path)) name = 'source_support_anomaly_defense_ignore'
    else if (path && /\.resIgn_(?:\.|$)/.test(path))
      name = 'source_support_anomaly_resistance_ignore'
    else if (path && /\.dmg_(?:\.|$)/.test(path) && effect.damageType === 'anomaly')
      name = 'source_support_anomaly_damage_bonus'
    const benefit =
      name === 'source_support_anomaly_buildup_resistance_reduction' ? -effect.value : effect.value
    if (!name || !Number.isFinite(benefit) || benefit < 0) {
      gaps.push({
        effect,
        reason: !name
          ? 'anomaly_capacity_requires_distinct_formula_or_event_context'
          : 'anomaly_capacity_nonfinite_or_signed_source_value',
      })
      continue
    }
    coordinates[name] = Math.max(coordinates[name], benefit)
  }
  return { coordinates, gaps }
}
