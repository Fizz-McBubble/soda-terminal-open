import { upstreamRoot, inactive, definePotential } from './reviewedPotentialDefinitionContract'

export const burnicePotentialDefinition = definePotential({
  agentId: 'agent-burnice',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/72038077',
    sourceVersion: '2.5',
    contentHash: 'c79e79b2d5f451630d33f89b6bfb99908978f8d4c729a2cc90c23848ee7c9183',
    upstreamRawPath: `${upstreamRoot}/Burnice.json`,
    upstreamRawSha256: 'a207c51e364178da7672f894ec044ae1474417fdfbe69e9a6eb212553d1450ac',
    supplementarySources: [
      {
        id: 'nanoka-zzz-3.1-zh-character-1171-potential-detail',
        url: 'https://static.nanoka.cc/zzz/3.1/zh/character/1171.json',
        sourceVersion: '3.1',
        retrievedAt: '2026-09-08T03:42:08.904Z',
        contentHash: '1adea315ea8f611584d7c387dfb0b470c8835c7a8a48cd8567035c3c0d352339',
        evidencePath: "soda-source-ref:80009e855b2ff7bb76c9f3a1761fff5c",
      },
    ],
  },
  levelOneMechanic:
    'Adds the entry/Afterburn anomaly-settlement route, a free Afterburn event, Flowing Fire tracking, and quick-assist flow.',
  effects: [
    {
      effectId: 'potential_afterburn_interval',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'Afterburn trigger interval under potential mechanics.',
      unit: 'seconds',
      valueKind: 'rate_seconds',
      valueSemantics: 'final_event_interval_seconds',
      valueByLevel: [0, 0, 1.35, 1.35, 1.35, 1.35, 1.35],
      formulaBinding: {
        bucket: 'event_interval',
        requiredStates: ['burnice_afterburn_active'],
        requiredActionFamilies: ['afterburn_trigger'],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_and_action_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [7] },
      },
    },
    {
      effectId: 'potential_energy_regen_to_anomaly_mastery',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'Base Energy Regen is at least 1.8; each 0.1 above it converts.',
      unit: 'flat_anomaly_mastery_per_0.1_energy_regen_per_second',
      valueKind: 'conversion',
      valueSemantics: 'final_coefficient_per_input_step',
      valueByLevel: [0, 0, 1, 1.3, 1.6, 2, 2.5],
      conversion: {
        inputStat: 'energy_regen_per_second',
        threshold: 1.8,
        step: 0.1,
        cap: 25,
      },
      formulaBinding: {
        bucket: 'self_stat',
        requiredStates: ['burnice_energy_regen_threshold_met'],
        requiredActionFamilies: [],
        requiredTargetStates: [],
        multiplier: { kind: 'per_input_step' },
        compilationDisposition: 'requires_explicit_state_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1, 2, 3, 5] },
      },
    },
    {
      effectId: 'potential_energy_regen_to_damage',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'Base Energy Regen is at least 1.8; each 0.1 above it converts.',
      unit: 'ratio_per_0.1_energy_regen_per_second',
      valueKind: 'damage_bonus',
      valueSemantics: 'final_coefficient_per_input_step',
      valueByLevel: [0, 0, 0.01, 0.0125, 0.015, 0.0175, 0.02],
      conversion: {
        inputStat: 'energy_regen_per_second',
        threshold: 1.8,
        step: 0.1,
        cap: 0.2,
      },
      formulaBinding: {
        bucket: 'self_damage',
        requiredStates: ['burnice_energy_regen_threshold_met'],
        requiredActionFamilies: [],
        requiredTargetStates: [],
        multiplier: { kind: 'per_input_step' },
        compilationDisposition: 'requires_explicit_state_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1, 2, 4, 6] },
      },
    },
  ],
})

