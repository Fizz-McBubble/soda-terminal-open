import { current31CandidateUniverseAudit } from '../teamEngine/current31CandidateUniverseAudit'
import { currentAssetProjection } from './currentAssetProjection'
import { currentCapabilityGapMatrix } from './currentCapabilityGapMatrix'
import { currentNonAgentFieldCompletenessMatrix } from './currentNonAgentFieldCompletenessMatrix'

const buildFields = currentCapabilityGapMatrix.rows.flatMap((row) => row.build.fields)
const missingMediaIds = currentAssetProjection.entries
  .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
  .filter((entry) => entry.domain !== 'agent')
  .filter((entry) => entry.media.status === 'manifest_missing')
  .map((entry) => entry.stableId)
  .sort((left, right) => left.localeCompare(right))

/**
 * N4 data closes only against the complete current directory. Representative
 * fixtures and numeric vertical slices may validate architecture, but cannot
 * make this gate complete.
 */
export const currentN4DataCompletenessGate = {
  contract: 'soda-n4-current-data-completeness/v1',
  gameVersion: currentAssetProjection.gameVersion,
  completionScope: 'all_current_released_account_ownable_entities',
  population: {
    agents: currentAssetProjection.agents.length,
    wEngines: currentAssetProjection.wEngines.length,
    bangboos: currentAssetProjection.bangboos.length,
    driveDiscSets: currentAssetProjection.driveDiscSets.length,
    total: currentAssetProjection.entries.length,
  },
  agentFields: {
    requiredBuildFieldCount: buildFields.length,
    readyBuildFieldCount: buildFields.filter((field) => field.status === 'ready').length,
    calculationReadyAgentCount: currentCapabilityGapMatrix.rows.filter(
      (row) => row.calculation.status === 'ready',
    ).length,
    normalizedPlanningReadyAgentCount:
      current31CandidateUniverseAudit.normalizedDecisionScoreAudit.agentProfilesReady,
    requiredAgentCount: currentCapabilityGapMatrix.rows.length,
  },
  domainFieldAudits: {
    agents: 'field_matrix_present',
    wEngines: 'field_matrix_present_calculation_ready',
    bangboos: 'field_matrix_present_calculation_ready',
    driveDiscSets: 'field_matrix_present_calculation_ready',
  },
  nonAgentFields: currentNonAgentFieldCompletenessMatrix.summary,
  graphics: {
    missingMediaIds,
    complete: missingMediaIds.length === 0,
  },
  teamCandidateUniverse: {
    status: current31CandidateUniverseAudit.candidateUniverseStatus,
    executableAgentRuleCount: current31CandidateUniverseAudit.executableAgentRuleCount,
    missingExecutableRuleCount:
      current31CandidateUniverseAudit.missingExecutableRuleAgentIds.length,
  },
  sourceAndEntityCalculationComplete:
    current31CandidateUniverseAudit.normalizedDecisionScoreAudit.agentProfilesReady ===
      currentCapabilityGapMatrix.rows.length &&
    currentNonAgentFieldCompletenessMatrix.complete &&
    missingMediaIds.length === 0 &&
    current31CandidateUniverseAudit.normalizedDecisionScoreAudit.decisionScoreCoveragePercent ===
      100,
  productionTeamDpsComplete: false,
  complete: false,
  blockers: [
    '完整合法候选域已可进入账户资产绑定 normalized score，六个共享队伍交互 operator 也已可执行；但条件式效果、资源循环、场上时间与特殊/后台/共享伤害仍缺来源化实体合同，尚未进入完整 Team CalculationContext。',
    '13 个社区锚点的外部效度诊断仍有跨档倒挂；它们只用于 regression/calibration，不是候选分母或排序 authority。',
  ],
  boundary:
    'Source/Data、实体事件计算与全域账户资产绑定 normalized score 可以独立通过；N4 总门仍要求共享交互 operator 闭合后的 Team DPS。normalized score 与社区一致性均不冒充生产完成。',
} as const
