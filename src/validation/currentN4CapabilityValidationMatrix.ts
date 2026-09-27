import { skillInvestmentPolicy } from '../calculation/skillInvestmentPolicy'
import { current31MainstreamAuthorityEvaluationGate } from '../decision/current31MainstreamAuthorityEvaluationGate'
import { graduationCandidateProfileProjectionIdentity } from '../gameDataPacks/graduationCandidateProfileProjection'
import { currentN4LayeredCoverage } from '../gameDataPacks/currentN4LayeredCoverage'
import { warehouseAnalysisRuleVersion } from '../warehouse/discWarehouseAnalysis'

export const currentN4CapabilityValidationMatrixContract =
  'soda-n4-capability-validation-matrix/v1' as const

export type N4ValidationCapabilityId =
  | 'agent_skill_recommendation'
  | 'w_engine_recommendation'
  | 'graduation_panel'
  | 'disc_build_recommendation'
  | 'single_agent_warehouse_ranking'
  | 'team_and_bangboo'
  | 'team_joint_disc_assignment'
  | 'portfolio_coordination'
  | 'value_benchmark'
  | 'warehouse_cleanup'

export type N4ValidationCheckStatus =
  | 'pass'
  | 'fail'
  | 'diagnostic_only'
  | 'missing'
  | 'not_evaluated'
  | 'not_applicable'

export type N4CapabilityValidationRow = {
  capabilityId: N4ValidationCapabilityId
  intendedUse: string
  grain: string
  claimCeiling:
    | 'candidate_direction_only'
    | 'reliable_candidate'
    | 'bounded_heuristic'
    | 'supported_comparison_only'
    | 'advisory_only'
  evidence: {
    goldDiagnosticSplit: N4ValidationCheckStatus
    blindHoldout: N4ValidationCheckStatus
    topKRecall: N4ValidationCheckStatus
    pairwiseAccuracy: N4ValidationCheckStatus
    smallExactOracle: N4ValidationCheckStatus
    largeSolverRegret: N4ValidationCheckStatus
    versionDrift: N4ValidationCheckStatus
    sourceLineage: N4ValidationCheckStatus
    quarantine: N4ValidationCheckStatus
    rollback: N4ValidationCheckStatus
    representativeAccount: N4ValidationCheckStatus
  }
  evidenceRefs: readonly string[]
  openRisks: readonly string[]
}

const commonMissingModelMetrics = {
  goldDiagnosticSplit: 'missing',
  blindHoldout: 'missing',
  topKRecall: 'missing',
  pairwiseAccuracy: 'missing',
  smallExactOracle: 'not_applicable',
  largeSolverRegret: 'not_applicable',
  versionDrift: 'diagnostic_only',
  sourceLineage: 'pass',
  quarantine: 'diagnostic_only',
  rollback: 'diagnostic_only',
  representativeAccount: 'missing',
} as const satisfies N4CapabilityValidationRow['evidence']

