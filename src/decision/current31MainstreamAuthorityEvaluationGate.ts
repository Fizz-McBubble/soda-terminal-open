import { current31IndependentConsensusGoldSetEvaluation } from './current31IndependentConsensusGoldSetEvaluation'
import { current31BlindMetaHoldout } from './current31BlindMetaHoldout'
import { current31ProductionPartialOrder } from './current31ProductionPartialOrder'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'

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
    observedGrain: 'exact_3_agent_plus_bangboo_plus_boss_or_scenario',
    disposition: 'reality_check_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'gamevika-3.1-teams',
    url: 'https://gamevika.com/en/zzz/teams',
    observedGrain: 'exact_3_agent_plus_current_team_tier',
    disposition: 'current_meta_calibration_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'hostedgg-3.1-team-tier-list',
    url: 'https://hostedgg.com/blog/zzz-3-1-best-teams-tier-list',
    observedGrain: 'exact_3_agent_plus_current_team_tier',
    disposition: 'current_meta_calibration_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'game8-3.1-best-team-comps',
    url: 'https://game8.co/games/Zenless-Zone-Zero/archives/458656',
    observedGrain: 'exact_3_agent_team_recommendation',
    disposition: 'team_viability_candidate' as const,
  }),
  Object.freeze({
    sourceId: 'prydwen-3.1-tier-list',
    url: 'https://www.prydwen.gg/zenless/tier-list',
    observedGrain: 'agent_role_tier_plus_current_mode_context',
    disposition: 'current_meta_context_candidate' as const,
  }),
])

const liveSourceInventory = Object.freeze({
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
    status:
      current31BlindMetaHoldout.labelIndependent &&
      current31BlindMetaHoldout.bandAgreement >=
        current31MainstreamAuthorityEvaluationTargets.bandAgreement
        ? ('pass' as const)
        : ('fail' as const),
    evidence: `${current31BlindMetaHoldout.alignedBandCount}/${current31BlindMetaHoldout.bandCaseCount} row-level label-independent Band rows aligned across Apex/Meta/Viable; production evidence reads none of the final GameVika label rows.`,
  }),
  Object.freeze({
    checkId: 'blind_pairwise_label_independence' as const,
    status:
      current31BlindMetaHoldout.labelIndependent &&
      current31BlindMetaHoldout.pairwiseConsistency >=
        current31MainstreamAuthorityEvaluationTargets.highConfidencePairwise
        ? ('pass' as const)
        : ('fail' as const),
    evidence: `${current31BlindMetaHoldout.alignedPairwiseCount}/${current31BlindMetaHoldout.pairwiseRelationCount} cross-band relations aligned; the existing ${current31ProductionPartialOrder.relationCount} production relations remain excluded from this denominator.`,
  }),
  Object.freeze({
    checkId: 'mainstream_unknown_ceiling' as const,
    status: 'not_evaluated' as const,
    evidence: `The Unknown ratio shares the same ${knownSetConsistency.caseCount}-row construction-dependent identity and therefore has no independent mainstream denominator.`,
  }),
])

export const current31MainstreamAuthorityEvaluationGate = Object.freeze({
  contract: current31MainstreamAuthorityEvaluationGateContractId,
  gameVersion: '3.1',
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
    canonicalGold: {
      caseCount: current31StrengthGoldSet.cases.length,
      role: 'calibration_and_diagnostic_only' as const,
    },
    blindOrTemporalHoldout: {
      recognitionCaseCount: 0,
      bandCaseCount: current31BlindMetaHoldout.bandCaseCount,
      pairwiseRelationCount: current31BlindMetaHoldout.pairwiseRelationCount,
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
    blindBandHoldoutCaseCount: current31BlindMetaHoldout.bandCaseCount,
    blindPairwiseHoldoutRelationCount: current31BlindMetaHoldout.pairwiseRelationCount,
    liveSourceInventory,
  }),
  metrics: Object.freeze({
    topKRecall: independentTopK.observed,
    highConfidencePairwise: current31BlindMetaHoldout.pairwiseConsistency,
    bandAgreement: current31BlindMetaHoldout.bandAgreement,
    mainstreamUnknownRatio: null,
  }),
  metricStatus: Object.freeze({
    topKRecall: independentTopK.status,
    highConfidencePairwise:
      current31BlindMetaHoldout.pairwiseConsistency >=
      current31MainstreamAuthorityEvaluationTargets.highConfidencePairwise
        ? ('pass' as const)
        : ('fail' as const),
    bandAgreement:
      current31BlindMetaHoldout.bandAgreement >=
      current31MainstreamAuthorityEvaluationTargets.bandAgreement
        ? ('pass' as const)
        : ('fail' as const),
    mainstreamUnknownRatio: 'not_evaluated' as const,
  }),
  gateChecks,
  blindMetaHoldout: current31BlindMetaHoldout,
  sourceAdoptionAudit,
  boundary:
    '当前版本不等于只接受当前版本新证据。历史 claim 必须按字段与 claim type 检查 Patch Delta 后继承、复核或失效。Independent Consensus Gold Set 的 30/30 与 production membership identity 同构，只保留为 known-set consistency，Top-K 与 mainstream Unknown 严格为 not_evaluated。Holdout 的硬要求是生产不能读取最终 Band/Pairwise 标签；publisher 或 URL 隔离只是附加证据。本轮使用冻结页面的行级 label split，生产只读 Icy/Prydwen/Biligame Versioned Strength claims，不读四条 GameVika 最终标签。不同 claim 使用不同最小粒度，缺少邦布或场景标签只影响对应子结论。外部榜单不进入公式、隐藏角色分或生产全序。',
})
