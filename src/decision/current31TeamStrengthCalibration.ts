import {
  formationKey,
  recognitionIndex,
  resolveCurrent31MainstreamRecognition,
  type Current31MainstreamRecognition,
} from './current31TeamMainstreamRecognition'
export { resolveCurrent31MainstreamRecognition } from './current31TeamMainstreamRecognition'
export type { Current31MainstreamRecognition } from './current31TeamMainstreamRecognition'
import type { CurrentMetaStrengthBand } from '../teamEngine/contracts'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import {
  current31MetaStrengthR1,
  current31MetaStrengthR1Lineage,
} from '../teamEngine/currentMetaStrengthR1'
import type {
  BenchmarkEvidence,
  DecisionConfidenceBand,
  TeamFeatureVector,
  TeamRatingBand,
  TeamRatingResult,
} from './teamDecisionAuthority'
import {
  currentReviewedTeamCompatibilityNotes,
  currentReviewedTeamSourceDirections,
} from '../gameDataPacks/reviewedTeamSourceDirections'
import { stableContentHash } from '../gameDataPacks/types'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import {
  canApplyReviewedReferenceSupport32,
  isExistingReviewed31Formation,
  reviewedReferenceSupportContinuity32,
  reviewedGenericReferenceContinuity33,
} from '../gameDataPacks/reviewedReferenceSupportContinuity32'
import { current31VariantRealityProfileSet } from './current31VariantRealityProfile'
import {
  current31StrengthGoldSet,
  current31ReviewedStrengthEvidence,
  resolveCurrent31StrengthGoldTeamCalibration,
} from './current31StrengthGoldSet'
import {
  classifyCurrent31VariantRealityProfile,
  resolveCurrent31TeamRealityProfile,
} from './current31VariantRealityProfile'
import {
  reviewedTeamPublishedStrength,
  resolveReviewedTeamPublishedStrength,
} from './reviewedTeamPublishedStrength'
import {
  reviewedTeamAnalysis,
  reviewedCurrentTeamAnalysis32,
  resolveReviewedCurrentTeamAnalysis,
  resolveReviewedTeamAnalysis,
  hasReviewedCurrentTeamSourceBinding,
  type ReviewedTeamAnalysis,
} from './reviewedTeamAnalysis'
import { teamRecommendationScore, teamRecommendationScorePolicy } from './teamRecommendationScore'
import {
  inferredStrengthCalibration,
  teamStrengthModelPolicy,
  type TeamStrengthInference,
} from './teamStrengthModel'

export const current31TeamStrengthCalibrationContractId =
  'soda-current-3.1-team-strength-calibration/v1' as const

const calibrationBandProjection: Record<CurrentMetaStrengthBand, TeamRatingBand> = {
  apex: 'S',
  meta: 'A+',
  viable: 'B',
}

const legacyDiagnosticByFormationKey = new Map(
  current31TeamEngineD1Pack.kernels.flatMap((kernel) => {
    const definition = current31MetaStrengthR1.kernelBands.find(
      (item) => item.kernelId === kernel.kernelId,
    )
    if (!definition) throw new Error(`3.1 校准集缺少 kernel：${kernel.kernelId}`)
    return kernel.eligibleThirdAgentIds.map(
      (thirdAgentId) =>
        [
          formationKey([...kernel.coreAgentIds, thirdAgentId]),
          {
            kernelId: kernel.kernelId,
            familyId: kernel.familyId,
            evidenceRefs: definition.refs.map((item) => item.sourceId),
          },
        ] as const,
    )
  }),
)

export type Current31MechanicValidity = 'invalid' | 'partial' | 'valid' | 'excellent'

export function resolveCurrent31LegacyCalibrationDiagnostic(
  memberIds: readonly [string, string, string],
) {
  return legacyDiagnosticByFormationKey.get(formationKey(memberIds)) ?? null
}

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

