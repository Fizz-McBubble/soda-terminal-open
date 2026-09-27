export type TeamEngineEvidenceStatus = 'formal' | 'candidate' | 'limited'

export type TeamPredicate =
  | { kind: 'agent_present'; agentId: string }
  | { kind: 'specialty_count'; specialty: string; minimum: number }
  | { kind: 'faction_count'; faction: string; minimum: number }
  | { kind: 'attribute_count'; attribute: string; minimum: number }
  | { kind: 'distinct_attribute_count'; minimum: number }
  | { kind: 'produced_tag'; tag: string }
  | { kind: 'potential_minimum'; agentId: string; minimum: number }
  | {
      kind: 'category_sum_minimum'
      /** Owner to exclude from source terms phrased as another teammate. */
      agentId: string
      /** Alternative teammate categories; one member contributes at most once. */
      terms: Array<{
        kind: 'specialty' | 'faction' | 'attribute'
        value: string
      }>
      minimum: number
      dynamicTerms: Array<
        | {
            kind: 'self_state_minimum'
            field: 'mindscape'
            minimum: number
            contribution: number
          }
        | {
            kind: 'other_member_capability'
            capability: 'defensive_assist'
            contribution: number
          }
      >
    }
  | { kind: 'all'; predicates: TeamPredicate[] }
  | { kind: 'any'; predicates: TeamPredicate[] }

export type TeamEngineEvidenceRef = {
  sourceId: string
  gameVersion: string
  status: TeamEngineEvidenceStatus
  locator: string
}

export type CurrentMetaStrengthBand = 'apex' | 'meta' | 'viable'

export type CurrentMetaStrengthR1 = {
  contract: 'soda-current-meta-strength/r1'
  kernelBands: Array<{
    kernelId: string
    band: CurrentMetaStrengthBand
    refs: TeamEngineEvidenceRef[]
  }>
  partialOrder: Array<{
    higherKernelId: string
    lowerKernelId: string
    refs: TeamEngineEvidenceRef[]
  }>
}

export type AgentRule = {
  agentId: string
  name: string
  releaseState: 'released' | 'unreleased'
  specialty: string
  faction: string
  attribute: string
  fieldTimeDemand: number
  produces: string[]
  consumes: string[]
  effects: Array<{ tag: string; recipient: 'self' | 'active_agent' | 'team' | 'enemy' }>
  capabilities?: Array<'defensive_assist'>
  additionalAbility:
    | { status: 'modeled'; predicate: TeamPredicate; description: string }
    | { status: 'none'; description: string }
    | { status: 'not_modeled'; description: string }
  evidence: TeamEngineEvidenceRef[]
}

export type PairSynergyKernel = {
  kernelId: string
  familyId: string
  label: string
  coreAgentIds: [string, string]
  eligibleThirdAgentIds: string[]
  requiredTeamPredicates: TeamPredicate[]
  requiredProducedTags: string[]
  requiredEffectTags: string[]
  allowedInactiveAdditionalAbilityAgentIds: string[]
  scenarioTags: string[]
  strengthEvidence: {
    tier: 'current_strong_candidate' | 'current_viable_candidate'
    /** Compatibility-only pre-R1 classification. Current ordering is owned by Meta Strength. */
    score: number
    claim: string
    refs: TeamEngineEvidenceRef[]
  }
}

export type BangbooRule = {
  bangbooId: string
  name: string
  releaseState: 'released' | 'unreleased'
  activation:
    | {
        status: 'modeled'
        predicate: TeamPredicate
        /**
         * A reviewed, Bangboo-specific faction-count threshold that changes at
         * stated star breakpoints. Other activation predicates never consume
         * this field.
         */
        factionCountMinimumByStar?: Partial<Record<BangbooStar, number>>
        description: string
        evidence: TeamEngineEvidenceRef[]
      }
    | { status: 'unknown'; description: string; evidence: TeamEngineEvidenceRef[] }
  suitability:
    | {
        status: 'modeled'
        familyIds: string[]
        scenarioTags: string[]
        description: string
        /** Optional named guide/community confirmation. Never establishes suitability by itself. */
        validationEvidence?: TeamEngineEvidenceRef[]
        evidence: TeamEngineEvidenceRef[]
      }
    | { status: 'unknown'; description: string; evidence: TeamEngineEvidenceRef[] }
  provenance: TeamEngineEvidenceRef[]
  /** @deprecated Transitional aggregate for consumers migrating to activation/suitability. */
  evidence: TeamEngineEvidenceRef[]
}

export type BangbooStar = 1 | 2 | 3 | 4 | 5

export type BangbooStarsById = Readonly<Record<string, BangbooStar | undefined>>

export function bangbooStarForId(
  bangbooStarsById: BangbooStarsById | undefined,
  bangbooId: string,
): BangbooStar {
  return bangbooStarsById?.[bangbooId] ?? 1
}

