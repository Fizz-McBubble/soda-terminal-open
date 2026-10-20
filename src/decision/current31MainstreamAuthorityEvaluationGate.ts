import { current31IndependentConsensusGoldSetEvaluation } from './current31IndependentConsensusGoldSetEvaluation'
import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'
import { current31BlindMetaHoldout } from './current31BlindMetaHoldout'
import { current31ProductionPartialOrder } from './current31ProductionPartialOrder'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'

export const current31MainstreamAuthorityEvaluationGateContractId =
  'soda-current-3.1-mainstream-authority-evaluation-gate/v3' as const

export const current31MainstreamAuthorityEvaluationTargets = Object.freeze({
  topKRecall: 0.97,
  highConfidencePairwise: 0.95,
  bandAgreement: 0.95,
  mainstreamUnknownRatioMaximum: 0.05,
} as const)

const sourceAdoptionAudit = Object.freeze([
  Object.freeze({
    sourceId: 'icy-veins-deadly-assault-2026-08-28',
    url: 'https://www.icy-veins.com/zenless-zone-zero/deadly-assault',
    sourceVersion: '3.1' as const,
    currentForTarget: false as const,
    captureStatus: 'legacy_not_refrozen' as const,
    observedGrain: 'exact_3_agent_plus_bangboo_plus_boss_or_scenario',
    disposition: 'historical_reality_check_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'gamevika-3.1-teams',
    url: 'https://gamevika.com/en/zzz/teams',
    sourceVersion: '3.1' as const,
    currentForTarget: false as const,
    captureStatus: 'legacy_not_refrozen' as const,
    observedGrain: 'exact_3_agent_plus_current_team_tier',
    disposition: 'historical_meta_calibration_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'hostedgg-3.1-team-tier-list',
    url: 'https://hostedgg.com/blog/zzz-3-1-best-teams-tier-list',
    sourceVersion: '3.1' as const,
    currentForTarget: false as const,
    captureStatus: 'legacy_not_refrozen' as const,
    observedGrain: 'exact_3_agent_plus_current_team_tier',
    disposition: 'historical_meta_calibration_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'game8-3.1-best-team-comps',
    url: 'https://game8.co/games/Zenless-Zone-Zero/archives/458656',
    sourceVersion: '3.1' as const,
    currentForTarget: false as const,
    captureStatus: 'legacy_not_refrozen' as const,
    observedGrain: 'exact_3_agent_team_recommendation',
    disposition: 'historical_team_viability_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'prydwen-3.1-tier-list',
    url: 'https://www.prydwen.gg/zenless/tier-list',
    sourceVersion: '3.1' as const,
    currentForTarget: false as const,
    captureStatus: 'legacy_not_refrozen' as const,
    observedGrain: 'agent_role_tier_plus_current_mode_context',
    disposition: 'historical_meta_context_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'hostedgg-3.2-team-tier-list',
    url: 'https://hostedgg.com/blog/zenless-zone-zero-3-2-best-teams-tier-list',
    sourceVersion: '3.2' as const,
    currentForTarget: true as const,
    captureStatus: 'metadata_only' as const,
    checkedAt: '2026-10-19' as const,
    observedGrain: 'exact_team_or_named_core_plus_coarse_team_tier',
    disposition: 'unfrozen_team_tier_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'zzz-build-3.2-most-used-teams',
    url: 'https://www.zzz-build.com/fr/best-teams',
    sourceVersion: '3.2' as const,
    currentForTarget: true as const,
    captureStatus: 'metadata_only' as const,
    checkedAt: '2026-10-19' as const,
    observedGrain: 'exact_3_agent_plus_usage_rank_and_average_score',
    disposition: 'unfrozen_scenario_performance_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'zzz-build-remielle-3.2-teams',
    url: 'https://www.zzz-build.com/agents/remielle/teams',
    sourceVersion: '3.2' as const,
    currentForTarget: true as const,
    captureStatus: 'metadata_only' as const,
    checkedAt: '2026-10-19' as const,
    observedGrain: 'exact_3_agent_plus_publisher_team_rank',
    disposition: 'unfrozen_exact_team_rank_candidate' as const,
  }),
])