export function deriveCurrent31MechanicValidity(
  vector: TeamFeatureVector,
): Current31MechanicValidity {
  if (vector.hardPrunes.length) return 'invalid'
  const band = (dimension: TeamFeatureVector['dimensions'][number]['dimension']) =>
    vector.dimensions.find((item) => item.dimension === dimension)?.band
  const mechanic = band('mechanic_synergy')
  const cycle = band('cycle_stability')
  const effects = band('team_effect_quality')
  // Weak synergy can mean optional bonuses are inactive or resource tags are
  // incomplete. Only an explicit hard prune proves a formation impossible.
  if (mechanic === 'weak' || cycle === 'weak') return 'partial'
  if (mechanic === 'unknown' || mechanic === 'mixed' || cycle === 'unknown' || cycle === 'mixed')
    return 'partial'
  if (mechanic === 'excellent' && cycle === 'excellent' && effects === 'excellent')
    return 'excellent'
  return 'valid'
}

const continuitySourceHashes = [
  ['strengthGold', stableContentHash(current31StrengthGoldSet)],
  ['realityProfiles', stableContentHash(current31VariantRealityProfileSet)],
  ['publishedStrength', stableContentHash(reviewedTeamPublishedStrength)],
  ['editorialAnalysis', stableContentHash(reviewedTeamAnalysis)],
] as const

export type TeamStrengthEvidenceMode = 'source_reference' | 'independent_evaluation'

