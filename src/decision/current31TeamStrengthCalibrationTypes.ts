import type { CurrentMetaStrengthBand } from '../teamEngine/contracts'
import type { DecisionConfidenceBand, TeamRatingBand } from './teamDecisionAuthority'
import type {
  reviewedReferenceSupportContinuity32,
  reviewedGenericReferenceContinuity33,
} from '../gameDataPacks/reviewedReferenceSupportContinuity32'
import type { ReviewedTeamAnalysis } from './reviewedTeamAnalysis'
import type { TeamStrengthInference } from './teamStrengthModel'
import type { current31TeamStrengthCalibrationContractId } from './current31TeamStrengthCalibration'

export type Current31MechanicValidity = 'invalid' | 'partial' | 'valid' | 'excellent'

export type Current31MetaCalibration = {
  referenceContinuity?:
    | typeof reviewedReferenceSupportContinuity32
    | typeof reviewedGenericReferenceContinuity33
  contract: typeof current31TeamStrengthCalibrationContractId
  status: 'aligned' | 'calibration_violation' | 'insufficient'
  authority:
    | 'strength_gold'
    | 'variant_reality_profile'
    | 'single_publisher_tier'
    | 'local_editorial_estimate'
    | 'model_inference'
    | 'recovered_preliminary'
    | 'none'
  confidenceCeiling?: 'medium' | 'low'
  analysis?: ReviewedTeamAnalysis
  /** Candidate discovery diagnostics; never tier or recommendation authority. */
  inference?: TeamStrengthInference
  /** Shared coarse-tier reference score; confidence never changes its value. */
  recommendationScore?: number
  evidenceStatus?: 'supported' | 'unknown' | 'conflict'
  kernelId: string | null
  familyId: string | null
  versionPosition: CurrentMetaStrengthBand | null
  projectedStrengthBand: TeamRatingBand | null
  /** Seven-dimensional mechanism grades are not version-strength predictions.
   * Preserve their difference for diagnostics, not as an independent fit score. */
  mechanicBandComparison?: {
    mechanicBand: TeamRatingBand | null
    sourceStrengthBand: TeamRatingBand
    relation: 'same' | 'different' | 'unrated'
    use: 'diagnostic_only'
  }
  evidenceRefs: string[]
  explanation: string
}

export type Current31RealityCheck = {
  status:
    | 'mechanic_rejected'
    | 'calibrated_band_supported'
    | 'mainstream_confirmed_band_unknown'
    | 'unconfirmed'
  strengthBand: TeamRatingBand | null
  confidenceCeiling: DecisionConfidenceBand
  referencePerformanceRequiredForCurrentGate: false
  explanation: string
}

export type TeamStrengthEvidenceMode = 'source_reference' | 'independent_evaluation'
