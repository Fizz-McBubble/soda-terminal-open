import {
  current31MetaStrengthR1,
  current31MetaStrengthR1Lineage,
} from '../teamEngine/currentMetaStrengthR1'
import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'
import { current31StrengthGoldSetEvaluation } from './current31StrengthGoldSetEvaluation'
import { current31ProductionPartialOrder } from './current31ProductionPartialOrder'
import { current31MainstreamAuthorityEvaluationGate } from './current31MainstreamAuthorityEvaluationGate'

export const current31BoxReliableGateContractId = 'soda-current-3.1-box-reliable-gate/v1' as const

export const current31BoxReliableTargets = Object.freeze({
  strengthGoldSetMinimum: 30,
  strengthGoldSetMaximum: 50,
  topKRecall: 0.95,
  bandAgreement: 0.9,
  pairwiseConsistency: 0.9,
  mainstreamUnknownRatioMaximum: 0.05,
} as const)

const strengthBandCaseCount = current31MetaStrengthR1.kernelBands.length
const pairwiseLabelCount = current31MetaStrengthR1.partialOrder.length
const preliminaryMinimumCoverageRatio =
  strengthBandCaseCount / current31BoxReliableTargets.strengthGoldSetMinimum
const exactBangbooStrengthGoldCaseCount = current31StrengthGoldSet.bandLabelCount
const reliablePairwiseLabelCount = current31StrengthGoldSet.highConfidencePairwise.length
const reliableMetricsEligible =
  current31MainstreamAuthorityEvaluationGate.status === 'ready_for_product_evaluation'

