/**
 * Soda Terminal: absolute-quality retention reference kernel.
 * Reference implementation adapted for the production warehouse read model.
 * No inventory ranking, equipment, team assignment or ownership enters scoring.
 * Game facts, role profiles and cut-offs are supplied by the caller, not guessed.
 */
export type Applicability = 'valid' | 'conditional' | 'incompatible'
export type Disposition = 'keep' | 'observe' | 'review' | 'cleanup_candidate'
export type StatWeights = Readonly<Record<string, number>>
export type UtilityState = Applicability | 'incidental' | 'missing_fact'
export interface UtilityEvidence {
  readonly state: UtilityState
  readonly predicateId: string
  readonly evidenceIds: readonly string[]
  readonly detail: string
}
export interface CoverageGap {
  readonly field: string
  readonly detail: string
  readonly profileId?: string
  readonly agentId?: string
  /** Omitted scope is global; an empty array is not a claim of irrelevance. */
  readonly setIds?: readonly string[]
  readonly slots?: readonly number[]
  readonly mainStats?: readonly string[]
  readonly sourceIds: readonly string[]
}
export type RetentionReasonKind =
  | 'quality_keep'
  | 'functional_ready'
  | 'try_next_upgrade'
  | 'quality_borderline'
  | 'conditional_use'
  | 'missing_fact'
  | 'proven_low_ceiling'
  | 'low_investment_value'
  | 'no_supported_use'
  | 'approved_rarity_cleanup'
  | 'invalid_record'