export function resolveCurrent31MetaCalibration(input: {
  memberIds: readonly [string, string, string]
  bangbooId: string | null
  predictedRating: TeamRatingResult
  benchmark: BenchmarkEvidence
  sourceReviewVersion?: '3.1'
  /** Blind evaluation excludes every exact-team source/label projection. */
  evidenceMode?: TeamStrengthEvidenceMode
}): Current31MetaCalibration {
  if (input.evidenceMode === 'independent_evaluation')
    return {
      contract: current31TeamStrengthCalibrationContractId,
      status: 'insufficient',
      authority: 'none',
      kernelId: null,
      familyId: null,
      versionPosition: null,
      projectedStrengthBand: null,
      evidenceRefs: [],
      explanation: '独立评价隔离来源标签；来源档位、Reality Profile 和历史兼容均不作为预测。',
    }
  const targetVersion = input.sourceReviewVersion ?? currentVersionProjection.gameVersion
  const continued =
    isExistingReviewed31Formation(input.memberIds) &&
    continuitySourceHashes.every(([sourceKind, sourceContentHash]) =>
      canApplyReviewedReferenceSupport32({
        targetVersion,
        sourceReviewVersion: '3.1',
        sourceKind,
        sourceContentHash,
      }),
    )
  const sourceProjection = (sourceStrengthBand: TeamRatingBand, useContinuity = continued) => {
    const mechanicBand =
      input.predictedRating.status === 'rated' ? input.predictedRating.ratingBand : null
    return {
      ...(useContinuity
        ? {
            referenceContinuity:
              targetVersion === '3.3'
                ? reviewedGenericReferenceContinuity33
                : reviewedReferenceSupportContinuity32,
          }
        : {}),
      // The mechanism gate must be usable; equality with its legacy categorical
      // grade is not a strength-calibration gate (SPEC 4.12.2).
      status: mechanicBand === null ? ('calibration_violation' as const) : ('aligned' as const),
      mechanicBandComparison: {
        mechanicBand,
        sourceStrengthBand,
        relation:
          mechanicBand === null
            ? ('unrated' as const)
            : mechanicBand === sourceStrengthBand
              ? ('same' as const)
              : ('different' as const),
        use: 'diagnostic_only' as const,
      },
    }
  }
  const reviewVersion = continued ? '3.1' : targetVersion
  const legacyEvidenceIsCurrent = reviewVersion === '3.1'
  const strengthGold = legacyEvidenceIsCurrent
    ? resolveCurrent31StrengthGoldTeamCalibration(input.memberIds)
    : null
  if (strengthGold) {
    const projectedStrengthBand = calibrationBandProjection[strengthGold.band]
    return {
      contract: current31TeamStrengthCalibrationContractId,
      ...sourceProjection(projectedStrengthBand),
      authority: 'strength_gold',
      kernelId: null,
      familyId: null,
      versionPosition: strengthGold.band,
      projectedStrengthBand,
      evidenceRefs: [
        ...new Set([
          ...strengthGold.evidenceRefs,
          ...current31ReviewedStrengthEvidence(input.memberIds),
        ]),
      ],
      explanation: '该精确三人命中 3.1 来源强度粗档；邦布独立评价，不影响三人档位、置信度或排序。',
    }
  }
  const realityProfile = legacyEvidenceIsCurrent
    ? resolveCurrent31TeamRealityProfile(input.memberIds)
    : null
  if (realityProfile) {
    const projectedStrengthBand = classifyCurrent31VariantRealityProfile(realityProfile)
    const versionPosition =
      projectedStrengthBand === 'S' ? 'apex' : projectedStrengthBand === 'A+' ? 'meta' : 'viable'
    return {
      contract: current31TeamStrengthCalibrationContractId,
      ...sourceProjection(projectedStrengthBand),
      authority: 'variant_reality_profile',
      kernelId: null,
      familyId: null,
      versionPosition,
      projectedStrengthBand,
      evidenceRefs: [
        ...new Set([
          ...realityProfile.evidenceRefs,
          ...current31ReviewedStrengthEvidence(input.memberIds),
        ]),
      ],
      explanation: `该精确三人依据 ${realityProfile.guideStanding}/${realityProfile.realityStanding} 的来源化类别事实进入公开规则；邦布不参与三人定档。`,
    }
  }
  const published = resolveReviewedTeamPublishedStrength(input.memberIds, reviewVersion)
  if (published.status === 'conflict')
    return {
      contract: current31TeamStrengthCalibrationContractId,
      status: 'insufficient',
      authority: 'single_publisher_tier',
      evidenceStatus: 'conflict',
      kernelId: null,
      familyId: null,
      versionPosition: null,
      projectedStrengthBand: null,
      evidenceRefs: published.evidenceRefs,
      explanation: published.explanation,
    }
  if (
    published.status === 'supported' &&
    published.band &&
    recognitionIndex(reviewVersion).has(formationKey(input.memberIds))
  ) {
    const projectedStrengthBand = published.band
    return {
      contract: current31TeamStrengthCalibrationContractId,
      ...sourceProjection(projectedStrengthBand),
      authority: 'single_publisher_tier',
      evidenceStatus: 'supported',
      confidenceCeiling: 'low',
      kernelId: null,
      familyId: null,
      versionPosition:
        projectedStrengthBand === 'S' ? 'apex' : projectedStrengthBand === 'A+' ? 'meta' : 'viable',
      projectedStrengthBand,
      evidenceRefs: published.evidenceRefs,
      explanation: published.explanation,
    }
  }
  const currentAnalysis = input.sourceReviewVersion
    ? null
    : resolveReviewedCurrentTeamAnalysis(input.memberIds, targetVersion)
  const analysis = currentAnalysis ?? resolveReviewedTeamAnalysis(input.memberIds, reviewVersion)
  const analysisVersion = currentAnalysis ? targetVersion : reviewVersion
  const recognized = recognitionIndex(analysisVersion).get(formationKey(input.memberIds))
  const currentAnalysisSources = currentAnalysis
    ? currentReviewedTeamSourceDirections(analysisVersion).find(
        (row) => formationKey(row.memberIds) === formationKey(input.memberIds),
      )?.sourceRefs
    : undefined
  const sourceBindingCurrent =
    !currentAnalysis || hasReviewedCurrentTeamSourceBinding(currentAnalysis, currentAnalysisSources)
  if (
    analysis &&
    sourceBindingCurrent &&
    (currentAnalysis?.mechanicReview ||
      (recognized &&
        !recognized.historicalReferenceOnly &&
        analysis.evidenceRefs.some((ref) => recognized.evidenceRefs.includes(ref.url))))
  ) {
    return {
      contract: current31TeamStrengthCalibrationContractId,
      ...sourceProjection(analysis.band, !currentAnalysis && continued),
      authority: 'local_editorial_estimate',
      confidenceCeiling: 'low',
      analysis,
      kernelId: null,
      familyId: null,
      versionPosition: null,
      projectedStrengthBand: analysis.band,
      evidenceRefs: analysis.evidenceRefs.map((ref) => ref.url),
      explanation: `分析评级 ${analysis.band} · 低置信度。${analysis.rationale} 适用条件：${analysis.conditions.join('；')}`,
    }
  }
  const definition = resolveCurrent31LegacyCalibrationDiagnostic(input.memberIds)
  if (!definition)
    return {
      contract: current31TeamStrengthCalibrationContractId,
      status: 'insufficient',
      authority: 'none',
      kernelId: null,
      familyId: null,
      versionPosition: null,
      projectedStrengthBand: null,
      evidenceRefs: [],
      explanation: '当前版本没有足够依据为该组合定档；机制成立不等于版本强度已知。',
    }
  return {
    contract: current31TeamStrengthCalibrationContractId,
    status: 'insufficient',
    authority: 'recovered_preliminary',
    ...definition,
    versionPosition: null,
    projectedStrengthBand: null,
    explanation:
      '该精确三人仅命中非产品权威的 legacy kernel 校准；保留 family、kernel 与证据诊断，不输出版本强度。',
  }
}

