import type { TeamStrengthSupportContactEvidence } from './teamStrengthSupportContributionFeatures'
import type { TeamStrengthSourceCapacity } from './teamStrengthSourceCapacity'

/** Source facts and structural capacities, never a team label, agent tier, or DPS. */
export const teamStrengthMechanicFeatureNames = [
  'direct_action_scale',
  'anomaly_action_buildup',
  'rupture_action_multiplier',
  'stun_action_scale',
  'background_action_scale',
  'field_time_demand',
  'field_time_excess',
  'output_role_count',
  'background_output_count',
  'inactive_additional_ability_fraction',
  'unmet_resource_fraction',
  'different_attribute_anomaly_pair',
  'compatible_damage_capability',
  'compatible_attack_capability',
  'compatible_critical_capability',
  'compatible_defense_reduction_capability',
  'compatible_resistance_reduction_capability',
  'compatible_anomaly_capability',
  'compatible_sheer_force_capability',
  'compatible_stun_capability',
  'second_direct_action_scale',
  'second_stun_action_scale',
  'second_background_action_scale',
  'second_anomaly_action_buildup',
  'compatible_multi_provider_capacity',
  'sharp_action_scale',
  'laceration_action_multiplier',
  'compatible_sharp_capability',
  'compatible_laceration_capability',
  'reference_potential_damage_bonus',
  'reference_potential_attack_percent',
  'reference_potential_crit_damage',
  'reference_potential_penetration_ratio',
  'reference_potential_resistance_ignore',
  'source_self_damage_capacity',
  'source_self_attack_capacity',
  'source_self_critical_capacity',
  'source_self_anomaly_critical_capacity',
  'source_self_sheer_capacity',
  'source_self_sharp_capacity',
  'source_self_laceration_capacity',
  'compatible_anomaly_critical_capability',
  'source_self_anomaly_proficiency_capacity',
  'source_self_anomaly_mastery_capacity',
  'source_self_anomaly_accumulation_capacity',
  'compatible_aftershock_damage_capability',
  'compatible_aftershock_critical_capability',
  'compatible_aftershock_defense_reduction_capability',
  'source_self_aftershock_damage_capacity',
  'source_self_aftershock_daze_capacity',
  'compatible_anomaly_proficiency_capability',
  'compatible_anomaly_mastery_capability',
  'source_comparable_action_capacity',
  'source_secondary_action_capacity',
  'source_support_primary_contact_gain',
  'source_support_secondary_contact_gain',
  'source_support_anomaly_proficiency_gain',
  'source_support_anomaly_mastery_gain',
  'source_support_stun_capacity',
  'source_support_anomaly_damage_capacity',
  'source_support_anomaly_buildup_capacity',
] as const
export type TeamStrengthMechanicFeatureName = (typeof teamStrengthMechanicFeatureNames)[number]
// Ceteris paribus, more usable damage/support capacity cannot lower strength,
// and a proven lost activation/resource or budget overrun cannot improve it.
// Counts and total field demand remain unconstrained: they encode tradeoffs.
export const teamStrengthCoefficientDirections = teamStrengthMechanicFeatureNames.map((name) =>
  ['field_time_excess', 'inactive_additional_ability_fraction', 'unmet_resource_fraction'].includes(
    name,
  )
    ? -1
    : /^(?:compatible_|reference_potential_|source_self_|source_support_|source_comparable_|source_secondary_)/.test(
          name,
        ) || /(?:action_scale|action_buildup|action_multiplier)$/.test(name)
      ? 1
      : 0,
)
export type TeamStrengthMechanicFeatures = {
  backgroundActionEvidence?: ReturnType<
    typeof import('./teamStrengthBackgroundActions').teamStrengthBackgroundAction
  >[]
  sourceCapacityEvidence?: TeamStrengthSourceCapacity
  supportContributionEvidence?: TeamStrengthSupportContactEvidence
  featureNames: typeof teamStrengthMechanicFeatureNames
  values: number[]
  playstyleCapacities: {
    secondDirectAction: number
    secondStunAction: number
    secondBackgroundAction: number
    secondAnomalyBuildup: number
    multiProvider: number
  }
  dataFingerprint: string
  eligibility: { eligible: boolean; reasons: string[] }
  reliability: 'supported' | 'partial'
  supportEvidence: {
    unverifiedProviderIds: string[]
    reviewedProviderIds: string[]
    deferredProviderIds: string[]
    sourceConflictProviderIds: string[]
    sharpCoverage: number
    lacerationCoverage: number
    attributeConditionalRecipientIds: string[]
  }
  /** Validation grouping only. Neither identity field enters values. */
  primaryOutputAgentId: string | null
  coreGroup: string
  guardrails: {
    noPrimaryOutput: boolean
    severeFieldCompetition: boolean
    inactiveAdditionalAbility: boolean
    openResourceLoop: boolean
  }
  limitations: string[]
}
