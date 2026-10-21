import { currentDataAuthorityProjection } from '../gameDataPacks/currentDataAuthorityProjection'
import { currentN4DataCompletenessGate } from '../gameDataPacks/currentN4DataCompletenessGate'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { currentFieldAuthority } from '../gameDataPacks/currentFieldAuthority'
import { currentTeamOutputModuleCoverage } from '../gameDataPacks/currentTeamOutputModuleCoverage'
import { current31MainstreamAuthorityEvaluationGate } from '../decision/current31MainstreamAuthorityEvaluationGate'
import strengthModelArtifact from '../gameDataPacks/generated/team-strength-model.3.1.json'
import relativePreferenceCandidate from '../gameDataPacks/generated/team-relative-preference-model.3.2.3.json'
import performanceSource from '../gameDataPacks/data/reviewed-team-performance.3.2.3.json'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import { stableContentHash } from '../gameDataPacks/types'
import {
  currentN4FrontendCapabilityDataValidation,
  isFrontendCapabilityFullyValidated,
} from './currentN4FrontendCapabilityDataValidation'
import { currentN4ProductionAdapterInventory } from './currentN4ProductionAdapterInventory'

export const currentN4DataManagementGateContract = 'soda-n4-data-management-gate/v1' as const

type DataManagementState = 'ready' | 'needs_attention' | 'blocked'

function item(input: {
  id: string
  label: string
  state: DataManagementState
  summary: string
  blockers?: readonly string[]
  evidenceRefs: readonly string[]
}) {
  return Object.freeze({ ...input, blockers: input.blockers ?? [] })
}

const validatedCapabilityCount = currentN4FrontendCapabilityDataValidation.fullyValidated
const rollbackReplayReady = currentN4ProductionAdapterInventory.filter(
  (row) => row.remainingProof.length === 0,
).length
const panelAgentCount = Object.keys(currentPanelData.agents).length
const panelWEngineCount = Object.keys(currentPanelData.wEngines).length
// Read only the saved artifact's development diagnostics; this projection
// does not train, execute or promote the model into a scoring authority.
const teamStrengthModelDevelopmentValidation = {
  sampleCount: strengthModelArtifact.regression.sampleCount,
  ...strengthModelArtifact.validation,
}
export function isCurrentRelativePreferenceDiagnostic(
  candidate: typeof relativePreferenceCandidate,
  baseline = strengthModelArtifact,
  gameVersion = currentDataAuthorityProjection.currentVersion.gameVersion,
) {
  const { contentHash, ...core } = candidate
  return (
    candidate.schema === 'soda-team-relative-preference-development/v2' &&
    candidate.evidencePolicy?.version === 'all-shared-two-observed-pairs-primary-embargo/v2' &&
    candidate.runtimeStrengthAuthority === false &&
    candidate.currentIndependentAccuracy === false &&
    candidate.target ===
      'all-same-partition-limited-S-M0-aggregate-shared-two-member-replacements-observed-direction/v3' &&
    Array.isArray(candidate.sourceContexts) &&
    stableContentHash(candidate.sourceContexts) ===
      stableContentHash(performanceSource.sources.map((row) => row.sourceContext)) &&
    contentHash === stableContentHash(core) &&
    candidate.targetGameVersion === gameVersion &&
    candidate.mechanicDataFingerprint === baseline.mechanicDataFingerprint &&
    candidate.referenceConditionsIdentity === baseline.referenceConditionsIdentity &&
    candidate.diagnosticBaseline?.contentHash === stableContentHash(baseline)
  )
}
const relativeCandidateCurrent = isCurrentRelativePreferenceDiagnostic(relativePreferenceCandidate)