export interface RetentionBlocker {
  readonly profileId?: string
  readonly agentId?: string
  readonly kind: 'missing_fact' | 'conditional_use' | 'policy' | 'record' | 'reference'
  readonly field: string
  readonly predicateId: string
  readonly detail: string
  readonly sourceIds: readonly string[]
}
export interface RetentionNextAction {
  readonly kind:
    | 'keep'
    | 'try_upgrade'
    | 'review_quality'
    | 'check_condition'
    | 'complete_data'
    | 'manual_cleanup'
  readonly targetLevel: number | null
  readonly detail: string
  readonly stopWhen: string
}
export interface InvestmentPolicy {
  readonly id: string
  readonly calibration: 'candidate' | 'approved'
  readonly meaningfulWeightFrom: number
  readonly leftSlotMinimumLines: number
  readonly rightSlotMinimumLines: number
  readonly minimumCoreLines: number
  readonly growthTarget: 'keepFrom' | 'premiumFrom'
  /** Later stages must have earned this fraction of the cleanup quality line. */
  readonly progressFloorBySpentNode: Readonly<Record<string, number>>
}
export interface Disc {
  readonly id: string
  readonly setId: string
  readonly slot: number
  readonly rarity: string
  readonly level: number
  readonly subStats: readonly {
    readonly stat: string
    readonly value: number
    readonly upgrades: number
  }[]
  readonly mainStat: string
}
export interface Effect {
  readonly stat: string
  readonly value: number
  readonly actionTypes?: readonly string[]
  /** Only TWO-piece prerequisites belong here, never four-piece prerequisites. */
  readonly requires?: readonly string[]
}
export interface SetFacts {
  readonly id: string
  readonly verified: boolean
  readonly sourceIds: readonly string[]
  readonly twoPieceEffects: readonly Effect[]
}
export interface RarityRules {
  readonly maxLevel: number
  readonly initialLineCounts: readonly number[]
  readonly steps: StatWeights
}
export interface GameRules {
  readonly sourceIds: readonly string[]
  readonly standardRarity: string
  readonly enhancementInterval: number
  readonly maxSubStats: number
  readonly mainStatsBySlot: Readonly<Record<string, readonly string[]>>
  readonly rarities: Readonly<Record<string, RarityRules>>
}
export interface Profile {
  readonly id: string
  readonly agentId: string
  readonly sourceIds: readonly string[]
  readonly verified: boolean
  /** A team- or potential-gated branch remains separate and cannot prove current use. */
  readonly availability?: Applicability
  readonly mainAvailability?: Applicability
  /** Separate builds MUST be separate profiles; never union their stat weights. */
  readonly weights: StatWeights
  readonly goal?: 'crit_damage' | 'anomaly_damage' | 'functional' | 'unknown'
  readonly coreStats?: readonly string[]
  readonly weightEvidence?: {
    readonly id: string
    readonly method: string
    readonly sourceIds: readonly string[]
  }
  /** Uncertainty is scoped to a contributing stat of this one goal. */
  readonly qualityInputEvidence?: Readonly<Record<string, UtilityEvidence>>
  readonly mainStatsBySlot: Readonly<Record<string, Readonly<Record<string, Applicability>>>>
  /** A sourced mechanical benefit, not a list of popular set names. */
  readonly effectUtility: Readonly<Record<string, Applicability>>
  readonly actionUtility?: Readonly<Record<string, Applicability>>
  readonly utilityEvidence?: Readonly<Record<string, UtilityEvidence>>
  readonly conditionEvidence?: readonly UtilityEvidence[]
  readonly prerequisites?: Readonly<Record<string, Applicability>>
  /** Independent evidence for FOUR-piece uses. */
  readonly fourPieceUses?: Readonly<Record<string, Applicability>>
  /** Explicit sourced function cases only. Fixed slots 1-3 are forbidden. */
  readonly functionalMains?: readonly {
    slot: number
    stat: string
    sourceId: string
    completion?: 'main_only' | 'build_threshold'
    predicateId?: string
    detail?: string
  }[]
}
export interface Catalog {
  readonly rules: GameRules
  readonly sets: readonly SetFacts[]
  readonly profiles: readonly Profile[]
  readonly releasedAgentIds: readonly string[]
  readonly factsGameVersion: string
  readonly assessmentGameVersion: string
  /** Installed analysis identity; source and policy versions remain historical. */
  readonly versionIdentity?: {
    readonly analysisTargetVersion: string
    readonly policyCalibrationVersion: string
    readonly sourceOriginalVersions: readonly (string | null)[]
    readonly adoption: {
      readonly id: string
      readonly contentHash: string
      readonly targetVersion: string
      readonly sourceCommit: string
      readonly scopeContentHash: string
      readonly referenceContinuityId: string
      readonly referenceReviewVersion: string
    }
  }
  /** Attests all relevant released build branches, not just all agent names. */
  readonly branchCoverageComplete: boolean
  readonly reviewedUseScope?: string
  readonly coverageGaps?: readonly CoverageGap[]
}
export interface Cutoffs {
  /** Below this AND unable to reach it is the only score-based cleanup case. */
  readonly cleanupBelow: number
  readonly keepFrom: number
  readonly premiumFrom: number
}
export interface QualityPolicy {
  readonly id: string
  /** No built-in default cutoffs. Production must calibrate and version them. */
  readonly calibration: 'candidate' | 'approved'
  /** Cleanup is withheld for rarities absent from the independent calibration sample. */
  readonly calibratedRarities?: readonly string[]
  /** An explicit product rule, independent of the numeric quality calibration. */
  readonly rarityCleanup?: {
    readonly id: string
    readonly approval: 'candidate' | 'approved'
    readonly rarities: readonly ('A' | 'B')[]
    readonly sourceIds: readonly string[]
  }
  readonly byProfile: Readonly<Record<string, Readonly<Record<string, Cutoffs>>>>
  readonly investment?: InvestmentPolicy
}
export interface QualityEvidence {
  readonly profileId: string
  readonly agentId: string
  readonly sourceIds: readonly string[]
  readonly mainFit: Applicability
  readonly setFit: Applicability
  readonly twoPieceFit: Applicability
  readonly fourPieceFit: Applicability
  readonly currentScore: number
  readonly weightedRollUnits: number
  readonly maximumRaw: number
  readonly possibleFinalScore: { readonly lower: number; readonly upper: number }
  /** A legal bound is not an expected value or a success probability. */
  readonly expectedScore: null
  readonly functionalMain: boolean
  readonly functionalState: 'none' | 'ready' | 'needs_level' | 'needs_build_context'
  readonly functionDetail: string | null
  readonly useState: 'valid' | 'conditional' | 'missing_fact' | 'incompatible'
  readonly blockers: readonly RetentionBlocker[]
  readonly weightEvidence: Profile['weightEvidence'] | null
  readonly investment: {
    readonly policyId: string | null
    readonly qualified: boolean | null
    readonly meaningfulStats: readonly string[]
    readonly coreStats: readonly string[]
    readonly spentNodes: number
    readonly remainingNodes: number
    readonly nextLevel: number | null
    readonly progressFloor: number | null
    readonly potentialTarget: number | null
    /** An unsatisfiable stage policy cannot reject a use or erase sufficient quality/function. */
    readonly policyBlockers?: readonly RetentionBlocker[]
  }
  readonly cutoffs: Cutoffs | null
  readonly contributors: readonly {
    stat: string
    standardRollUnits: number
    weight: number
    points: number
  }[]
}
export interface Decision {
  readonly discId: string
  readonly qualityDisposition: Disposition
  readonly recommendation: Disposition | 'protected'
  readonly reasons: readonly string[]
  readonly evidence: readonly QualityEvidence[]
  readonly bestUseProfileId: string | null
  readonly bestUseScore: number | null
  readonly ownedUseAgentIds: readonly string[]
  readonly unownedUseAgentIds: readonly string[]
  readonly policyId: string
  readonly sourceCoverage: 'complete' | 'partial'
  readonly reasonKind: RetentionReasonKind
  readonly nextAction: RetentionNextAction
  readonly blockedBy: readonly RetentionBlocker[]
  readonly witnessProfileIds: readonly string[]
  readonly reviewedUseScope: string | null
}
/** A sourced negative quality goal is distinct from an uncalibrated goal. */
export const noFunctionalSubstatGoalMethod = 'source_proven_no_functional_substat_goal'
