export type PotentialEffectTargetKind = 'self' | 'team'

export type PotentialEffectValueKind =
  | 'crit_damage'
  | 'stat_bonus'
  | 'damage_bonus'
  | 'daze_bonus'
  | 'impact_bonus'
  | 'resistance_ignore'
  | 'duration'
  | 'rate_seconds'
  | 'conversion'

/**
 * Runtime compilation starts fail-closed. An effect carries its real source
 * condition separately, but must not become active until the runtime binds a
 * matching key.
 */
export type PotentialActivationKey = 'inactive'

export type PotentialLevelValues = readonly [0, number, number, number, number, number, number]

export type PotentialConversion = {
  /**
   * Exact numeric domain exposed by `own.initial.*` in the planning runtime.
   * The source UI may call penetration a percent, but `pen_` is a fraction
   * (for example, 0.24 for 24%), while `enerRegen` is points per second.
   */
  inputStat: 'penetration_ratio_fraction' | 'energy_regen_per_second'
  threshold: number | null
  step: number | null
  cap: number | null
}

/**
 * This is the source-to-local-formula bridge specification, not an upstream
 * formula assertion. The locked upstream formula corpus has no potential
 * reference, so runtime compilation must honor every listed predicate.
 */
export type PotentialFormulaBinding = {
  bucket:
    | 'self_crit_damage'
    | 'self_damage'
    | 'self_stat'
    | 'self_element_damage'
    | 'self_daze'
    | 'self_action_impact'
    | 'self_action_resistance_ignore'
    | 'team_stat'
    | 'team_action_damage'
    | 'state_duration'
    | 'event_interval'
    | 'unresolved_damage_bucket'
  requiredStates: readonly string[]
  requiredActionFamilies: readonly string[]
  requiredTargetStates: readonly string[]
  multiplier: {
    kind: 'none' | 'per_input_step' | 'at_fixed_stack_count'
    fixedStackCount?: number
  }
  /** No catalog entry may silently enter a generic ordinary-damage bucket. */
  compilationDisposition:
    | 'requires_potential_level_only'
    | 'requires_explicit_state_binding'
    | 'requires_explicit_action_binding'
    | 'requires_explicit_state_and_action_binding'
    | 'unresolved_formula_bucket'
  /**
   * 1-based rows in the archived `potentialParams`, or `source_only` when
   * the guide supplies a mechanic that is absent from that raw array.
   */
  sourceParameterBinding: {
    kind: 'raw_direct' | 'raw_schema_aligned' | 'source_corrected' | 'source_only'
    rows: readonly number[]
  }
  /** Present only when a direct source gives a number but no safe damage bucket. */
  unresolvedFormulaReason?: string
}

/** Distinguishes a final modifier from a formula coefficient or a timer. */
export type PotentialValueSemantics =
  | 'final_absolute_modifier'
  | 'final_coefficient_per_input_step'
  | 'final_event_interval_seconds'
  | 'state_duration'
  | 'unresolved_damage_coefficient_per_input_step'

export type ReviewedPotentialEffectDefinition = {
  effectId: string
  targetKind: PotentialEffectTargetKind
  activationKey: PotentialActivationKey
  /** Human-readable source condition for the future named activation binding. */
  activationRequirement: string
  unit: string
  valueKind: PotentialEffectValueKind
  valueSemantics: PotentialValueSemantics
  /** Effective absolute value for source potential image 0 through 6. */
  valueByLevel: PotentialLevelValues
  conversion?: PotentialConversion
  formulaBinding: PotentialFormulaBinding
}

export type ReviewedPotentialDefinition = {
  agentId: string
  source: {
    url: string
    sourceVersion: string
    /** SHA-256 of the archived structured-body evidence. */
    contentHash: string
    upstreamRawPath: string
    upstreamRawSha256: string
    /** Additional direct source text; it supplements and never replaces the archive body hash. */
    supplementarySources?: readonly {
      id: string
      url: string
      sourceVersion: string
      retrievedAt: string
      contentHash: string
      evidencePath: string
    }[]
  }
  /**
   * Level 1 mechanics text. A separately sourced L1 timer may still be
   * carried by a `state_duration` effect; it is never a damage/stat scalar.
   */
  levelOneMechanic: string
  effects: readonly ReviewedPotentialEffectDefinition[]
}

export const upstreamRoot =
  "soda-source-ref:0d206bbdbfdd183a78fe4be15ae14c21"

export const inactive = 'inactive' as const

export function definePotential(
  definition: ReviewedPotentialDefinition,
): ReviewedPotentialDefinition {
  for (const effect of definition.effects) {
    if (effect.valueByLevel.length !== 7)
      throw new Error(`${definition.agentId}:${effect.effectId} must expose level 0..6.`)
    if (effect.valueByLevel[0] !== 0)
      throw new Error(`${definition.agentId}:${effect.effectId} must be disabled at level 0.`)
    if (effect.activationKey !== inactive)
      throw new Error(`${definition.agentId}:${effect.effectId} must begin fail-closed.`)
  }
  return Object.freeze({
    ...definition,
    effects: Object.freeze(definition.effects.map((effect) => Object.freeze({ ...effect }))),
  })
}