export function resolveCurrent31RealityCheck(input: {
  memberIds: readonly [string, string, string]
  mechanicValidity: Current31MechanicValidity
  mainstreamRecognition: Current31MainstreamRecognition
  metaCalibration: Current31MetaCalibration
  bangbooId: string | null
  evidenceMode?: TeamStrengthEvidenceMode
}): Current31RealityCheck {
  if (input.mechanicValidity === 'invalid')
    return {
      status: 'mechanic_rejected',
      strengthBand: null,
      confidenceCeiling: 'low',
      referencePerformanceRequiredForCurrentGate: false,
      explanation: '机制硬条件未闭合；现实校准不能覆盖机制无效。',
    }
  const independentEvaluation = input.evidenceMode === 'independent_evaluation'
  const sourceProjectionAvailable =
    !independentEvaluation &&
    input.metaCalibration.status === 'aligned' &&
    [
      'strength_gold',
      'variant_reality_profile',
      'single_publisher_tier',
      'local_editorial_estimate',
    ].includes(input.metaCalibration.authority)
  if (input.metaCalibration.projectedStrengthBand && sourceProjectionAvailable)
    return {
      status: 'calibrated_band_supported',
      strengthBand: input.metaCalibration.projectedStrengthBand,
      confidenceCeiling: input.metaCalibration.confidenceCeiling ?? 'medium',
      referencePerformanceRequiredForCurrentGate: false,
      explanation: input.metaCalibration.explanation,
    }
  if (!independentEvaluation && input.mainstreamRecognition.status === 'confirmed')
    return {
      status: 'mainstream_confirmed_band_unknown',
      strengthBand: null,
      confidenceCeiling: 'low',
      referencePerformanceRequiredForCurrentGate: false,
      explanation:
        '该精确三人已有已审阅配队来源支持，但尚无独立 Band/Partial Order 金标；保持强度 unknown，不得降为 weak，也不得借 Family 评级。',
    }
  return {
    status: 'unconfirmed',
    strengthBand: null,
    confidenceCeiling: 'experimental',
    referencePerformanceRequiredForCurrentGate: false,
    explanation: '当前没有足够的多源现实校准；unknown 只表示证据不足，不代表队伍弱。',
  }
}