export const current31BoxReliableGate = Object.freeze({
  contract: current31BoxReliableGateContractId,
  gameVersion: '3.1',
  status: 'reopened_product_validation' as const,
  engineeringStatus: reliableMetricsEligible
    ? ('reliable_candidate_pass' as const)
    : ('evidence_incomplete' as const),
  target: 'box_reliable' as const,
  coverage: {
    mainstreamRecognitionCaseCount:
      current31IndependentConsensusGoldSet.sourceIndependentHoldoutCount,
    mainstreamRecognitionBandLabelCount: current31IndependentConsensusGoldSet.bandLabelCount,
    mainstreamRecognitionPairwiseLabelCount:
      current31IndependentConsensusGoldSet.pairwiseLabelCount,
    strengthBandCaseCount,
    preliminaryStrengthBandMinimumCoverageRatio: preliminaryMinimumCoverageRatio,
    exactBangbooStrengthGoldCaseCount,
    strengthGoldCalibrationCaseCount: current31StrengthGoldSet.calibrationCases.length,
    strengthGoldIndependentHoldoutCaseCount:
      current31StrengthGoldSet.independentHoldoutCases.length,
    reliableGoldMinimumCoverageRatio:
      exactBangbooStrengthGoldCaseCount / current31BoxReliableTargets.strengthGoldSetMinimum,
    pairwiseLabelCount,
    reliablePairwiseLabelCount,
    productionPartialOrderRelationCount: current31ProductionPartialOrder.relationCount,
    strengthGoldBandDistribution: {
      apex: current31StrengthGoldSet.cases.filter((item) => item.band === 'apex').length,
      meta: current31StrengthGoldSet.cases.filter((item) => item.band === 'meta').length,
      viable: current31StrengthGoldSet.cases.filter((item) => item.band === 'viable').length,
    },
    recoveredCalibrationProductAuthorityEligible:
      current31MetaStrengthR1Lineage.productAuthorityEligible,
  },
  metrics: {
    topKRecall: current31MainstreamAuthorityEvaluationGate.metrics.topKRecall,
    bandAgreement: current31MainstreamAuthorityEvaluationGate.metrics.bandAgreement,
    pairwiseConsistency: current31MainstreamAuthorityEvaluationGate.metrics.highConfidencePairwise,
    mainstreamUnknownRatio:
      current31MainstreamAuthorityEvaluationGate.metrics.mainstreamUnknownRatio,
  },
  metricStatus: {
    topKRecall: current31MainstreamAuthorityEvaluationGate.metricStatus.topKRecall,
    bandAgreement: current31MainstreamAuthorityEvaluationGate.metricStatus.bandAgreement,
    pairwiseConsistency:
      current31MainstreamAuthorityEvaluationGate.metricStatus.highConfidencePairwise,
    mainstreamUnknownRatio:
      current31MainstreamAuthorityEvaluationGate.metricStatus.mainstreamUnknownRatio,
  },
  provisionalDiagnostics: {
    holdoutCaseCount: current31StrengthGoldSetEvaluation.holdoutCaseCount,
    bandAgreement: current31StrengthGoldSetEvaluation.bandAgreement,
    runtimeGoldLeakCount: current31StrengthGoldSetEvaluation.runtimeGoldLeakCount,
    constructionIdentityLeakCount: current31StrengthGoldSetEvaluation.constructionIdentityLeakCount,
    sourceOverlapCaseCount: current31StrengthGoldSetEvaluation.sourceOverlapCaseCount,
    pairwiseHoldout: current31StrengthGoldSetEvaluation.pairwiseHoldout,
    productionPartialOrderRelationCount:
      current31StrengthGoldSetEvaluation.productionPartialOrderRelationCount,
  },
  referencePerformanceBlocking: false,
  productAcceptance: {
    status: 'reopened_recommendation_coverage_and_authority_fit' as const,
    requiredJourney: 'production_box_with_representative_account' as const,
    validatedAt: '2026-09-02' as const,
    representativeAccountEvidence: {
      ownedAgentCount: 32,
      physicalDiscCount: 492,
      sideEffect: 'read_only' as const,
    },
    checks: [
      {
        checkId: 'team_strength_account_invariance' as const,
        status: 'pass' as const,
        expectation: '同一精确三人 + 邦布 Variant 的 Team Strength 不随账户培养状态变化。',
        evidence:
          '真实账户修正错误的旧音擎库存阻断后，蕾米埃尔·维琳娜·爱芮 + 艾瑞儿仍保持 S / Apex；只有账户培养结论从实验观察恢复为中期培养。定向回归同时证明改变等级、技能和实体盘完成度不会改变 Team Strength。',
      },
      {
        checkId: 'cultivation_priority_account_sensitivity' as const,
        status: 'pass' as const,
        expectation:
          'Cultivation Priority 会随等级、技能、影画、真实驱动盘、成型距离、投入成本、资产冲突与边际收益合理变化。',
        evidence:
          '真实账户中 S / Apex 队为中期培养，较低理论强度的 B / Viable 低成本队为短期补齐；详情具名显示 Lv.60、影画 2、核心 7 与三名成员各 6 张盘的调整。影画通过五技能投影影响缺口，不作为沉没成本直接加权。',
      },
      {
        checkId: 'family_variant_and_bangboo' as const,
        status: 'pass' as const,
        expectation: '同 Family 的精确三人 Variant 独立判断，默认/替代邦布的机制与推荐关系可解释。',
        evidence:
          '真实页同一 Family 可在爱芮与普罗米娅精确三人 Variant 间切换，机制结论分别为部分成立与闭合优秀；两者均按精确 Variant 使用来源化默认艾瑞儿。当前没有独立来源支持的替代邦布，因此候选保持单一默认，未按 Family 猜测或伪造替代项。',
      },
      {
        checkId: 'physical_18_disc_execution' as const,
        status: 'pass' as const,
        expectation: '推荐使用 18 张互斥实体驱动盘形成可执行三人方案。',
        evidence:
          '真实 492 盘仓库只读求解返回完整状态：3 名代理人各 6 张，共 18 张不同实体盘，并显示队内实体盘互斥。',
      },
      {
        checkId: 'executable_explainable_stable_refresh' as const,
        status: 'reopened' as const,
        expectation: '推荐可执行、可解释，并在相同输入下刷新稳定。',
        evidence:
          '真实页可执行、可解释且刷新稳定，但 12 支 Authority 建议仅投影为 4 个可见 Family；Gold Pairwise 尚未进入 Account Decision 生产排序，同一列表还混合理论强度与培养优先级，故产品验收重开。',
      },
    ],
  },
  blockers: [
    'Structural、Semantic、Meta Gold/Holdout、N4-4 Consumer/Foundation 与 Value Benchmark V1 已通过工程门；Value Benchmark 仍需在代表真实账户上取得同条件双侧 supported 结果。',
    '代表真实账户的培养差异、18 盘互斥、解释、刷新/stale 与生产页面旅程尚未完成本轮 Product Validation。',
  ],
  deferredEnhancement: {
    capability: 'reference_combat_model' as const,
    role: 'team_authority_enhancement' as const,
    scope:
      '标准 Build、标准 Scenario、Reference Rotation、Buff/资源/失衡/场外伤害与邦布关键事件；不含敌人 AI、走位、闪避或逐帧操作误差。',
  },
  boundary:
    'N4 只要求当前版本主流队伍不明显错档、Apex/Meta/Viable 大分层与同 Family Variant 替换基本合理；production partial order 只表达具名关系，不追求全序或 DPS 真值。历史机制与 Formation 证据经 Patch Delta 检查后可继承；当前 Meta 与 Reality Check 单独校准。4960/4960 仅为候选可计算覆盖，不能称为版本权威。Reference Combat Model 与 ZSim 都是后续非阻断增强。',
})
