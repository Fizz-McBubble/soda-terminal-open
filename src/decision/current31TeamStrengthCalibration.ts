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
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'
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
  resolveReviewedTeamAnalysis,
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

function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

const mainstreamRecognitionByFormationKey = new Map(
  currentReviewedTeamSourceDirections().map((item) => [
    formationKey(item.memberIds),
    {
      evidenceRefs: item.sourceRefs.map((ref) => ref.url),
      conditions: [...item.conditions],
      sourceBangbooOptionIds: [...(item.sourceBangbooOptionIds ?? [])],
      historicalReferenceOnly: item.sourceRefs.every(
        (ref) => ref.verificationStatus === 'historical_membership_reference',
      ),
    },
  ]),
)

const compatibilityNotesByFormationKey = new Map(
  currentReviewedTeamCompatibilityNotes().map((item) => [formationKey(item.memberIds), item]),
)

export type Current31MainstreamRecognition = {
  status: 'confirmed' | 'unknown'
  evidenceRefs: string[]
  explanation: string
  conditions?: string[]
  sourceBangbooOptionIds?: string[]
  historicalReferenceOnly?: boolean
}

export function resolveCurrent31MainstreamRecognition(
  memberIds: readonly [string, string, string],
): Current31MainstreamRecognition {
  const recognized = mainstreamRecognitionByFormationKey.get(formationKey(memberIds))
  const note = compatibilityNotesByFormationKey.get(formationKey(memberIds))
  const conditions = [...new Set([...(recognized?.conditions ?? []), ...(note?.conditions ?? [])])]
  const evidenceRefs = [
    ...new Set([
      ...(recognized?.evidenceRefs ?? []),
      ...(note?.sourceRefs.map((ref) => ref.url) ?? []),
    ]),
  ]
  return recognized
    ? {
        status: 'confirmed',
        evidenceRefs,
        conditions,
        sourceBangbooOptionIds: [...recognized.sourceBangbooOptionIds],
        historicalReferenceOnly: recognized.historicalReferenceOnly,
        explanation:
          '当前已审阅配队来源收录该精确三人搭配；这只支持候选可达，不提供强度档位或排序。',
      }
    : {
        status: 'unknown',
        evidenceRefs,
        conditions,
        explanation: note
          ? '来源讨论了该组合的适用性限制，未据此确认它为推荐方向。'
          : '当前来源化主流识别目录未确认该精确三人组合；unknown 不等于 weak。',
      }
}

// Recovered kernel bands are provenance diagnostics only. They cannot project a
// product Team Strength for every eligible third-member expansion.
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
  inference?: TeamStrengthInference
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

export function resolveCurrent31MetaCalibration(input: {
  memberIds: readonly [string, string, string]
  bangbooId: string | null
  predictedRating: TeamRatingResult
  benchmark: BenchmarkEvidence
}): Current31MetaCalibration {
  const sourceProjection = (sourceStrengthBand: TeamRatingBand) => {
    const mechanicBand =
      input.predictedRating.status === 'rated' ? input.predictedRating.ratingBand : null
    return {
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
  const legacyEvidenceIsCurrent = currentReleasedIdentityMap.gameVersion === '3.1'
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
  const published = resolveReviewedTeamPublishedStrength(input.memberIds)
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
    mainstreamRecognitionByFormationKey.has(formationKey(input.memberIds))
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
  const analysis = resolveReviewedTeamAnalysis(input.memberIds)
  const recognized = mainstreamRecognitionByFormationKey.get(formationKey(input.memberIds))
  if (
    analysis &&
    recognized &&
    !recognized.historicalReferenceOnly &&
    analysis.evidenceRefs.some((ref) => recognized.evidenceRefs.includes(ref.url))
  ) {
    return {
      contract: current31TeamStrengthCalibrationContractId,
      ...sourceProjection(analysis.band),
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
}): Current31RealityCheck {
  if (input.mechanicValidity === 'invalid')
    return {
      status: 'mechanic_rejected',
      strengthBand: null,
      confidenceCeiling: 'low',
      referencePerformanceRequiredForCurrentGate: false,
      explanation: '机制硬条件未闭合；现实校准不能覆盖机制无效。',
    }
  const sourceProjectionAvailable = input.metaCalibration.status === 'aligned'
  if (input.metaCalibration.projectedStrengthBand && sourceProjectionAvailable)
    return {
      status: 'calibrated_band_supported',
      strengthBand: input.metaCalibration.projectedStrengthBand,
      confidenceCeiling: input.metaCalibration.confidenceCeiling ?? 'medium',
      referencePerformanceRequiredForCurrentGate: false,
      explanation: input.metaCalibration.explanation,
    }
  if (input.mainstreamRecognition.status === 'confirmed')
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
}) {
  const mechanicValidity = deriveCurrent31MechanicValidity(input.featureVector)
  const mainstreamRecognition = resolveCurrent31MainstreamRecognition(input.memberIds)
  const metaCalibration = inferredStrengthCalibration(
    resolveCurrent31MetaCalibration({ ...input, predictedRating: input.mechanicRating }),
    input.memberIds,
    input.reviewedOnly || mechanicValidity === 'invalid',
  )
  const realityCheck = resolveCurrent31RealityCheck({
    memberIds: input.memberIds,
    mechanicValidity,
    mainstreamRecognition,
    metaCalibration,
    bangbooId: input.bangbooId,
  })
  const score =
    metaCalibration.inference?.score ??
    teamRecommendationScore(realityCheck.strengthBand, input.featureVector)
  if (score !== null) metaCalibration.recommendationScore = score
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
  // Included in Account Decision fingerprints so old status projections go stale.
  mechanicBandComparisonPolicy: 'exact-three-strength-bangboo-independent-v3',
  publishedStrengthFingerprint: stableContentHash(reviewedTeamPublishedStrength),
  localAnalysisFingerprint: reviewedTeamAnalysis.contentHash,
  recommendationScorePolicy: teamRecommendationScorePolicy,
  inferencePolicy: teamStrengthModelPolicy,
  referencePerformanceStrengthPolicy: 'diagnostic-only-v1',
  legacyFallbackStrengthPolicy: 'diagnostic-only-v1',
  legacyDiagnosticFormationCount: legacyDiagnosticByFormationKey.size,
  // Compatibility field: this is a source-backed diagnostic count, never a strength-authority count.
  sourceBackedFormationCount: legacyDiagnosticByFormationKey.size,
  strengthGoldCalibrationCaseCount: current31StrengthGoldSet.calibrationCases.length,
  strengthGoldIndependentHoldoutCaseCount: current31StrengthGoldSet.independentHoldoutCases.length,
  mainstreamRecognitionFormationCount: mainstreamRecognitionByFormationKey.size,
  reviewedTeamSourceFingerprint: stableContentHash(currentReviewedTeamSourceDirections()),
  reviewedTeamCompatibilityFingerprint: stableContentHash(currentReviewedTeamCompatibilityNotes()),
  recoveredCalibrationLineage: current31MetaStrengthR1Lineage,
  versionPositions: ['apex', 'meta', 'viable'] as const,
  boundary:
    '当前版本的精确三人编辑校准优先，其次为公开整队档位，最后是低置信本地分析。发布方分歧不以本地分析覆盖；不依赖邦布，旧版本不自动继承。legacy kernel 与 Reference Performance 仅保留诊断；百分制为粗档内的推荐指数，不是连续强度或伤害测量。',
})
