import { upstreamRoot, inactive, definePotential } from './reviewedPotentialDefinitionContract'

export const lycaonPotentialDefinition = definePotential({
  agentId: 'agent-lycaon',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/73045858',
    sourceVersion: '2.6',
    contentHash: 'd8b1a8835e4ba7b0b354dbf950f153f17bd97211670babfa32913997d17996e6',
    upstreamRawPath: `${upstreamRoot}/Lycaon.json`,
    upstreamRawSha256: 'ab105b2d9cb08b2bdc702207742d3f6daf94f9b2766ba710b2d82f73b2760c58',
    supplementarySources: [
      {
        id: 'miyoushe-73045858-image-247646019-impact-semantics',
        url: 'https://www.miyoushe.com/zzz/article/73045858',
        sourceVersion: '2.6',
        retrievedAt: '2026-09-10T04:09:24.000Z',
        contentHash: 'e6a6a8f509f259dbc8be95aa3e2bbba9a26986f4e6fde7cfed9db69bcd0a1841',
        evidencePath:
          "soda-source-ref:6ee4bc32da7a02cbb35f51c1406dc17b",
      },
    ],
  },
  levelOneMechanic:
    'Adds Encircle Prey, off-field coordinated attacks, a quick-assist route, and the potential team interaction states.',
  effects: [
    {
      // Retain the existing effect identity; the source specifies Impact,
      // not an interchangeable bonus to the resulting daze value.
      effectId: 'potential_off_field_encircle_prey_daze',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement:
        'Lycaon gains Impact while non-active in Encircle Prey and using Basic, Dash, or Dodge Counter.',
      unit: 'ratio',
      valueKind: 'impact_bonus',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.05, 0.075, 0.1, 0.125, 0.15],
      formulaBinding: {
        bucket: 'self_action_impact',
        requiredStates: ['lycaon_encircle_prey', 'provider_non_active'],
        requiredActionFamilies: ['basic', 'dash', 'dodge_counter'],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_state_and_action_binding',
        sourceParameterBinding: { kind: 'source_corrected', rows: [1] },
      },
    },
  ],
})

export const rinaPotentialDefinition = definePotential({
  agentId: 'agent-rina',
  source: {
    url: 'https://www.miyoushe.com/zzz/article/76974843',
    sourceVersion: '3.1',
    contentHash: 'a2916a0f3561920a7a90943ef20dce8c873ee6671a6186b8bf6ef905daf43eb2',
    upstreamRawPath: `${upstreamRoot}/Rina.json`,
    upstreamRawSha256: 'f2fa41601fdfc18fddf07e960e375d0bde2294339421460054a4116a4ab9586c',
  },
  levelOneMechanic:
    'EX Special, Chain, or Ultimate starts the 13-second potential meter; minion attacks stack Fright and six stacks create the source-named electric attack/reset.',
  effects: [
    {
      effectId: 'potential_penetration',
      targetKind: 'self',
      activationKey: inactive,
      activationRequirement: 'Potential image is level two or higher.',
      unit: 'ratio',
      valueKind: 'stat_bonus',
      valueSemantics: 'final_absolute_modifier',
      valueByLevel: [0, 0, 0.016, 0.016, 0.016, 0.016, 0.016],
      formulaBinding: {
        bucket: 'self_stat',
        requiredStates: [],
        requiredActionFamilies: [],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_potential_level_only',
        sourceParameterBinding: { kind: 'raw_direct', rows: [1] },
      },
    },
    {
      effectId: 'potential_team_attack_per_penetration',
      targetKind: 'team',
      activationKey: inactive,
      // Source article 76974843 and locked Rina potential.desc require the
      // Core Passive buff, independently of the separate 13-second meter.
      activationRequirement: "Rina's Core Passive PEN Ratio buff is active.",
      unit: 'flat_attack_per_0.01_penetration_ratio',
      valueKind: 'conversion',
      valueSemantics: 'final_coefficient_per_input_step',
      valueByLevel: [0, 0, 3, 4.2, 5.5, 6.7, 8],
      conversion: {
        inputStat: 'penetration_ratio_fraction',
        threshold: null,
        step: 0.01,
        cap: 576,
      },
      formulaBinding: {
        bucket: 'team_stat',
        requiredStates: ['rina_core_penetration_buff'],
        requiredActionFamilies: [],
        requiredTargetStates: [],
        multiplier: { kind: 'per_input_step' },
        compilationDisposition: 'requires_explicit_state_binding',
        sourceParameterBinding: { kind: 'raw_schema_aligned', rows: [2, 3, 5] },
      },
    },
    {
      effectId: 'potential_team_defense_per_penetration',
      targetKind: 'team',
      activationKey: inactive,
      activationRequirement: "Rina's Core Passive PEN Ratio buff is active.",
      unit: 'flat_defense_per_0.01_penetration_ratio',
      valueKind: 'conversion',
      valueSemantics: 'final_coefficient_per_input_step',
      valueByLevel: [0, 0, 2.5, 3.5, 4.5, 5.5, 6.5],
      conversion: {
        inputStat: 'penetration_ratio_fraction',
        threshold: null,
        step: 0.01,
        cap: 468,
      },
      formulaBinding: {
        bucket: 'team_stat',
        requiredStates: ['rina_core_penetration_buff'],
        requiredActionFamilies: [],
        requiredTargetStates: [],
        multiplier: { kind: 'per_input_step' },
        compilationDisposition: 'requires_explicit_state_binding',
        sourceParameterBinding: { kind: 'raw_schema_aligned', rows: [2, 4, 6] },
      },
    },
    {
      effectId: 'potential_meter_window_duration',
      targetKind: 'team',
      activationKey: inactive,
      activationRequirement: 'EX Special, Chain, or Ultimate fills the potential meter.',
      unit: 'seconds',
      valueKind: 'duration',
      valueSemantics: 'state_duration',
      // Unlike a L2+ modifier, the source explicitly supplies this L1 timer.
      valueByLevel: [0, 13, 13, 13, 13, 13, 13],
      formulaBinding: {
        bucket: 'state_duration',
        requiredStates: [],
        requiredActionFamilies: ['ex_special', 'chain', 'ultimate'],
        requiredTargetStates: [],
        multiplier: { kind: 'none' },
        compilationDisposition: 'requires_explicit_action_binding',
        sourceParameterBinding: { kind: 'source_only', rows: [] },
      },
    },
  ],
})