export const currentN4CapabilityValidationRows = Object.freeze([
  {
    capabilityId: 'agent_skill_recommendation',
    intendedUse: '给出玩家可读的技能投入顺序与目标等级。',
    grain: 'agent + skill + game version',
    claimCeiling: 'candidate_direction_only',
    evidence: commonMissingModelMetrics,
    evidenceRefs: [
      `contract:${skillInvestmentPolicy.contract}`,
      'src/validation/currentN4ClaimValidationManifests.ts',
      'src/calculation/skillInvestmentPolicy.test.ts',
      'src/gameDataPacks/currentAgentMechanicContracts.ts',
    ],
    openRisks: [
      '尚无独立 Gold/Blind Holdout 验证技能顺序；目标等级只是预算档位，不是 DPS 最优解。',
    ],
  },
  {
    capabilityId: 'w_engine_recommendation',
    intendedUse: '给出当前版本音擎主选与可解释替代。',
    grain: 'agent + W-Engine + refinement + scenario',
    claimCeiling: 'candidate_direction_only',
    evidence: commonMissingModelMetrics,
    evidenceRefs: [
      `source-fact-ready:${currentN4LayeredCoverage.entityCalculationCoverage.ready.wEngines}`,
      'src/validation/currentN4ClaimValidationManifests.ts',
      'src/optimizer/teamWEngineFitSolver.test.ts',
      'src/decision/wEngineResolver.test.ts',
    ],
    openRisks: [
      '静态值与机制合同完整不等于推荐排序已拟合；缺独立 Top-K/Pairwise 与版本排序漂移基线。',
    ],
  },
  {
    capabilityId: 'graduation_panel',
    intendedUse: '展示候选毕业属性区间与构筑方向。',
    grain: 'agent + build branch + game version',
    claimCeiling: 'candidate_direction_only',
    evidence: {
      ...commonMissingModelMetrics,
      sourceLineage: 'pass',
      rollback: 'diagnostic_only',
    },
    evidenceRefs: [
      `profile-population:${graduationCandidateProfileProjectionIdentity.population}`,
      `source-package:${graduationCandidateProfileProjectionIdentity.sourcePackageId}`,
      'src/validation/currentN4ClaimValidationManifests.ts',
      'src/gameDataPacks/graduationCandidateProfileProjection.test.ts',
    ],
    openRisks: [
      '当前是 Candidate sidecar，formalSupported=false；尚无独立 Gold/Holdout 证明区间与主流构筑拟合。',
    ],
  },
  {
    capabilityId: 'disc_build_recommendation',
    intendedUse: '给出套装、主词条与副词条候选方向。',
    grain: 'agent + set pattern + slot + main/sub stat + game version',
    claimCeiling: 'candidate_direction_only',
    evidence: commonMissingModelMetrics,
    evidenceRefs: [
      `source-fact-ready:${currentN4LayeredCoverage.entityCalculationCoverage.ready.driveDiscSets}`,
      'src/validation/currentN4ClaimValidationManifests.ts',
      'src/gameDataPacks/candidateWarehouseConstraints.test.ts',
      'src/warehouse/discEnhancementPotential.test.ts',
    ],
    openRisks: ['来源化方向可用，但套装与词条排序缺独立 Gold/Pairwise/Blind Holdout。'],
  },
  {
    capabilityId: 'single_agent_warehouse_ranking',
    intendedUse: '从真实仓库为一个代理人排序可执行六盘候选。',
    grain: 'account snapshot + agent + six physical discs',
    claimCeiling: 'bounded_heuristic',
    evidence: {
      ...commonMissingModelMetrics,
      smallExactOracle: 'pass',
      largeSolverRegret: 'diagnostic_only',
    },
    evidenceRefs: [
      'src/validation/warehouseSolverRegretAudit.test.ts',
      'src/validation/warehouseSolverSampledRegret.test.ts',
      'src/validation/n4RealWarehouseOracle.test.ts',
      'src/optimizer/candidateWarehouseSolver.test.ts',
      'src/decision/developmentCandidateAlternatives.test.ts',
    ],
    openRisks: [
      '生产排序是 bounded heuristic；真实492盘的31个可执行配置中23个有合法六盘，独立精确Top-K分差均为0、反转库存顺序后稳定；8个无合法六盘。该账户的模板分验证不能外推队伍联合分配、其他账户或玩家效果标签。',
    ],
  },
  {
    capabilityId: 'team_and_bangboo',
    intendedUse: '给出账户无关的精确三人 Team Strength 与邦布适配。',
    grain: 'exact 3-agent; Bangboo claim uses exact 3-agent + Bangboo',
    claimCeiling: 'candidate_direction_only',
    evidence: {
      goldDiagnosticSplit: 'pass',
      blindHoldout: 'pass',
      topKRecall: current31MainstreamAuthorityEvaluationGate.metricStatus.topKRecall,
      pairwiseAccuracy:
        current31MainstreamAuthorityEvaluationGate.metricStatus.highConfidencePairwise,
      smallExactOracle: 'not_applicable',
      largeSolverRegret: 'not_applicable',
      versionDrift: 'pass',
      sourceLineage: 'pass',
      quarantine: 'diagnostic_only',
      rollback: 'diagnostic_only',
      representativeAccount: 'diagnostic_only',
    },
    evidenceRefs: [
      `gate:${current31MainstreamAuthorityEvaluationGate.contract}`,
      `top-k:${current31MainstreamAuthorityEvaluationGate.metricStatus.topKRecall}`,
      `pairwise:${current31MainstreamAuthorityEvaluationGate.metrics.highConfidencePairwise}`,
      'src/decision/current31BlindMetaHoldout.test.ts',
      'src/decision/bangbooRecommendationAuthority.test.ts',
    ],
    openRisks: [
      '105条留出标签仍有跨两档与false-S错误；独立 Top-K 与 mainstream Unknown 分母不足，严格为 not_evaluated。来源评级优先，模型评分仅作有界候选；代表账户可执行性不构成邦布效果拟合或 Product Accepted。',
    ],
  },
  {
    capabilityId: 'team_joint_disc_assignment',
    intendedUse: '为选中的精确三人联合分配 18 张互斥实体盘。',
    grain: 'account snapshot + exact team + 18 physical discs',
    claimCeiling: 'bounded_heuristic',
    evidence: {
      ...commonMissingModelMetrics,
      smallExactOracle: 'pass',
      largeSolverRegret: 'diagnostic_only',
      representativeAccount: 'pass',
    },
    evidenceRefs: [
      'src/validation/warehouseSolverRegretAudit.test.ts',
      'src/validation/warehouseSolverSampledRegret.test.ts',
      'src/decision/targetTeamOracleParity.test.ts',
      'src/optimizer/candidateWarehouseSolver.test.ts',
      'read-only representative account:32 agents/492 discs/18 unique target discs',
    ],
    openRisks: ['小候选域 exact parity 已通过；大型候选池只有合成抽样诊断，尚无真实仓库 regret。'],
  },
  {
    capabilityId: 'portfolio_coordination',
    intendedUse: '在玩家显式选择双队/三队时协调 36/54 张互斥实体盘。',
    grain: 'account snapshot + selected 2/3 teams + physical discs',
    claimCeiling: 'bounded_heuristic',
    evidence: {
      ...commonMissingModelMetrics,
      smallExactOracle: 'pass',
      largeSolverRegret: 'diagnostic_only',
    },
    evidenceRefs: [
      'src/validation/warehouseSolverRegretAudit.test.ts',
      'src/validation/warehouseSolverSampledRegret.test.ts',
      'src/decision/accountDecisionService.test.ts',
      'src/decision/teamExecutionProjection.test.ts',
    ],
    openRisks: [
      '18/36/54 唯一性已验证；大型组合只有合成抽样 regret，尚无真实账户独立最优性或双队/三队验证。',
    ],
  },
  {
    capabilityId: 'value_benchmark',
    intendedUse:
      '在同条件下比较具名游戏实装、保存方案重算副本或两份合法仓库方案的固定事件规划 DPS。',
    grain: 'account snapshot + exact agent/team + baseline/candidate + scenario',
    claimCeiling: 'supported_comparison_only',
    evidence: {
      ...commonMissingModelMetrics,
      smallExactOracle: 'diagnostic_only',
      largeSolverRegret: 'not_applicable',
      representativeAccount: 'pass',
    },
    evidenceRefs: [
      'contract:soda-value-benchmark-comparison/v1',
      'src/calculation/valueBenchmarkComparison.test.ts',
      'src/decision/targetTeamOracleParity.test.ts',
      'read-only representative account:development and exact-team supported comparisons',
    ],
    openRisks: [
      '比较归因、支持状态和算术已闭合；尚无独立实战/外部 Gold 验证数值误差，不得称实战 DPS。',
    ],
  },
  {
    capabilityId: 'warehouse_cleanup',
    intendedUse: '生成只读、人工复核的保留/强化/替换/清理候选。',
    grain: 'account snapshot + physical disc + protected simultaneous demand',
    claimCeiling: 'advisory_only',
    evidence: {
      ...commonMissingModelMetrics,
      smallExactOracle: 'diagnostic_only',
      largeSolverRegret: 'not_applicable',
      representativeAccount: 'missing',
    },
    evidenceRefs: [
      `rule:${warehouseAnalysisRuleVersion}`,
      'src/warehouse/discWarehouseAnalysis.test.ts',
      'src/warehouse/discWarehouseAnalysis.boundaries.test.ts',
    ],
    openRisks: ['安全反例与 fail-closed 已覆盖；尚无代表账户误清理率、召回率或跨版本漂移验证。'],
  },
] as const satisfies readonly N4CapabilityValidationRow[])

