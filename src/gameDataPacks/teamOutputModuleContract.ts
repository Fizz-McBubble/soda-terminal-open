export const teamOutputModuleContractId = 'soda-team-output-module/v1' as const

export type TeamPrimaryOutputKind =
  | 'direct_damage'
  | 'attribute_anomaly'
  | 'rupture'
  | 'aftershock'
  | 'sharp'

export const teamPrimaryOutputKindLabels: Record<TeamPrimaryOutputKind, string> = {
  direct_damage: '直伤',
  attribute_anomaly: '属性异常',
  rupture: '命破',
  aftershock: '追加攻击',
  sharp: '锋御',
}

export type TeamReactionMechanism =
  | 'disorder'
  | 'abloom'
  | 'polarity'
  | 'penetration'
  | 'laceration'
  | 'luminize'

export type TeamExecutionChannel = 'stun_window' | 'chain' | 'ultimate' | 'off_field' | 'quick_swap'

export type TeamFunction =
  | 'stun'
  | 'support'
  | 'defense'
  | 'defense_reduction'
  | 'resistance_reduction'
  | 'ether_veil'
  | 'resource_supply'
  | 'anomaly_amplification'

export type TeamOutputModule = {
  contract: typeof teamOutputModuleContractId
  id: string
  primaryOutputKind: TeamPrimaryOutputKind
  /** Positive source-backed tags; an omitted tag is not evidence of absence. */
  reactionMechanisms: readonly TeamReactionMechanism[]
  executionChannels: readonly TeamExecutionChannel[]
  teamFunctions: readonly TeamFunction[]
}

export type TeamOutputModuleSourceEvidence = {
  sourceId: string
  sourceVersion: string
  contentHash: string
  locator: string
  text: string
}

export type TeamOutputModuleResolution =
  | {
      status: 'classified'
      classification:
        | 'current_exact_team_review'
        | 'current_aggregate_exact_team_observation'
        | 'historical_exact_team_review'
        | 'author_comparison_only'
      module: TeamOutputModule
      sourceEvidence?: readonly TeamOutputModuleSourceEvidence[]
    }
  | {
      status: 'conflict'
      moduleIds: readonly string[]
    }
  | {
      status: 'unknown'
    }

function module(input: Omit<TeamOutputModule, 'contract'>): TeamOutputModule {
  return Object.freeze({ contract: teamOutputModuleContractId, ...input })
}

export const teamOutputModules = Object.freeze({
  directStun: module({
    id: 'module-direct-stun',
    primaryOutputKind: 'direct_damage',
    reactionMechanisms: [],
    executionChannels: ['stun_window', 'chain', 'quick_swap'],
    teamFunctions: ['stun', 'support'],
  }),
  anomalyDisorder: module({
    id: 'module-anomaly-disorder',
    primaryOutputKind: 'attribute_anomaly',
    reactionMechanisms: ['disorder'],
    executionChannels: ['quick_swap'],
    teamFunctions: ['anomaly_amplification'],
  }),
  anomalyAbloom: module({
    id: 'module-anomaly-abloom',
    primaryOutputKind: 'attribute_anomaly',
    reactionMechanisms: ['abloom', 'disorder'],
    executionChannels: ['off_field', 'quick_swap'],
    teamFunctions: ['anomaly_amplification', 'ether_veil'],
  }),
  anomalyLuminize: module({
    id: 'module-anomaly-luminize',
    primaryOutputKind: 'attribute_anomaly',
    reactionMechanisms: ['luminize', 'disorder'],
    executionChannels: ['quick_swap'],
    teamFunctions: ['anomaly_amplification'],
  }),
  anomalyPolarity: module({
    id: 'module-anomaly-polarity',
    primaryOutputKind: 'attribute_anomaly',
    reactionMechanisms: ['polarity', 'disorder'],
    executionChannels: ['stun_window', 'quick_swap'],
    teamFunctions: ['anomaly_amplification', 'stun'],
  }),
  ruptureStun: module({
    id: 'module-rupture-stun',
    primaryOutputKind: 'rupture',
    reactionMechanisms: ['penetration'],
    executionChannels: ['stun_window', 'ultimate'],
    teamFunctions: ['stun', 'support'],
  }),
  ruptureUltimate: module({
    id: 'module-rupture-ultimate',
    primaryOutputKind: 'rupture',
    reactionMechanisms: ['penetration'],
    executionChannels: ['stun_window', 'chain', 'ultimate'],
    teamFunctions: ['stun', 'support', 'resource_supply'],
  }),
  aftershockBackground: module({
    id: 'module-aftershock-background',
    primaryOutputKind: 'aftershock',
    reactionMechanisms: [],
    executionChannels: ['off_field', 'quick_swap'],
    teamFunctions: ['stun'],
  }),
  sharpStun: module({
    id: 'module-sharp-stun',
    primaryOutputKind: 'sharp',
    reactionMechanisms: ['laceration'],
    executionChannels: ['stun_window', 'chain', 'ultimate'],
    teamFunctions: ['stun', 'support', 'resistance_reduction'],
  }),
})

export const teamOutputModuleTaxonomy = Object.freeze({
  requiredPrimaryOutputKinds: [
    'direct_damage',
    'attribute_anomaly',
    'rupture',
    'aftershock',
    'sharp',
  ] as const satisfies readonly TeamPrimaryOutputKind[],
  reactionMechanisms: [
    'disorder',
    'abloom',
    'polarity',
    'penetration',
    'laceration',
    'luminize',
  ] as const satisfies readonly TeamReactionMechanism[],
  executionChannels: [
    'stun_window',
    'chain',
    'ultimate',
    'off_field',
    'quick_swap',
  ] as const satisfies readonly TeamExecutionChannel[],
  teamFunctions: [
    'stun',
    'support',
    'defense',
    'defense_reduction',
    'resistance_reduction',
    'ether_veil',
    'resource_supply',
    'anomaly_amplification',
  ] as const satisfies readonly TeamFunction[],
  boundary:
    'One team has one primary output module. Reactions, execution channels and team functions are orthogonal attributes; none of them becomes a second hidden score or changes team strength directly.',
})
