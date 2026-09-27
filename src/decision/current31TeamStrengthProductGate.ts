import { l3TeamRecommendationSeeds } from '../gameDataPacks/l3TeamRecommendationSeedProjection'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import {
  current31MetaStrengthR1,
  current31MetaStrengthR1Lineage,
} from '../teamEngine/currentMetaStrengthR1'
import { current31DeadlyAssault313ObservedCalibration } from './current31DeadlyAssault313ObservedCalibration'
import { current31DeadlyAssault313ObservedEvaluation } from './current31DeadlyAssault313ObservedEvaluation'
import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'
import { current31IndependentConsensusGoldSetEvaluation } from './current31IndependentConsensusGoldSetEvaluation'
import { current31MainstreamAuthorityEvaluationGate } from './current31MainstreamAuthorityEvaluationGate'
import { current31ObservedPerformanceDataQuality } from './current31ObservedPerformanceDataQuality'
import { current31BoxReliableGate } from './current31BoxReliableGate'
import { current31ReferencePerformancePilot } from './current31ReferencePerformancePilot'
import { current31ReferencePerformanceSourceAudit } from './current31ReferencePerformanceSourceAudit'
import { current31Shiyu313ObservedCalibration } from './current31Shiyu313ObservedCalibration'
import { current31TeamStrengthObservedEvaluation } from './current31TeamStrengthObservedEvaluation'
import { current31TeamCoreAggregation } from './current31TeamCoreAggregation'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'

export const current31TeamStrengthProductGateContractId =
  'soda-current-3.1-team-strength-product-gate/v2' as const

export type TeamStrengthProductMetricId =
  | 'mainstream_recognition'
  | 'top_k_recall'
  | 'pairwise_consistency'
  | 'band_agreement'
  | 'mainstream_unknown_ratio'
  | 'mechanic_traceability'
  | 'real_combat_calibration'
  | 'account_priority_separation'
  | 'explainability'
  | 'versioned_update_and_rollback'
  | 'unknown_handling'
  | 'team_core_aggregation'
  | 'bangboo_variant_coverage'
  | 'observed_performance_data_quality'

export type TeamStrengthProductMetric = {
  metricId: TeamStrengthProductMetricId
  status: 'pass' | 'fail' | 'not_evaluated'
  observed: number | null
  target: number | null
  unit: 'ratio' | 'count' | 'qualitative'
  explanation: string
}

const constructionSeedIds = [
  'gpt-r2-team-row-5',
  'gpt-r2-team-row-6',
  'gpt-r2-team-row-7',
  'gpt-r2-team-row-8',
  'gpt-r2-team-row-9',
  'gpt-r2-team-row-12',
  'gpt-r2-team-row-13',
  'gpt-r2-team-row-14',
  'gpt-r2-team-row-15',
  'gpt-r2-team-row-16',
  'gpt-r2-team-row-17',
  'gpt-r2-team-row-18',
  'gpt-r2-team-row-19',
  'gpt-r2-team-row-20',
  'gpt-r2-team-row-21',
  'gpt-r2-team-row-22',
  'gpt-r2-team-row-23',
  'gpt-r2-team-row-24',
  'gpt-r2-team-row-25',
  'gpt-r2-team-row-26',
  'gpt-r2-team-row-27',
  'gpt-r2-team-row-28',
  'gpt-r2-team-row-29',
  'gpt-r2-team-row-30',
  'gpt-r2-team-row-31',
  'gpt-r2-team-row-32',
  'gpt-r2-team-row-33',
  'gpt-r2-team-row-35',
  'gpt-r2-team-row-38',
  'gpt-r2-team-row-39',
  'gpt-r2-team-row-42',
  'gpt-r2-team-row-49',
  'gpt-r2-team-row-50',
  'gpt-r2-team-row-54',
  'gpt-r2-team-row-59',
  'gpt-r2-team-row-62',
  'gpt-r2-team-row-63',
] as const

const antiPatternCases = [
  {
    caseId: 'anti-pattern-three-supports-astra-sunna-yuzuha',
    memberIds: ['agent-astra', 'agent-sunna', 'agent-yuzuha'],
    rationale: '缺少可承接支援收益的主要输出位。',
  },
  {
    caseId: 'anti-pattern-three-stunners-qingyi-lycaon-dialyn',
    memberIds: ['agent-qingyi', 'agent-lycaon', 'agent-dialyn'],
    rationale: '多个击破位竞争驻场和失衡职责，缺少窗口承接。',
  },
  {
    caseId: 'anti-pattern-three-rupture-supports-lucia-pan-zhao',
    memberIds: ['agent-lucia', 'agent-pan-yinhu', 'agent-zhao'],
    rationale: '缺少命破主输出，不应因单人机制证据而进入高强度。',
  },
] as const

