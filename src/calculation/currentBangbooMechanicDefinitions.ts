import { currentBangbooAgentCompositionKey } from './currentBangbooCompositionIdentity'

type CompositionRequirement = { key: string; minimum: number }
export type AdditionalEffectSpec = {
  operator:
    | 'damage_multiplier'
    | 'daze_multiplier'
    | 'anomaly_buildup_multiplier'
    | 'hp_recovery_multiplier'
    | 'shield_generation_multiplier'
    | 'energy_multiplier'
    | 'energy_flat'
    | 'energy_regen_flat'
    | 'shield_percent_bangboo_hp'
    | 'attack_flat_formula'
    | 'hp_restore_percent_target_hp'
    | 'duration_delta'
    | 'charge_delta'
    | 'cooldown_delta'
    | 'extra_hits'
    | 'summon_count'
    | 'guarantee'
  targetAction: string
  valueIndices?: number[]
  constantValues?: number[]
  requiresFlag?: string
  chance?: number
  maximum?: number
  intervalSeconds?: number
  accumulatorKey?: string
}

export type AdditionalContractDefinition = {
  allOf?: CompositionRequirement[]
  anyOf?: CompositionRequirement[]
  agentPresent?: string
  conditionMinimumIndex?: number
  effects: AdditionalEffectSpec[]
}

const effect = (
  operator: AdditionalEffectSpec['operator'],
  targetAction: string,
  valueIndices: number[] = [0],
  extra: Omit<AdditionalEffectSpec, 'operator' | 'targetAction' | 'valueIndices'> = {},
): AdditionalEffectSpec => ({ operator, targetAction, valueIndices, ...extra })

const chainAnomaly = (key: string, minimum: number): AdditionalContractDefinition => ({
  allOf: [{ key, minimum }],
  effects: [effect('anomaly_buildup_multiplier', 'chain')],
})
const chainDamage = (key: string, minimum = 1): AdditionalContractDefinition => ({
  allOf: [{ key, minimum }],
  effects: [effect('damage_multiplier', 'chain')],
})