const liveSourceInventory = Object.freeze({
  sourceGameVersion: '3.1' as const,
  currentForTarget: false as const,
  current32CandidateSourceCount: 3,
  current32FrozenIndependentLabelCount: 0,
  firecrawlCliVersion: '1.19.26',
  capturedAt: '2026-09-02T12:35:00Z',
  exactTeamBangbooScenarioCandidateCount: 25,
  exactTeamTierCandidateCount: 28,
  exactIdentityCrossSourceBandCompositeCount: 5,
  nonDuplicateCrossBandPairCandidateCount: 4,
  sameRowAllRequiredFieldsCount: 0,
  researchJobId: '01a0621c-b399-752c-bebc-99802e91460d',
  currentGameVikaScrapeId: current31BlindMetaHoldout.sourceSnapshot.scrapeId,
  currentGameVikaSnapshotHash: current31BlindMetaHoldout.sourceSnapshot.sourceContentHash,
})

const recognitionEvaluation = current31IndependentConsensusGoldSetEvaluation
const knownSetConsistency = recognitionEvaluation.knownSetConsistency
const independentTopK = recognitionEvaluation.independentTopK
const independentBlindQuality = current31BlindMetaHoldout.independentQualityEvaluation
const currentVersionAligned =
  current31BlindMetaHoldout.gameVersion === currentVersionProjection.gameVersion &&
  current31IndependentConsensusGoldSet.gameVersion === currentVersionProjection.gameVersion
const independentMetricExclusionReasons = Object.freeze([
  ...(independentBlindQuality.excludedExposedCaseCount > 0
    ? ['legacy_labels_already_exposed']
    : []),
  ...(currentVersionAligned ? [] : ['current_target_version_not_aligned']),
  ...(current31BlindMetaHoldout.predictionFreezeVerified
    ? []
    : ['prediction_outcome_freeze_not_verified']),
])

const gateChecks = Object.freeze([
  Object.freeze({
    checkId: 'versioned_evidence_continuity' as const,
    status: 'pass' as const,
    evidence:
      '历史机制与 Formation claim 先检查 Patch Delta；未受影响时继承，只有受影响字段进入复核或失效。',
  }),
  Object.freeze({
    checkId: 'claim_specific_grain' as const,
    status: 'pass' as const,
    evidence:
      '三人强度以 exact 3-agent 为最小粒度；邦布推荐和场景表现分别提高到 team+Bangboo 与 team+scenario，不反向否定三人强度。',
  }),
  Object.freeze({
    checkId: 'mainstream_recognition_holdout' as const,
    status: 'not_evaluated' as const,
    evidence: `${knownSetConsistency.recognizedCount}/${knownSetConsistency.caseCount} is known-set consistency only: production and evaluation share the same membership identity, so no independent Top-K denominator exists.`,
  }),
  Object.freeze({
    checkId: 'blind_band_label_independence' as const,
    status: independentBlindQuality.bandAgreement.status,
    evidence: `${current31BlindMetaHoldout.labelLeakCount}/${current31BlindMetaHoldout.bandCaseCount} legacy exact-team labels were already exposed to current authorities/training. ${current31BlindMetaHoldout.alignedBandCount}/${current31BlindMetaHoldout.bandCaseCount} remains source-reference regression only; the independent Band metric uses ${independentBlindQuality.bandAgreement.numerator}/${independentBlindQuality.bandAgreement.denominator} effective label-independent predictions.`,
  }),
  Object.freeze({
    checkId: 'blind_pairwise_label_independence' as const,
    status: independentBlindQuality.pairwiseConsistency.status,
    evidence: `${current31BlindMetaHoldout.pairwiseRelationCount} legacy relations derive from already-seen exact-team labels. ${current31BlindMetaHoldout.alignedPairwiseCount}/${current31BlindMetaHoldout.pairwiseRelationCount} remains diagnostic; the independent Pairwise metric uses ${independentBlindQuality.pairwiseConsistency.numerator}/${independentBlindQuality.pairwiseConsistency.denominator} comparable effective predictions, and the ${current31ProductionPartialOrder.relationCount} production relations remain excluded.`,
  }),
  Object.freeze({
    checkId: 'mainstream_unknown_ceiling' as const,
    status: independentBlindQuality.mainstreamUnknownRatio.status,
    evidence: `The ${knownSetConsistency.caseCount}-row known-set consistency has no independent mainstream denominator. The independent Unknown metric uses ${independentBlindQuality.mainstreamUnknownRatio.numerator}/${independentBlindQuality.mainstreamUnknownRatio.denominator} label-independent cases.`,
  }),
])