export function projectCurrent31TeamStrength(input: {
  memberIds: readonly [string, string, string]
  bangbooId: string | null
  mechanicRating: TeamRatingResult
  featureVector: TeamFeatureVector
  benchmark: BenchmarkEvidence
  /** Offline fit/holdout collection must not read inferred labels. */
  reviewedOnly?: boolean
  /** Explicit immutable source-label version for offline collection only. */
  sourceReviewVersion?: '3.1'
  evidenceMode?: TeamStrengthEvidenceMode
}) {
  const mechanicValidity = deriveCurrent31MechanicValidity(input.featureVector)
  const mainstreamRecognition: Current31MainstreamRecognition =
    input.evidenceMode === 'independent_evaluation'
      ? { status: 'unknown', evidenceRefs: [], explanation: '独立评价不读取来源成员标签。' }
      : resolveCurrent31MainstreamRecognition(
          input.memberIds,
          input.reviewedOnly ? input.sourceReviewVersion : undefined,
        )
  const metaCalibration = inferredStrengthCalibration(
    resolveCurrent31MetaCalibration({
      ...input,
      sourceReviewVersion: input.reviewedOnly ? input.sourceReviewVersion : undefined,
      predictedRating: input.mechanicRating,
    }),
    input.memberIds,
    input.reviewedOnly || mechanicValidity === 'invalid',
    input.evidenceMode === 'independent_evaluation',
  )
  const realityCheck = resolveCurrent31RealityCheck({
    memberIds: input.memberIds,
    mechanicValidity,
    mainstreamRecognition,
    metaCalibration,
    bangbooId: input.bangbooId,
    evidenceMode: input.evidenceMode,
  })
  // Only the resolved product tier supplies the shared reference score.
  // Diagnostic inference and mechanism weights cannot create within-tier rank.
  const score = teamRecommendationScore(realityCheck.strengthBand, input.featureVector)
  metaCalibration.recommendationScore = score ?? undefined
  if (input.mechanicRating.status !== 'rated')
    return {
      mechanicValidity,
      mainstreamRecognition,
      referencePerformance: input.benchmark,
      metaCalibration,
      realityCheck,
      teamStrength: input.mechanicRating,
    }

  let teamStrength: TeamRatingResult
  if (realityCheck.strengthBand) {
    teamStrength = {
      ...input.mechanicRating,
      ratingBand: realityCheck.strengthBand,
      confidence: realityCheck.confidenceCeiling,
      explanation: metaCalibration.explanation,
      tradeoffs: [...input.mechanicRating.tradeoffs, realityCheck.explanation],
    }
  } else {
    teamStrength = {
      ...input.mechanicRating,
      ratingBand: 'Experimental',
      confidence: 'experimental',
      explanation:
        metaCalibration.evidenceStatus === 'conflict'
          ? metaCalibration.explanation
          : realityCheck.status === 'mainstream_confirmed_band_unknown'
            ? '已审阅攻略收录了这支三人队，目前还没有足够依据确定强度档位。'
            : '机制有效性已可判断，目前还没有足够依据确定强度档位。',
      tradeoffs: [...input.mechanicRating.tradeoffs, realityCheck.explanation],
    }
  }
  return {
    mechanicValidity,
    mainstreamRecognition,
    referencePerformance: input.benchmark,
    metaCalibration,
    realityCheck,
    teamStrength,
  }
}

export const current31TeamStrengthCalibrationBoundary = Object.freeze({
  contract: current31TeamStrengthCalibrationContractId,
  evaluationScope: 'generic_team_reference_only' as const,
  specificScenarioPolicy: 'separate_current_scenario_comparison_only' as const,
  historicalLabelPolicy: 'low_confidence_community_prior_not_truth' as const,
  // Requested eligibility target, not an upgrade of any imported source review.
  sourceReviewVersion: currentVersionProjection.gameVersion,
  // Included in Account Decision fingerprints so old status projections go stale.
  mechanicBandComparisonPolicy: 'exact-three-strength-bangboo-independent-v3',
  publishedStrengthFingerprint: stableContentHash(reviewedTeamPublishedStrength),
  localAnalysisFingerprint: reviewedTeamAnalysis.contentHash,
  currentLocalAnalysisFingerprint: reviewedCurrentTeamAnalysis32.contentHash,
  recommendationScorePolicy: teamRecommendationScorePolicy,
  inferencePolicy: teamStrengthModelPolicy,
  referencePerformanceStrengthPolicy: 'diagnostic-only-v1',
  legacyFallbackStrengthPolicy: 'diagnostic-only-v1',
  legacyDiagnosticFormationCount: legacyDiagnosticByFormationKey.size,
  // Compatibility field: this is a source-backed diagnostic count, never a strength-authority count.
  sourceBackedFormationCount: legacyDiagnosticByFormationKey.size,
  strengthGoldCalibrationCaseCount: current31StrengthGoldSet.calibrationCases.length,
  strengthGoldIndependentHoldoutCaseCount: 0,
  strengthGoldLegacyDiagnosticHoldoutCaseCount:
    current31StrengthGoldSet.independentHoldoutCases.length,
  mainstreamRecognitionFormationCount: recognitionIndex(currentVersionProjection.gameVersion).size,
  reviewedTeamSourceFingerprint: stableContentHash(currentReviewedTeamSourceDirections()),
  reviewedTeamCompatibilityFingerprint: stableContentHash(currentReviewedTeamCompatibilityNotes()),
  recoveredCalibrationLineage: current31MetaStrengthR1Lineage,
  versionPositions: ['apex', 'meta', 'viable'] as const,
  boundary:
    '105条历史档位保留原来源身份，当前本地粗档另绑定版本及精确来源内容；二者均不冒充独立真值。评级回答泛用组队价值，不吸收式舆、危局、当期Buff或特定Boss排序。同档缺少有据偏序时同分，统一参考分不读取机制权重、置信度或场景拟合结果；独立质量指标保留研究身份。',
})