export const definitionsByGameId: Record<string, AdditionalContractDefinition> = {
  '53001': chainAnomaly('attribute:ice', 2),
  '53002': {
    allOf: [{ key: 'attribute:physical', minimum: 2 }],
    effects: [
      effect('anomaly_buildup_multiplier', 'active', [0]),
      effect('duration_delta', 'active:continuous_strikes', [1]),
    ],
  },
  '53003': {
    allOf: [{ key: 'specialty:support', minimum: 1 }],
    effects: [
      effect('hp_recovery_multiplier', 'active:buff_1', [0]),
      effect('shield_generation_multiplier', 'active:buff_2', [1]),
      effect('energy_regen_flat', 'active:buff_3', [2]),
    ],
  },
  '53004': {
    allOf: [{ key: 'specialty:stun', minimum: 1 }],
    effects: [effect('daze_multiplier', 'active', [0], { requiresFlag: 'enemy_daze_above_50' })],
  },
  '53005': {
    allOf: [{ key: 'specialty:defense', minimum: 1 }],
    effects: [
      effect('shield_percent_bangboo_hp', 'chain:enemy_hit_tiers', [0, 1, 2]),
      effect('duration_delta', 'chain:shield', [3]),
    ],
  },
  '53006': chainDamage('specialty:attack'),
  '53007': chainAnomaly('attribute:fire', 2),
  '53008': {
    allOf: [{ key: 'specialty:support', minimum: 1 }],
    effects: [
      effect('hp_recovery_multiplier', 'active', [0]),
      effect('charge_delta', 'active', [1]),
    ],
  },
  '53009': chainDamage('attack_type:pierce'),
  '53010': chainAnomaly('attribute:electric', 2),
  '53011': {
    allOf: [{ key: 'specialty:anomaly', minimum: 1 }],
    effects: [
      effect('guarantee', 'active:increased_range', [], { constantValues: [1] }),
      effect('damage_multiplier', 'active', [0]),
    ],
  },
  '53012': {
    allOf: [{ key: 'specialty:support', minimum: 1 }],
    effects: [effect('energy_multiplier', 'active:off_field_agents', [0])],
  },
  '53013': {
    allOf: [{ key: 'specialty:anomaly', minimum: 1 }],
    effects: [
      effect('damage_multiplier', 'chain', [0]),
      effect('damage_multiplier', 'chain', [1], { requiresFlag: 'enemy_organic' }),
    ],
  },
  '53014': {
    anyOf: [
      { key: 'specialty:attack', minimum: 1 },
      { key: 'specialty:anomaly', minimum: 1 },
    ],
    effects: [
      effect('damage_multiplier', 'active', [0, 1], {
        accumulatorKey: 'active_skill_activations',
      }),
    ],
  },
  '53015': {
    anyOf: [
      { key: 'specialty:attack', minimum: 1 },
      { key: 'specialty:anomaly', minimum: 1 },
    ],
    effects: [effect('damage_multiplier', 'active:first_dive', [0])],
  },
  '53016': {
    allOf: [{ key: 'specialty:rupture', minimum: 1 }],
    effects: [
      effect('guarantee', 'active:sword_draw', [], { constantValues: [1] }),
      effect('damage_multiplier', 'active', [0]),
    ],
  },
  '53017': {
    allOf: [{ key: 'specialty:support', minimum: 1 }],
    effects: [
      effect('attack_flat_formula', 'team:knights_stars', [0]),
      effect('duration_delta', 'team:knights_stars', [1]),
    ],
  },
  '53019': {
    allOf: [{ key: 'specialty:support', minimum: 1 }],
    effects: [
      effect('summon_count', 'active:block_spikes', [], { constantValues: [7] }),
      effect('damage_multiplier', 'active', [0]),
    ],
  },
  '53021': {
    anyOf: [
      { key: 'specialty:attack', minimum: 1 },
      { key: 'specialty:anomaly', minimum: 1 },
    ],
    effects: [effect('damage_multiplier', 'active', [0], { chance: 0.6 })],
  },
  '54001': chainAnomaly('attribute:ice', 2),
  '54002': {
    allOf: [{ key: 'faction:belobog_heavy_industries', minimum: 2 }],
    effects: [
      effect('damage_multiplier', 'chain', [0]),
      effect('damage_multiplier', 'chain', [1], { requiresFlag: 'enemy_burning_or_shocked' }),
    ],
  },
  '54003': {
    allOf: [{ key: 'attribute:ether', minimum: 2 }],
    effects: [
      effect('anomaly_buildup_multiplier', 'chain', [0]),
      effect('duration_delta', 'chain:coordination', [1]),
      effect('extra_hits', 'chain:coordination', [2]),
    ],
  },
  '54004': {
    allOf: [{ key: 'faction:victoria_housekeeping', minimum: 2 }],
    effects: [effect('energy_multiplier', 'active', [0])],
  },
  '54005': {
    allOf: [{ key: 'faction:cunning_hares', minimum: 2 }],
    effects: [effect('damage_multiplier', 'chain:enemy_count_tiers', [0, 1, 2])],
  },
  '54006': chainAnomaly('attribute:fire', 2),
  '54008': chainAnomaly('attribute:electric', 2),
  '54009': chainAnomaly('attribute:ether', 2),
  '54010': {
    allOf: [{ key: 'faction:angels_of_delusion', minimum: 1 }],
    conditionMinimumIndex: 0,
    effects: [
      effect('attack_flat_formula', 'team:active', [1]),
      effect('duration_delta', 'team:active', [], { constantValues: [30] }),
      effect('anomaly_buildup_multiplier', 'chain', [2]),
    ],
  },
  '54011': {
    allOf: [{ key: 'faction:sons_of_calydon', minimum: 2 }],
    effects: [
      effect('damage_multiplier', 'active', [0]),
      effect('cooldown_delta', 'active', [1], { requiresFlag: 'marked_enemy_defeated' }),
    ],
  },
  '54012': {
    allOf: [{ key: 'faction:new_eridu_public_security', minimum: 2 }],
    effects: [
      effect('extra_hits', 'active:bite', [], { constantValues: [1], chance: 0.5, maximum: 3 }),
      effect('damage_multiplier', 'chain', [0]),
    ],
  },
  '54013': chainAnomaly('attribute:physical', 2),
  '54014': {
    allOf: [{ key: 'faction:hollow_special_operations_6', minimum: 2 }],
    effects: [
      effect('damage_multiplier', 'active_and_chain', [0], { requiresFlag: 'enemy_shocked' }),
      effect('anomaly_buildup_multiplier', 'active_and_chain', [1], {
        requiresFlag: 'enemy_other_attribute_anomaly',
      }),
    ],
  },
  '54015': {
    allOf: [{ key: 'faction:stars_of_lyra', minimum: 2 }],
    effects: [effect('hp_restore_percent_target_hp', 'team:superstar_applied', [0])],
  },
  '54016': {
    allOf: [{ key: 'faction:mockingbird', minimum: 1 }],
    effects: [
      effect('damage_multiplier', 'active:attack_agent', [0], { requiresFlag: 'on_field_attack' }),
      effect('daze_multiplier', 'active:stun_agent', [1], { requiresFlag: 'on_field_stun' }),
      effect('anomaly_buildup_multiplier', 'active:anomaly_agent', [2], {
        requiresFlag: 'on_field_anomaly',
      }),
    ],
  },
  '54017': {
    allOf: [{ key: 'faction:yunkui_summit', minimum: 1 }],
    conditionMinimumIndex: 0,
    effects: [
      effect('damage_multiplier', 'all', [1]),
      effect('cooldown_delta', 'active', [2], { requiresFlag: 'agent_ultimate_used', maximum: 2 }),
    ],
  },
  '54018': {
    allOf: [{ key: 'faction:spook_shack', minimum: 1 }],
    conditionMinimumIndex: 0,
    effects: [
      effect('hp_recovery_multiplier', 'spectral_bubble', [1]),
      effect('energy_multiplier', 'twinkling_star', [2]),
    ],
  },
  '54019': {
    allOf: [{ key: 'faction:defense_force', minimum: 1 }],
    conditionMinimumIndex: 0,
    effects: [
      effect('damage_multiplier', 'active:next', [1], {
        requiresFlag: 'agent_aftershock_dealt',
        maximum: 2,
        intervalSeconds: 5,
        accumulatorKey: 'aftershock_stacks',
      }),
    ],
  },
  '54020': {
    allOf: [{ key: 'faction:krampus_compliance_authority', minimum: 1 }],
    conditionMinimumIndex: 0,
    effects: [
      effect('daze_multiplier', 'active', [1], {
        requiresFlag: 'agent_ex_special_used',
        maximum: 3,
        accumulatorKey: 'ex_special_stacks',
      }),
      effect('damage_multiplier', 'active', [], {
        constantValues: [0.1],
        requiresFlag: 'ex_special_stacks_at_maximum',
      }),
    ],
  },
  '54021': {
    agentPresent: currentBangbooAgentCompositionKey('agent-ye-shunguang'),
    effects: [
      effect('damage_multiplier', 'all', [0]),
      effect('summon_count', 'active:sword', [], {
        constantValues: [1],
        requiresFlag: 'ether_veil_verdict_active',
      }),
    ],
  },
  '54022': {
    allOf: [{ key: 'faction:roscaelifer', minimum: 1 }],
    effects: [
      effect('energy_flat', 'team:vortex_or_chain', [0], { intervalSeconds: 30 }),
      effect('damage_multiplier', 'active', [1]),
      effect('duration_delta', 'active:damage_buff', [], { constantValues: [45] }),
    ],
  },
  '54023': {
    agentPresent: currentBangbooAgentCompositionKey('agent-remielle'),
    effects: [
      effect('guarantee', 'active:all_buffs', [], { constantValues: [1] }),
      effect('damage_multiplier', 'chain', [0]),
    ],
  },
}