function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

const seedById = new Map(l3TeamRecommendationSeeds.map((seed) => [seed.seed_id, seed]))
const kernelByFormation = new Map(
  current31TeamEngineD1Pack.kernels.flatMap((kernel) =>
    kernel.eligibleThirdAgentIds.map(
      (thirdAgentId) =>
        [formationKey([...kernel.coreAgentIds, thirdAgentId]), kernel.kernelId] as const,
    ),
  ),
)
const calibrationByKernel = new Map(
  current31MetaStrengthR1.kernelBands.map((entry) => [entry.kernelId, entry]),
)

export const current31TeamStrengthConstructionSet = Object.freeze([
  ...constructionSeedIds.map((seedId) => {
    const seed = seedById.get(seedId)
    if (!seed) throw new Error(`3.1 Team Strength construction set 缺少 seed：${seedId}`)
    const kernelId = kernelByFormation.get(formationKey(seed.member_stable_ids)) ?? null
    const calibration = kernelId ? (calibrationByKernel.get(kernelId) ?? null) : null
    return {
      caseId: seedId,
      memberIds: seed.member_stable_ids,
      sampleClass: 'mainstream_candidate' as const,
      sourceClass: seed.source_class,
      constructionBand: seed.evaluation.non_damage_tier,
      independentCalibrationEligible: calibration !== null,
      calibrationBand: calibration?.band ?? null,
      calibrationEvidenceRefs: calibration?.refs.map((ref) => ref.sourceId) ?? [],
      boundary:
        '该行可用于样本构造和回归编排；只有 independentCalibrationEligible=true 时才能进入现实校准分母。',
    }
  }),
  ...antiPatternCases.map((item) => ({
    ...item,
    sampleClass: 'anti_pattern' as const,
    sourceClass: 'mechanic_negative_control' as const,
    constructionBand: null,
    independentCalibrationEligible: false,
    calibrationBand: null,
    calibrationEvidenceRefs: [] as string[],
    boundary: '负对照只验证机制误报，不定义主流队伍的强度顺序。',
  })),
])

export const current31TeamStrengthProductTargets = Object.freeze({
  constructionSetMinimum: 30,
  constructionSetMaximum: 50,
  productAuthority: {
    topKRecall: 0.97,
    pairwiseConsistency: 0.95,
    bandAgreement: 0.95,
  },
  good: {
    topKRecall: 0.95,
    pairwiseConsistency: 0.9,
    bandAgreement: 0.9,
    mainstreamUnknownRatioMaximum: 0.05,
  },
  usable: {
    topKRecall: 0.9,
    pairwiseConsistency: 0.85,
    mainstreamUnknownRatioMaximum: 0.15,
  },
} as const)

const independentlyCalibratedCount = current31TeamStrengthConstructionSet.filter(
  (item) => item.independentCalibrationEligible,
).length

const observedEvaluations = [
  current31TeamStrengthObservedEvaluation,
  current31DeadlyAssault313ObservedEvaluation,
  current31IndependentConsensusGoldSetEvaluation,
] as const
const observedPredictionCount = observedEvaluations.reduce(
  (total, evaluation) => total + evaluation.predictionCount,
  0,
)
const observedRecognizedCount = observedEvaluations.reduce(
  (total, evaluation) => total + evaluation.recognizedCount,
  0,
)
const observedExperimentalCount = observedEvaluations.reduce(
  (total, evaluation) => total + evaluation.experimentalCount,
  0,
)
const observedUnrecognizedCount = observedPredictionCount - observedRecognizedCount
const observedComparablePairCount = observedEvaluations.reduce(
  (total, evaluation) => total + evaluation.comparablePairCount,
  0,
)
const observedStrictConcordantPairCount = observedEvaluations.reduce(
  (total, evaluation) => total + evaluation.strictConcordantPairCount,
  0,
)
const qualitativeMetricExplanations: Record<
  Extract<
    TeamStrengthProductMetricId,
    | 'mechanic_traceability'
    | 'real_combat_calibration'
    | 'account_priority_separation'
    | 'explainability'
    | 'versioned_update_and_rollback'
    | 'unknown_handling'
    | 'team_core_aggregation'
    | 'bangboo_variant_coverage'
    | 'observed_performance_data_quality'
  >,
  string