const areas = Object.freeze([
  item({
    id: 'base_facts',
    label: '游戏资料',
    state: 'needs_attention',
    summary: `当前目录 ${currentAssetProjection.entries.length} 类资产；局外面板的 60级/5突破锚点已登记 ${panelAgentCount}/${currentAssetProjection.agents.length} 名代理人和 ${panelWEngineCount}/${currentAssetProjection.wEngines.length} 件音擎。`,
    blockers: [
      ...(currentN4DataCompletenessGate.sourceAndEntityCalculationComplete
        ? []
        : ['当前目录或实体计算覆盖尚未完成。']),
      ...(currentFieldAuthority.coverage.stale === 0
        ? []
        : [`${currentFieldAuthority.coverage.stale} 个字段仍需确认当前版本适用性。`]),
      '局外面板只支持角色与音擎均为 60级/5突破的已登记组合；非满级账户状态不推算。',
      '核心技 1 对应的上游零档尚未登记，保持不支持而不猜测面板。',
    ],
    evidenceRefs: [
      'src/gameDataPacks/currentAssetProjection.ts',
      'src/gameDataPacks/currentFieldAuthority.ts',
      'src/gameDataPacks/panel/currentPanelData.ts',
    ],
  }),
  item({
    id: 'current_increment',
    label: '已采用资料',
    state:
      currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsReady ===
        currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsTotal &&
      currentTeamOutputModuleCoverage.currentClassifiedTeamCount ===
        currentTeamOutputModuleCoverage.currentExactTeamCount
        ? 'ready'
        : 'needs_attention',
    summary: `应用已采用 ${currentDataAuthorityProjection.currentVersion.gameVersion} 资料：${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsReady}/${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsTotal} 项适用构筑字段有依据；${currentTeamOutputModuleCoverage.currentClassifiedTeamCount}/${currentTeamOutputModuleCoverage.currentExactTeamCount} 支当前精确队已有输出语义。另有 ${currentTeamOutputModuleCoverage.sourceAuditedUnknownExactTeamCount} 条历史或来源观察完成审计但仍无足够语义证据；这些计数不代表独立强度评分。`,
    evidenceRefs: [
      'src/gameDataPacks/currentVersionProjection.ts',
      'src/gameDataPacks/currentBuildAuthority.ts',
      'src/gameDataPacks/currentTeamOutputModuleCoverage.ts',
    ],
  }),
  item({
    id: 'recommendation_inputs',
    label: '攻略覆盖',
    state:
      currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceReady ===
      currentDataAuthorityProjection.currentBuildKnowledge.coverage.total
        ? 'ready'
        : 'needs_attention',
    summary: `${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsTotal} 项建议中已有 ${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsReady} 项依据，其中 ${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsDirectCurrent} 项直接来自 3.2、${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsContinuityReviewed} 项为锁定 3.1→3.2 连续性复审；${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceReady}/${currentDataAuthorityProjection.currentBuildKnowledge.coverage.total} 名代理人的建议全部齐全。`,
    blockers:
      currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidancePartial > 0
        ? [
            `${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidancePartial} 名代理人仍有字段级构筑缺口。`,
          ]
        : [],
    evidenceRefs: [
      'src/gameDataPacks/currentBuildAuthority.ts',
      'docs/data/production/current-consumer-adoption.v1.json',
    ],
  }),
  item({
    id: 'team_rating_validation',
    label: '队伍评级',
    state:
      current31MainstreamAuthorityEvaluationGate.status === 'ready_for_product_evaluation'
        ? 'ready'
        : 'needs_attention',
    summary:
      '队伍评级已有来源、机制与同档排序依据；参考模型仍有已知跨档误判，需要修正比较方法和校准。独立标签只检验评级，不参与玩家端算分，也不阻止现有评级。',
    blockers:
      current31MainstreamAuthorityEvaluationGate.status === 'ready_for_product_evaluation'
        ? []
        : [
            `${teamStrengthModelDevelopmentValidation.sampleCount} 条历史样本的留队/留核心档位一致率分别为 ${(teamStrengthModelDevelopmentValidation.leaveTeamOut.exactBandAccuracy * 100).toFixed(1)}% / ${(teamStrengthModelDevelopmentValidation.leaveCoreOut.exactBandAccuracy * 100).toFixed(1)}%，跨两档误差 ${teamStrengthModelDevelopmentValidation.leaveTeamOut.severeTwoBandErrors} / ${teamStrengthModelDevelopmentValidation.leaveCoreOut.severeTwoBandErrors}；这些是旧标签诊断，不是当前实战准确率。`,
            relativeCandidateCurrent
              ? `相对排序候选使用 ${relativePreferenceCandidate.evidenceVersion} 采集快照；防卫原生周期 ${[...new Set(relativePreferenceCandidate.sourceContexts.filter((row) => row.phase === 'shiyu_defense').map((row) => row.nativeModeVersion))].join('、')}，危局原生周期 ${[...new Set(relativePreferenceCandidate.sourceContexts.filter((row) => row.phase === 'deadly_assault').map((row) => row.nativeModeVersion))].join('、')}。同分区限定 S 级零影汇总、共两名成员的 ${relativePreferenceCandidate.counts.pairs} 组成对观察，保留 ${relativePreferenceCandidate.counts.changedPrimaryPairs} 组换主输出比较；留关卡方向一致率 ${(relativePreferenceCandidate.validation.leavePartitionOut.accuracy * 100).toFixed(1)}%，双侧主输出组隔离（${relativePreferenceCandidate.counts.primaryGroupHoldouts}折）为 ${(relativePreferenceCandidate.validation.leaveCoreOut.accuracy * 100).toFixed(1)}%。这是场景观察诊断，尚未进入通用评级或默认排序。`
              : `${relativePreferenceCandidate.evidenceVersion} 相对排序候选与当前资料或特征身份不一致，仅保留历史结果。`,
            ...(relativeCandidateCurrent
              ? [
                  `在同一完整留关卡测试域，只用原主输出不变训练范围为 ${(relativePreferenceCandidate.validation.legacyTrainingLeavePartitionOut.accuracy * 100).toFixed(1)}%，扩展后为 ${(relativePreferenceCandidate.validation.leavePartitionOut.accuracy * 100).toFixed(1)}%；原主输出不变子集仍单独报数，未删退步样本。历史标签回归同口径 ${(relativePreferenceCandidate.validation.leavePartitionOut.baselineAccuracy * 100).toFixed(1)}%。`,
                  '原记录邦布同名与不同名另行分层；同名不代表装备、潜能、A级影画或操作受控，成对展开也不代表独立玩家样本。',
                ]
              : []),
            `继续用现有倒挂与同核心换人反例修正评级。${current31MainstreamAuthorityEvaluationGate.targetGameVersion} 独立档位/成对强弱样本 ${current31MainstreamAuthorityEvaluationGate.metricEvidence.bandAgreement.denominator} / ${current31MainstreamAuthorityEvaluationGate.metricEvidence.highConfidencePairwise.denominator} 另用于检验准确率，现有训练输入不充作盲测答案。`,
          ],
    evidenceRefs: [
      'src/decision/current31TeamRating.ts',
      'src/decision/current31MainstreamAuthorityEvaluationGate.ts',
      'src/decision/teamRelativePreferenceModel.ts',
      'src/gameDataPacks/generated/team-relative-preference-model.3.2.3.json',
    ],
  }),
  item({
    id: 'independent_validation',
    label: '功能检查',
    state:
      validatedCapabilityCount === currentN4FrontendCapabilityDataValidation.registered
        ? 'ready'
        : 'blocked',
    summary: `${validatedCapabilityCount}/${currentN4FrontendCapabilityDataValidation.registered} 项玩家功能完成数据联系、质量基线和最终页面复验。`,
    blockers: currentN4FrontendCapabilityDataValidation.rows
      .filter((row) => !isFrontendCapabilityFullyValidated(row))
      .map((row) => `${row.label}：${row.primaryGap}`),
    evidenceRefs: [
      'src/validation/currentN4FrontendCapabilityDataValidation.ts',
      'src/validation/currentN4CapabilityValidationMatrix.ts',
    ],
  }),
  item({
    id: 'version_and_rollback',
    label: '更新安全',
    state: rollbackReplayReady === currentN4ProductionAdapterInventory.length ? 'ready' : 'blocked',
    summary: `${rollbackReplayReady}/${currentN4ProductionAdapterInventory.length} 项推荐已验证旧结果会失效、回退后会重算。`,
    blockers: currentN4ProductionAdapterInventory
      .filter((row) => row.remainingProof.length > 0)
      .map((row) => row.remainingProof),
    evidenceRefs: ['src/validation/currentN4ProductionAdapterInventory.ts'],
  }),
  item({
    id: 'real_account_validation',
    label: '实盘检查',
    state: 'blocked',
    summary: '已有只读代表账户证据，但本轮变更后的完整旅程与清理安全尚未重新通过。',
    blockers: [
      '需要在真实账户复验推荐、求解、保存、仓库影响和失效重算的连续旅程。',
      '需要以独立人工标签测量误清理率和有价值资产保留率。',
    ],
    evidenceRefs: [
      'src/validation/representativeWarehouseValidation.ts',
      'src/warehouse/discWarehouseAnalysis.ts',
    ],
  }),
])

const core = {
  contract: currentN4DataManagementGateContract,
  gameVersion: currentDataAuthorityProjection.currentVersion.gameVersion,
  purpose: '统一观察数据事实、推荐依据、独立验证、版本回退和真实账户证据；不参与推荐排序。',
  flow: ['source', 'canonical', 'derived', 'calculation', 'decision', 'consumer'] as const,
  areas,
  status: areas.every((area) => area.state === 'ready') ? ('ready' as const) : ('blocked' as const),
  blocksProductAcceptance: areas.some((area) => area.state === 'blocked'),
  boundary:
    '该门是现有权威与验证结果的只读汇总，不是第二数据源；任一能力的已通过证据不得外推到其他能力。',
}

export const currentN4DataManagementGate = Object.freeze({
  ...core,
  fingerprint: stableContentHash(core),
})