export const ellenPotentialDefinition = definePotential({
  agentId: 'agent-ellen',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/64923515',
    sourceVersion: '2.0',
    contentHash: '835863af4acf7a0f74887eb38fd14ac8ebfb1b59db653f238b280edb079253d1',
    upstreamRawPath: `${upstreamRoot}/Ellen.json`,
    upstreamRawSha256: '43ea8cce5bc936a918c8189a0dfaa4d744e681626c9f98e0ea9356a389eed775',
  },
  levelOneMechanic:
    'Adds Frost Fang and Ice Blade Wave, expands qualifying core actions, and enables the sourced ten-stack Ice Damage state.',
  effects: [
    {
      effectId: 'potential_qualifying_action_crit_damage',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement:
        'Dash Charge Scissor, Flash Freeze Charge-consuming Basic, Frost Fang, Ice Blade Wave, Chain, or Ultimate.',
      unit: 'ratio',
      valueKind: 'crit_damage',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.016, 0.024, 0.032, 0.04, 0.048],
      formulaBinding: {
        bucket: 'self_crit_damage',
        requiredStates: ['ellen_flash_freeze_charge'],
        requiredActionFamilies: [
          'dash_charge_scissor',
          'flash_freeze_charge_basic',
          'frost_fang',
          'ice_blade_wave',
          'chain',
          'ultimate',
        ],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_and_action_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1] },
      },
    },
    {
      effectId: 'potential_ice_resistance_ignore_at_ten_stacks',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'The source-named Ice Damage state reaches its fixed ten-stack cap.',
      unit: 'ratio',
      valueKind: 'resistance_ignore',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.033, 0.05, 0.067, 0.083, 0.1],
      formulaBinding: {
        bucket: 'self_action_resistance_ignore',
        requiredStates: ['ellen_ice_damage_stack'],
        requiredActionFamilies: ['ice_damage'],
        requiredTargetStates: [],
        multiplier: { kind: 'at_fixed_stack_count', fixedStackCount: 10 },
        compilationDisposition: 'requires_explicit_state_and_action_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [2, 3] },
      },
    },
  ],
})

export const gracePotentialDefinition = definePotential({
  agentId: 'agent-grace',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/72000935',
    sourceVersion: '2.5',
    contentHash: 'b6f8757ce43a8f0a33dd6ec1c70bcbe3b9f537e203e7fb596b479220a58b0497',
    upstreamRawPath: `${upstreamRoot}/Grace.json`,
    upstreamRawSha256: 'f5a960b28bf4f90df8ca136615d5d160cc35968dbff98cbf264b1d5366139213',
  },
  levelOneMechanic:
    'Pulse can be consumed through held Special to throw grenades, gain Charge, and trigger the source-named anomaly settlement.',
  effects: [
    {
      effectId: 'potential_electric_damage',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'Charge has been consumed and Electric Enhancement is active.',
      unit: 'ratio',
      valueKind: 'damage_bonus',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.1, 0.15, 0.2, 0.25, 0.3],
      formulaBinding: {
        bucket: 'self_element_damage',
        requiredStates: ['grace_electric_enhancement'],
        requiredActionFamilies: ['electric_damage'],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_and_action_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1, 2] },
      },
    },
  ],
})

export const harumasaPotentialDefinition = definePotential({
  agentId: 'agent-harumasa',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/73072485',
    sourceVersion: '2.6',
    contentHash: '1854122bf54fb3cd1e12b824ab3581c36f23d9e2c56bcb19641ebfd3cc2a222c',
    upstreamRawPath: `${upstreamRoot}/Harumasa.json`,
    upstreamRawSha256: 'b48f523f2f4d7ebd918f126a6a280e19c6818a222b919938bca596c4a5b54f6a',
  },
  levelOneMechanic:
    'Adds Focus from EX/Chain/Ultimate, extends Edge, adds the named action derivatives, and expands existing critical-buff action coverage.',
  effects: [
    {
      effectId: 'potential_focus_attack',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'The source-named Focus is granted by EX Special, Chain, or Ultimate.',
      unit: 'ratio',
      valueKind: 'stat_bonus',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.04, 0.06, 0.08, 0.1, 0.12],
      formulaBinding: {
        bucket: 'self_stat',
        requiredStates: ['harumasa_focus'],
        requiredActionFamilies: [],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1] },
      },
    },
    {
      effectId: 'potential_focus_named_action_electric_resistance_ignore',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement:
        'Focus is active and the action is Flying Spirit Slash or Chasing Thunder.',
      unit: 'ratio',
      valueKind: 'resistance_ignore',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.05, 0.075, 0.1, 0.125, 0.15],
      formulaBinding: {
        bucket: 'self_action_resistance_ignore',
        requiredStates: ['harumasa_focus'],
        requiredActionFamilies: ['flying_spirit_slash', 'chasing_thunder'],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_and_action_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [2] },
      },
    },
  ],
})