> = {
  mechanic_traceability: '需要通过具名机制回归验收。',
  real_combat_calibration: '需要通过多版本 Shiyu/DA 现实校准验收。',
  account_priority_separation: '需要用代表账号验证 Team Strength 与培养优先级分离。',
  explainability: '需要在真实路由验证每个关键判断可追溯到机制、计算或证据。',
  versioned_update_and_rollback: '需要验证版本化校准、回滚与旧结果失效。',
  unknown_handling: '需要验证 unknown 在所有消费者中均不被伪造成 weak。',
  team_core_aggregation:
    '合同已禁止 Family 继承评级；仍需把 Family → Exact 3-Agent Variant 的聚合与展开接入真实推荐 UI。',
  bangboo_variant_coverage:
    '邦布已成为精确三人 Variant 的第四参数；N4 只需在代表账户验证默认/替代邦布的机制与推荐关系，不要求补齐事件时序或模拟性能贡献。',
  observed_performance_data_quality: `现有 ${current31ObservedPerformanceDataQuality.rowCount} 条 Shiyu/DA 观测仅允许作为场景化现实校准诊断；邦布、队伍级样本量、方差和独立性能标签均缺失，不能进入 Reference Performance 或 Team Strength。`,
}

export const current31TeamStrengthProductReadiness = Object.freeze({
  contract: current31TeamStrengthProductGateContractId,
  gameVersion: '3.1',
  status: 'blocked' as const,
  currentGate: current31BoxReliableGate,
  constructionCaseCount: current31TeamStrengthConstructionSet.length,
  independentlyCalibratedCount,
  preliminaryStrengthBandCaseCount: current31BoxReliableGate.coverage.strengthBandCaseCount,
  exactBangbooStrengthGoldCaseCount:
    current31BoxReliableGate.coverage.exactBangbooStrengthGoldCaseCount,
  strengthGoldCalibrationCaseCount: current31StrengthGoldSet.calibrationCases.length,
  strengthGoldIndependentHoldoutCaseCount: current31StrengthGoldSet.independentHoldoutCases.length,
  observedRealityCaseCount:
    current31Shiyu313ObservedCalibration.observations.length +
    current31DeadlyAssault313ObservedCalibration.observations.length +
    current31IndependentConsensusGoldSet.observations.length,
  antiPatternCount: antiPatternCases.length,
  highConfidencePairwiseCount: current31StrengthGoldSet.highConfidencePairwise.length,
  recoveredCalibrationLineage: current31MetaStrengthR1Lineage,
  recommendationChain: current31TeamCoreAggregation.recommendationChain,
  referencePerformancePilotCaseCount: current31ReferencePerformancePilot.pilotCaseCount,
  referenceRotationSequenceReadyCaseCount:
    current31ReferencePerformancePilot.sequenceReadyCaseCount,
  referencePerformanceCaseCount: current31ReferencePerformancePilot.completeCaseCount,
  referencePerformanceSourceAudit: current31ReferencePerformanceSourceAudit,
  mainstreamCoreFamilyCount: current31TeamCoreAggregation.familyCount,
  mainstreamExactVariantCount: current31TeamCoreAggregation.exactFormationCount,
  referenceBangbooBoundCaseCount: current31ReferencePerformancePilot.bangbooBoundCaseCount,
  observedPerformanceDataQuality: current31ObservedPerformanceDataQuality,
  scenarioHoldoutCount: current31Shiyu313ObservedCalibration.holdout.length,
  crossModeHoldoutCount: current31DeadlyAssault313ObservedCalibration.observations.length,
  independentHoldoutCount:
    current31Shiyu313ObservedCalibration.sourceIndependentHoldoutCount +
    current31DeadlyAssault313ObservedCalibration.sourceIndependentHoldoutCount +
    current31MainstreamAuthorityEvaluationGate.evaluationSets.blindOrTemporalHoldout.bandCaseCount,
  metrics: [
    {
      metricId: 'mainstream_recognition',
      status: current31MainstreamAuthorityEvaluationGate.metricStatus.topKRecall,
      observed: current31MainstreamAuthorityEvaluationGate.metrics.topKRecall,
      target: current31MainstreamAuthorityEvaluationGate.targets.topKRecall,
      unit: 'ratio',
      explanation: `30 条已知集合一致性样本达到 ${current31IndependentConsensusGoldSetEvaluation.knownSetConsistency.recognizedCount}/${current31IndependentConsensusGoldSetEvaluation.knownSetConsistency.caseCount}，但它与 production membership identity 同构，不能作为独立主流识别指标。其余 Shiyu/DA 诊断仍保留 ${observedRecognizedCount}/${observedPredictionCount}，不混入独立分母。`,
    },
    {
      metricId: 'top_k_recall',
      status: current31MainstreamAuthorityEvaluationGate.metricStatus.topKRecall,
      observed: current31MainstreamAuthorityEvaluationGate.metrics.topKRecall,
      target: current31MainstreamAuthorityEvaluationGate.targets.topKRecall,
      unit: 'ratio',
      explanation:
        '暂无与 production membership identity 解耦的 exact 3-agent 主流 Top-K 标签，因此严格为 not_evaluated；这不影响独立 Band/Pairwise 的既有结论。',
    },
    {
      metricId: 'pairwise_consistency',
      status: current31MainstreamAuthorityEvaluationGate.metricStatus.highConfidencePairwise,
      observed: current31MainstreamAuthorityEvaluationGate.metrics.highConfidencePairwise,
      target: current31MainstreamAuthorityEvaluationGate.targets.highConfidencePairwise,
      unit: 'ratio',
      explanation: `新的行级 label-independent holdout 达到 ${current31MainstreamAuthorityEvaluationGate.blindMetaHoldout.alignedPairwiseCount}/${current31MainstreamAuthorityEvaluationGate.blindMetaHoldout.pairwiseRelationCount}；现有 10 条 production partial order 关系不计入分母。旧 Shiyu/DA 同源顺序 ${observedStrictConcordantPairCount}/${observedComparablePairCount} 继续只作诊断。`,
    },
    {
      metricId: 'band_agreement',
      status: current31MainstreamAuthorityEvaluationGate.metricStatus.bandAgreement,
      observed: current31MainstreamAuthorityEvaluationGate.metrics.bandAgreement,
      target: current31MainstreamAuthorityEvaluationGate.targets.bandAgreement,
      unit: 'ratio',
      explanation:
        '旧 10 支 construction-leaked diagnostic 不计入验收；新冻结行级 holdout 覆盖 Apex/Meta/Viable，生产证据不读取其最终标签。',
    },
    {
      metricId: 'mainstream_unknown_ratio',
      status: current31MainstreamAuthorityEvaluationGate.metricStatus.mainstreamUnknownRatio,
      observed: current31MainstreamAuthorityEvaluationGate.metrics.mainstreamUnknownRatio,
      target: current31MainstreamAuthorityEvaluationGate.targets.mainstreamUnknownRatioMaximum,
      unit: 'ratio',
      explanation: `主流 Unknown 比例与 30 条 known-set consistency 使用同一 membership identity，故严格为 not_evaluated；Versioned Strength 先复用 canonical Gold 与 claim-level supplements，再由 Patch Delta 控制失效。这与 ${observedUnrecognizedCount} 个现实诊断未识别和 ${observedExperimentalCount} 个 Experimental 扩展债务分开。`,
    },
    ...(
      [
        'mechanic_traceability',
        'real_combat_calibration',
        'account_priority_separation',
        'explainability',
        'versioned_update_and_rollback',
        'unknown_handling',
        'team_core_aggregation',
        'bangboo_variant_coverage',
        'observed_performance_data_quality',
      ] as const
    ).map((metricId) => ({
      metricId,
      status: 'not_evaluated' as const,
      observed: null,
      target: null,
      unit: 'qualitative' as const,
      explanation: qualitativeMetricExplanations[metricId],
    })),
  ] satisfies TeamStrengthProductMetric[],
  blockers: current31BoxReliableGate.blockers,
  deferredEnhancement: {
    referencePerformancePilotCaseCount: current31ReferencePerformancePilot.pilotCaseCount,
    referenceRotationSequenceReadyCaseCount:
      current31ReferencePerformancePilot.sequenceReadyCaseCount,
    referencePerformanceCompleteCaseCount: current31ReferencePerformancePilot.completeCaseCount,
    sourceAuditCount: current31ReferencePerformanceSourceAudit.auditedSourceCount,
    role: 'non_blocking_reference_combat_model' as const,
  },
  boundary:
    '当前 N4 以可信账号养成与配队决策工具的 BOX Reliable 收口，不等待完整战斗模拟。Team Strength V1 只要求主流无明显错档、三档分层与同 Family Variant 替换基本合理；不追求全序或 DPS 真值。社区/攻略/实战只形成 Meta Calibration 与 Reality Check，不作为隐藏分或直接排名表。Reference Combat Model 与 ZSim 均不阻断 N4。',
})