export const current31MainstreamAuthorityEvaluationGate = Object.freeze({
  contract: current31MainstreamAuthorityEvaluationGateContractId,
  gameVersion: '3.1',
  targetGameVersion: currentVersionProjection.gameVersion,
  intendedGrain: 'claim_specific_versioned_evidence' as const,
  status: gateChecks.every((check) => check.status === 'pass')
    ? ('ready_for_product_evaluation' as const)
    : ('incomplete_versioned_evidence_evaluation' as const),
  targets: current31MainstreamAuthorityEvaluationTargets,
  claimGrains: Object.freeze({
    mechanicTruth: 'agent_or_mechanic',
    formationTruth: 'pair_family_or_exact_3_agent',
    teamStrength: 'exact_3_agent',
    bangbooSuitability: 'exact_3_agent_plus_bangboo',
    scenarioReality: 'exact_team_plus_scenario',
    currentMetaPosition: 'team_or_family_plus_current_meta_context',
  }),
  evaluationSets: Object.freeze({
    currentVersion: {
      targetGameVersion: currentVersionProjection.gameVersion,
      bandLabelGameVersion: current31BlindMetaHoldout.gameVersion,
      mainstreamLabelGameVersion: current31IndependentConsensusGoldSet.gameVersion,
      status: currentVersionAligned ? ('aligned' as const) : ('legacy_source_not_current' as const),
      independentCurrentVersionLabelCaseCount: currentVersionAligned
        ? independentBlindQuality.evaluationEligibleCaseCount
        : 0,
    },
    canonicalGold: {
      caseCount: current31StrengthGoldSet.cases.length,
      role: 'calibration_and_diagnostic_only' as const,
    },
    blindOrTemporalHoldout: {
      recognitionCaseCount: 0,
      bandCaseCount: independentBlindQuality.bandAgreement.denominator,
      pairwiseRelationCount: independentBlindQuality.pairwiseConsistency.denominator,
    },
    knownSetConsistency: {
      caseCount: knownSetConsistency.caseCount,
      recognizedCount: knownSetConsistency.recognizedCount,
      recognitionRatio: knownSetConsistency.recognitionRatio,
      constructionDependency: recognitionEvaluation.constructionDependency.status,
    },
    realityCheck: {
      liveExactTeamBangbooScenarioCandidateCount:
        liveSourceInventory.exactTeamBangbooScenarioCandidateCount,
      role: 'current_environment_drift_detection' as const,
    },
  }),
  inventory: Object.freeze({
    canonicalGoldCaseCount: current31StrengthGoldSet.cases.length,
    canonicalCalibrationCaseCount: current31StrengthGoldSet.calibrationCases.length,
    legacyDiagnosticCaseCount: current31StrengthGoldSet.independentHoldoutCases.length,
    productionPairwiseRelationCount: current31ProductionPartialOrder.relationCount,
    blindBandHoldoutCaseCount: current31BlindMetaHoldout.independentBandCaseCount,
    blindPairwiseHoldoutRelationCount: current31BlindMetaHoldout.independentPairwiseRelationCount,
    labelIndependentBandCaseCount: independentBlindQuality.labelIndependentCaseCount,
    acceptanceEligibleBandCaseCount: independentBlindQuality.evaluationEligibleCaseCount,
    excludedUnfrozenBandCaseCount: independentBlindQuality.excludedUnfrozenCaseCount,
    independentUnknownCaseCount: independentBlindQuality.unknownPredictionCaseCount,
    exposedBandDiagnosticCaseCount: current31BlindMetaHoldout.bandCaseCount,
    exposedPairwiseDiagnosticRelationCount: current31BlindMetaHoldout.pairwiseRelationCount,
    liveSourceInventory,
  }),
  metrics: Object.freeze({
    topKRecall: independentTopK.observed,
    highConfidencePairwise: independentBlindQuality.pairwiseConsistency.observed,
    bandAgreement: independentBlindQuality.bandAgreement.observed,
    mainstreamUnknownRatio: independentBlindQuality.mainstreamUnknownRatio.observed,
  }),
  metricStatus: Object.freeze({
    topKRecall: independentTopK.status,
    highConfidencePairwise: independentBlindQuality.pairwiseConsistency.status,
    bandAgreement: independentBlindQuality.bandAgreement.status,
    mainstreamUnknownRatio: independentBlindQuality.mainstreamUnknownRatio.status,
  }),
  metricEvidence: Object.freeze({
    topKRecall: {
      target: current31MainstreamAuthorityEvaluationTargets.topKRecall,
      numerator: independentTopK.status === 'not_evaluated' ? null : independentTopK.observed,
      denominator: 0,
      status: independentTopK.status,
      excludedKnownSetCaseCount: knownSetConsistency.caseCount,
      exclusionReasons: [
        'production_and_evaluation_share_membership_identity',
        'legacy_labels_already_exposed',
        'no_unseen_current_version_membership_labels',
      ],
      unassessedDomain: 'current_version_independent_exact_3_agent_membership',
    },
    highConfidencePairwise: {
      target: current31MainstreamAuthorityEvaluationTargets.highConfidencePairwise,
      numerator: independentBlindQuality.pairwiseConsistency.numerator,
      denominator: independentBlindQuality.pairwiseConsistency.denominator,
      status: independentBlindQuality.pairwiseConsistency.status,
      excludedExposedCaseCount: independentBlindQuality.excludedExposedCaseCount,
      excludedUnfrozenCaseCount: independentBlindQuality.excludedUnfrozenCaseCount,
      exclusionReasons: independentMetricExclusionReasons,
      unassessedDomain: 'current_version_independent_cross_band_relations',
    },
    bandAgreement: {
      target: current31MainstreamAuthorityEvaluationTargets.bandAgreement,
      numerator: independentBlindQuality.bandAgreement.numerator,
      denominator: independentBlindQuality.bandAgreement.denominator,
      status: independentBlindQuality.bandAgreement.status,
      excludedExposedCaseCount: independentBlindQuality.excludedExposedCaseCount,
      excludedUnfrozenCaseCount: independentBlindQuality.excludedUnfrozenCaseCount,
      exclusionReasons: independentMetricExclusionReasons,
      unassessedDomain: 'current_version_independent_coarse_band_alignment',
    },
    mainstreamUnknownRatio: {
      target: current31MainstreamAuthorityEvaluationTargets.mainstreamUnknownRatioMaximum,
      numerator: independentBlindQuality.mainstreamUnknownRatio.numerator,
      denominator: independentBlindQuality.mainstreamUnknownRatio.denominator,
      status: independentBlindQuality.mainstreamUnknownRatio.status,
      excludedExposedCaseCount: independentBlindQuality.excludedExposedCaseCount,
      excludedUnfrozenCaseCount: independentBlindQuality.excludedUnfrozenCaseCount,
      exclusionReasons: independentMetricExclusionReasons,
      unassessedDomain: 'current_version_independent_mainstream_unknown_ratio',
    },
  }),
  gateChecks,
  blindMetaHoldout: current31BlindMetaHoldout,
  sourceAdoptionAudit,
  boundary:
    '当前版本不等于只接受当前版本新证据。历史机制与 Formation claim 按字段检查后保留，不由此证明当前标准条件的 Meta 正确。现有 Band 与 mainstream membership 标签源均为 3.1，而产品目标为 3.2，不能直接继承为当前独立质量分母。30 条 membership 与旧四条 Band、五条派生 Pairwise 都已暴露于当前 authority 或训练标签路径，只保留 known-set/diagnostic regression；URL 未引用不能证明整链独立。独立执行隔离 prior 标签，但旧标签不能当作新冻结预测解盲证据；新分母还必须证明案例/结果先冻结、预测随后冻结、最后解盲。Top-K、Band、Pairwise 与 mainstream Unknown 当前均为 not_evaluated。外部榜单不进入公式、隐藏角色分或生产全序。',
})