export const janePotentialDefinition = definePotential({
  agentId: 'agent-jane',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/76957755',
    sourceVersion: '3.1',
    contentHash: '3291ae3dfff9e60d66134cbab3f617102cf3140a1cb6a13637dba04ecced1c41',
    upstreamRawPath: `${upstreamRoot}/Jane.json`,
    upstreamRawSha256: '254be61034667d1c88885b665f6a145d0914ca3598e76b6d79aa1e93a66d5bf2',
  },
  levelOneMechanic:
    'Adds dash-attack classification, changes Salchow Jump behavior, and adds the potential enhanced Frenzy EX action.',
  effects: [
    {
      effectId: 'potential_assault_crit_damage',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'Jane triggers Assault.',
      unit: 'ratio',
      valueKind: 'crit_damage',
      // The source says 10/15/20/25/30%; upstream raw level five is 25.
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.1, 0.15, 0.2, 0.25, 0.3],
      formulaBinding: {
        bucket: 'self_crit_damage',
        requiredStates: [],
        requiredActionFamilies: ['physical_assault'],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_action_binding',
        sourceParameterBinding: { kind: 'source_corrected', rows: [1] },
      },
    },
  ],
})

export const nekomataPotentialDefinition = definePotential({
  agentId: 'agent-nekomata',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/76994144',
    sourceVersion: '3.1',
    contentHash: 'f66cbc1cee8ad1939433d7655899c56e7388e795f220478d0a1099788161b9c9',
    upstreamRawPath: `${upstreamRoot}/Nekomata.json`,
    upstreamRawSha256: 'ecea79b87e044463e5dbf7e818d09acd0256e0e906ee1dab266f862d8bc43ad4',
  },
  levelOneMechanic:
    'Creates Pawpad Ambush through the named piercing action, changes behind-target classification, and adds a timed extra hit.',
  effects: [
    {
      effectId: 'potential_pawpad_ambush_crit_damage',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'Pawpad Ambush is active after the named piercing action.',
      unit: 'ratio',
      valueKind: 'crit_damage',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.2, 0.3, 0.4, 0.5, 0.6],
      formulaBinding: {
        bucket: 'self_crit_damage',
        requiredStates: ['nekomata_pawpad_ambush'],
        requiredActionFamilies: ['all_attacks'],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1] },
      },
    },
  ],
})

export const soldier0AnbyPotentialDefinition = definePotential({
  agentId: 'agent-soldier-0-anby',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/69505810',
    sourceVersion: '2.3',
    contentHash: 'e973efa9a854750d5aead03849054a07c61d7fd799272fb85a360148966b939d',
    upstreamRawPath: `${upstreamRoot}/Soldier0Anby.json`,
    upstreamRawSha256: 'f10d24de4b6d452ad8c9e6bfebf833cbe5d4be39cb0ca2e14a00dd84fe63377a',
  },
  levelOneMechanic:
    'Extends Silver Star/White Thunder interactions, adds potential Special sequences, and marks Chain and Ultimate as Aftershock actions.',
  effects: [
    {
      effectId: 'potential_team_aftershock_damage_against_silver_star',
      targetKind: 'team',
      activationKey: inactive,
      activationRequirement: 'The target has Silver Star and the damage event is Aftershock.',
      unit: 'ratio',
      valueKind: 'damage_bonus',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.34, 0.38, 0.42, 0.46, 0.5],
      formulaBinding: {
        bucket: 'team_action_damage',
        requiredStates: [],
        requiredActionFamilies: ['aftershock'],
        requiredTargetStates: ['silver_star'],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_and_action_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1] },
      },
    },
  ],
})

export const soldier11PotentialDefinition = definePotential({
  agentId: 'agent-soldier-11',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/72067470',
    sourceVersion: '2.5',
    contentHash: '4a676b52f0bd5c428a1596af4ae8e2bb895b381f4032705939deec1b13cd68bd',
    upstreamRawPath: `${upstreamRoot}/Soldier11.json`,
    upstreamRawSha256: 'b6c18bbf8c03d3ee9541dea75e89cc3147e420a0bab4464bf93a99ca3d368b7f',
  },
  levelOneMechanic:
    'Adds held Firepower Burst, parry-counter Fire Blade recovery, and a Fire Blade-consuming enhanced fifth Basic route.',
  effects: [
    {
      effectId: 'potential_crit_damage',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement:
        'The source-named potential Fire Suppression/fifth-Basic combat state.',
      unit: 'ratio',
      valueKind: 'crit_damage',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.16, 0.24, 0.32, 0.4, 0.48],
      formulaBinding: {
        bucket: 'self_crit_damage',
        requiredStates: ['soldier11_fire_suppression'],
        requiredActionFamilies: [],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_binding',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1, 2] },
      },
    },
  ],
})