export type BangbooSelection =
  | { status: 'not_evaluated'; reason: string }
  | {
      status: 'selected'
      bangbooId: string
      /** Present for live Engine output; omitted only by legacy persisted fixtures. */
      bangbooStar?: BangbooStar
      alternativeBangbooIds?: string[]
    }
  | {
      status: 'compatible_fallback'
      bangbooId: string
      /** Present for live Engine output; omitted only by legacy persisted fixtures. */
      bangbooStar?: BangbooStar
      bangbooIds: string[]
    }
  | { status: 'no_activation_match'; bangbooIds: string[] }
  | { status: 'activation_unknown'; bangbooIds: string[] }
  | { status: 'no_authoritative_recommendation'; bangbooIds: string[] }

export type BangbooTeamObjective = {
  contract: 'soda-bangboo-team-objective/v2'
  status: 'supported' | 'partial' | 'unsupported'
  basis: readonly ['game_mechanic', 'activation', 'team_composition', 'effect_recipient_fit']
  evidenceConfidence: 'mechanic_plus_external_validation' | 'mechanic_derived' | 'insufficient'
  validationRole: 'confidence_only'
  primaryBangbooId: string | null
  alternativeBangbooIds: string[]
  evaluatedBangbooIds: string[]
  explanation: string
  boundary: string
}

export type LegacyAssembly = {
  assemblyId: string
  label: string
  memberIds: [string, string, string]
  bangbooId: string | null
  reason: string
  sourceIds: string[]
}

export type TeamEnginePack = {
  contract: 'soda-team-engine/v1'
  gameVersion: string
  agentRules: AgentRule[]
  kernels: PairSynergyKernel[]
  currentMetaStrength: CurrentMetaStrengthR1
  bangbooRules: BangbooRule[]
  legacyAssemblies: LegacyAssembly[]
}

export type TeamEngineBoxInput = {
  ownedAgentIds: string[]
  /** Current-version released scheme candidates. This is not an account inventory. */
  bangbooCandidateIds?: string[]
  /** Account-observed Bangboo stars; unspecified entries intentionally evaluate as S1. */
  bangbooStarsById?: BangbooStarsById
  /** @deprecated Compatibility input; new production callers must use bangbooCandidateIds. */
  ownedBangbooIds?: string[]
  preferredAgentIds?: string[]
  cultivationByAgentId?: Record<string, 'ready' | 'developing' | 'unbuilt'>
  warehouseReadyAgentIds?: string[]
  scenarioTags?: string[]
  fieldTimeBudget?: number
  agentStateById?: Record<string, { mindscape?: number; potentialImage?: number | null }>
}

export type TeamEngineFailureCode =
  | 'missing_core_agent'
  | 'no_eligible_third'
  | 'unreleased_agent'
  | 'additional_ability_inactive'
  | 'additional_ability_unverified'
  | 'team_predicate_failed'
  | 'resource_loop_open'
  | 'effect_coverage_missing'
  | 'field_time_conflict'
  | 'missing_eligible_bangboo'
  | 'bangboo_activation_unknown'
  | 'bangboo_recommendation_unknown'

export type TeamEngineFailure = {
  code: TeamEngineFailureCode
  detail: string
  agentId?: string
  tag?: string
}

export type TeamEngineTraceStep = {
  stage:
    | 'core'
    | 'pair_synergy'
    | 'additional_ability'
    | 'effect_coverage'
    | 'rotation'
    | 'resource_loop'
    | 'bangboo'
    | 'box_correction'
  status: 'pass' | 'fail' | 'limited'
  detail: string
}

export type TeamEngineRecommendationClass =
  | 'strong_recommendation'
  | 'stable_usable'
  | 'transitional'
  | 'assemble_only_not_recommended'
  | 'cannot_close'

export type TeamEngineCandidate = {
  candidateId: string
  kernelId: string | null
  familyId: string | null
  label: string
  memberIds: [string, string, string]
  bangbooId: string | null
  /** Actual star used by this Engine result, never an inferred account write. */
  bangbooStar?: BangbooStar | null
  bangbooSelection: BangbooSelection
  bangbooTeamObjective?: BangbooTeamObjective
  /** Stable scenario facts inherited from the accepted kernel; never use kernelId as scenario. */
  scenarioTags: string[]
  classification: TeamEngineRecommendationClass
  strengthTier: PairSynergyKernel['strengthEvidence']['tier'] | null
  metaBand: CurrentMetaStrengthBand | null
  score: number
  preferredAgentCount: number
  claim: string
  failures: TeamEngineFailure[]
  trace: TeamEngineTraceStep[]
  sourceIds: string[]
}

export type TeamEngineResult = {
  contract: 'soda-team-engine-result/v1'
  gameVersion: string
  recommendations: TeamEngineCandidate[]
  rejected: TeamEngineCandidate[]
  assembleOnly: TeamEngineCandidate[]
  boundaries: string[]
}
