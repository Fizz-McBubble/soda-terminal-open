import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { current31AgentRuleReadiness } from './current31AgentRuleReadiness'
import { current31TeamEngineD1Pack } from './current31D1Pack'
import { current31LegalCandidateUniverse } from './current31LegalCandidateUniverse'
import { current31FormationMechanicAudit } from './current31FormationMechanicAudit'
import { currentPlanningContextBlueprintAudit } from '../calculation/currentPlanningContextBlueprintAudit'
import { currentNormalizedDecisionScoreAudit } from '../calculation/currentNormalizedPlanningBaseline'

const releasedAgentIds = currentAssetProjection.agents
  .filter((agent) => agent.releaseState === 'released' && agent.accountOwnable)
  .map((agent) => agent.stableId)
  .sort((left, right) => left.localeCompare(right))

const executableRuleIds = [...current31AgentRuleReadiness.recommendationExecutableAgentIds]

const executableRuleSet = new Set(executableRuleIds)
const representedAgentIds = [
  ...new Set(
    current31TeamEngineD1Pack.kernels.flatMap((kernel) => [
      ...kernel.coreAgentIds,
      ...kernel.eligibleThirdAgentIds,
    ]),
  ),
].sort((left, right) => left.localeCompare(right))

/**
 * Read-only audit of the source-backed candidate universe. The current pack is
 * a curated kernel catalogue, not an exhaustive legal-team generator, so its
 * recommendation count must never become the N4 numeric closure denominator.
 */
export const current31CandidateUniverseAudit = {
  contract: 'soda-team-candidate-universe-audit/v1',
  gameVersion: '3.1',
  sourceAuthority: 'current31D1Pack',
  generationAuthority: 'exhaustive_identity_legal_universe',
  releasedAgentCount: releasedAgentIds.length,
  executableAgentRuleCount: executableRuleIds.length,
  missingExecutableRuleAgentIds: releasedAgentIds.filter(
    (agentId) => !executableRuleSet.has(agentId),
  ),
  activationDecisionCoverage: {
    readyAgentCount: current31AgentRuleReadiness.activationDecisionReadyAgentIds.length,
    missingAgentIds: current31AgentRuleReadiness.missingActivationDecisionAgentIds,
    formulaCompiledCount: current31AgentRuleReadiness.formulaActivationCompiledAgentIds.length,
    formulaDynamicContextCount:
      current31AgentRuleReadiness.formulaActivationDynamicContextAgentIds.length,
    formulaNotExpressedCount:
      current31AgentRuleReadiness.formulaActivationNotExpressedAgentIds.length,
  },
  agentRuleLayeredGap: {
    sourceFactGapCount: current31AgentRuleReadiness.sourceFactGapAgentIds.length,
    mechanicContractPendingAgentIds: current31AgentRuleReadiness.mechanicContractPendingAgentIds,
    recommendationEngineeringBacklogCount:
      current31AgentRuleReadiness.recommendationEngineeringBacklogAgentIds.length,
    resourceFlowPendingCount: current31AgentRuleReadiness.resourceFlowPendingAgentIds.length,
    effectRecipientPendingCount: current31AgentRuleReadiness.effectRecipientPendingAgentIds.length,
    fieldTimePendingCount: current31AgentRuleReadiness.fieldTimePendingAgentIds.length,
    teamSynergyPendingCount: current31AgentRuleReadiness.teamSynergyPendingAgentIds.length,
  },
  kernelCount: current31TeamEngineD1Pack.kernels.length,
  familyCount: new Set(current31TeamEngineD1Pack.kernels.map((kernel) => kernel.familyId)).size,
  enumeratedFormationCount: current31TeamEngineD1Pack.kernels.reduce(
    (total, kernel) => total + kernel.eligibleThirdAgentIds.length,
    0,
  ),
  representedAgentIds,
  candidateUniverseStatus: 'complete_normalized_identity_score_universe',
  legalUniverse: current31LegalCandidateUniverse.legality,
  numericOperandCoverage: current31LegalCandidateUniverse.numericOperandCoverage,
  formationMechanicAudit: current31FormationMechanicAudit,
  planningContextBlueprintAudit: currentPlanningContextBlueprintAudit,
  normalizedDecisionScoreAudit: currentNormalizedDecisionScoreAudit,
  decisionScoreCoverage: {
    status: 'complete_normalized_fixed_event_baseline',
    executableAgentRuleCount: executableRuleIds.length,
    requiredAgentRuleCount: releasedAgentIds.length,
    pendingDimensions: [],
  },
  numericClosureDenominator: {
    status: 'exact_legal_identity_denominator',
    closeable: false,
    reason:
      '合法身份候选已全量枚举，统一固定事件基线、账户资产绑定路径与六个共享队伍交互 operator 均已覆盖；但条件式队伍效果、资源循环、场上时间与特殊/后台/共享伤害仍缺来源化实体合同，不能关闭 Production Team DPS。',
  },
} as const