const blockingStatuses = new Set<N4ValidationCheckStatus>(['missing', 'fail', 'not_evaluated'])

export const currentN4CapabilityValidationMatrix = Object.freeze({
  contract: currentN4CapabilityValidationMatrixContract,
  gameVersion: '3.1-phase-ii',
  crossCapabilityEvidenceRefs: [
    'src/validation/currentN4CapabilityQuarantineRehearsal.test.ts',
    'src/validation/representativeWarehouseValidation.test.ts',
    'src/validation/currentN4ProductionAdapterInventory.test.ts',
    'src/validation/currentN4LaunchClaimDisposition.test.ts',
  ] as const,
  intendedUse: 'P5 release and player-claim readiness; not a runtime ranking input',
  rows: currentN4CapabilityValidationRows,
  releaseBlockingCapabilityIds: currentN4CapabilityValidationRows
    .filter((row) => Object.values(row.evidence).some((status) => blockingStatuses.has(status)))
    .map((row) => row.capabilityId),
  status: 'incomplete_independent_validation' as const,
  playerClaimPolicy: {
    reliableCandidate: ['team_and_bangboo'],
    candidateDirectionOnly: [
      'agent_skill_recommendation',
      'w_engine_recommendation',
      'graduation_panel',
      'disc_build_recommendation',
    ],
    boundedHeuristic: [
      'single_agent_warehouse_ranking',
      'team_joint_disc_assignment',
      'portfolio_coordination',
    ],
    supportedComparisonOnly: ['value_benchmark'],
    advisoryOnly: ['warehouse_cleanup'],
  },
  sideEffect: 'read_only' as const,
  boundary:
    '每项能力独立判定；Team/BOX 的 Gold/Holdout 指标不得外推到技能、音擎、毕业面板、仓库排序、Benchmark 或清理。矩阵只约束 Claim 与发布门，不进入任何推荐、评分或清理算法。',
})
