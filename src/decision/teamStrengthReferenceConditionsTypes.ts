export type ReferenceConditionStatus =
  | 'explicit_numeric'
  | 'activated_unknown_level'
  | 'standard_reference'
  | 'unrecorded'
export type ReferenceConditionAuthority =
  | 'local_editorial_estimate'
  | 'strength_gold'
  | 'single_publisher_tier'
  | 'none'
export type UnhandledCondition = {
  rawDescription: string
  category: 'unresolved_source_condition'
  numericalized: false
  nonNumericalReason: string
  requiredFutureFields: readonly string[]
}
export type AgentReferenceCondition = {
  agentId: string
  status: ReferenceConditionStatus
  numericLevel: number | null
  numericLevelBasis: 'source_reference_configuration' | 'local_adjudicated_reference' | null
  /** Formed-team reference, not an observed source build. */
  mindscapeLevel: number
  minimumDemonstratedLevel: number | null
  demonstrationEvidence: string | null
  requirementSource: string | null
  evidenceRefs: readonly string[]
}
/** Numeric consumer input remains compatible with pre-metadata callers. */
export type TeamStrengthReferenceConditions = {
  mindscapeByAgentId?: Readonly<Record<string, number>>
  potentialByAgentId: Readonly<Record<string, number>>
  evidenceRefs: readonly string[]
  /** Declared comparison states, never inferred account/combat observations. */
  supportReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  recipientContext?: TeamStrengthRecipientContext
}
export type TeamStrengthRecipientContext = {
  /** Legacy explicit current attribute declaration; does not certify a historical core window. */
  contaminationAttributes?: readonly string[]
  roxyWindowsByRecipientId?: Readonly<
    Record<
      string,
      {
        wind: boolean
        electric: boolean
        squadWindswept: boolean
        contaminationMatches: boolean
        windsweptObserved: boolean
      }
    >
  >
}
export type ResolvedTeamStrengthReferenceConditions = TeamStrengthReferenceConditions & {
  status: ReferenceConditionStatus
  sourceAuthority: ReferenceConditionAuthority
  editorialRecordId?: string
  normalizedMemberIds: readonly string[]
  identity: string
  calculationAssumption: 'level60-base-skill11-core7-formed-key-mindscapes-supported-p6-explicit-override'
  agentConditions: readonly AgentReferenceCondition[]
  unhandledConditions: readonly UnhandledCondition[]
  diagnostics: readonly string[]
  sourceContext: unknown
}
export type ReferenceConditionsValidationResult = {
  valid: boolean
  teamKey: string
  issues: readonly string[]
  status: ReferenceConditionStatus
  activatedAgents: readonly string[]
}
export type TeamStrengthReferenceConditionsCoverageReport = {
  contract: 'soda-team-strength-reference-conditions-coverage-report/v1'
  totalTrainingTeamsCount: number
  editorialRecordsCount: number
  breakdown: Record<ReferenceConditionStatus, number>
  issueCounts: {
    activatedUnknownLevelCount: number
    unresolvedConditionCount: number
    standardReferenceCount: number
    calculationConflictCount: number
  }
  boundary: string
}
