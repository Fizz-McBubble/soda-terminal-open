import { currentAgentEventContracts } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import type { AgentRule } from './contracts'
import { current31TeamEngineD1Pack } from './current31D1Pack'

export function isRecommendationExecutableAgentRule(rule: AgentRule | undefined) {
  if (!rule || rule.releaseState !== 'released') return false
  if (
    !rule.agentId ||
    !rule.name ||
    !rule.specialty ||
    !rule.faction ||
    !rule.attribute ||
    !Number.isFinite(rule.fieldTimeDemand) ||
    rule.fieldTimeDemand < 0 ||
    rule.fieldTimeDemand > 1 ||
    rule.additionalAbility.status === 'not_modeled' ||
    !rule.evidence.length
  )
    return false
  if (rule.produces.some((tag) => !tag) || rule.consumes.some((tag) => !tag)) return false
  if (rule.effects.some((effect) => !effect.tag)) return false
  return rule.evidence.every(
    (evidence) =>
      Boolean(evidence.sourceId) && Boolean(evidence.gameVersion) && Boolean(evidence.locator),
  )
}

const releasedAgentIds = currentAssetProjection.agents
  .filter((agent) => agent.releaseState === 'released' && agent.accountOwnable)
  .map((agent) => agent.stableId)
  .sort((left, right) => left.localeCompare(right))

const existingRuleById = new Map(
  current31TeamEngineD1Pack.agentRules.map((rule) => [rule.agentId, rule]),
)
const mechanicContractById = new Map(
  currentAgentEventContracts.map((contract) => [contract.stableId, contract]),
)

export const current31AgentRuleReadinessEntries = releasedAgentIds.map((agentId) => {
  const existingRule = existingRuleById.get(agentId)
  const activation = mechanicContractById.get(agentId)?.teamActivationContract
  const recommendationExecutable = isRecommendationExecutableAgentRule(existingRule)
  const decisionMechanic = getCurrentAgentDecisionMechanicContract(agentId)
  const activationDecisionReady = recommendationExecutable || activation?.status === 'compiled'
  return {
    agentId,
    existingRecommendationExecutable: recommendationExecutable,
    activation: activation
      ? {
          status: activation.status,
          sourceBacked: activation.status !== 'not_expressed',
          staticDecisionReady:
            activation.status === 'compiled' && activation.predicate?.dynamicTerms.length === 0,
          contextDecisionReady: activation.status === 'compiled',
        }
      : {
          status: 'mechanic_contract_missing' as const,
          sourceBacked: false,
          staticDecisionReady: false,
          contextDecisionReady: false,
        },
    activationDecisionReady,
    recommendationExecutable,
    remainingDimensions: recommendationExecutable
      ? []
      : ([
          ...(decisionMechanic?.readiness.resourceFlow === 'compiled'
            ? []
            : ['resource_flow' as const]),
          ...(decisionMechanic?.readiness.effectRecipient === 'compiled'
            ? []
            : ['effect_recipient' as const]),
          ...(decisionMechanic?.readiness.fieldTime === 'compiled' ? [] : ['field_time' as const]),
          ...(decisionMechanic?.readiness.teamSynergy === 'compiled_seed'
            ? []
            : ['team_synergy' as const]),
        ] as const),
  }
})

const idsWhere = (
  predicate: (entry: (typeof current31AgentRuleReadinessEntries)[number]) => boolean,
) => current31AgentRuleReadinessEntries.filter(predicate).map((entry) => entry.agentId)

export const current31AgentRuleReadiness = {
  contract: 'soda-current-agent-rule-readiness/v1',
  gameVersion: currentVersionProjection.gameVersion,
  population: current31AgentRuleReadinessEntries.length,
  recommendationExecutableAgentIds: idsWhere((entry) => entry.recommendationExecutable),
  activationDecisionReadyAgentIds: idsWhere((entry) => entry.activationDecisionReady),
  formulaActivationCompiledAgentIds: idsWhere((entry) => entry.activation.status === 'compiled'),
  formulaActivationDynamicContextAgentIds: idsWhere(
    (entry) => entry.activation.status === 'dynamic_context_pending',
  ),
  formulaActivationNotExpressedAgentIds: idsWhere(
    (entry) => entry.activation.status === 'not_expressed',
  ),
  missingRecommendationExecutableAgentIds: idsWhere((entry) => !entry.recommendationExecutable),
  missingActivationDecisionAgentIds: idsWhere((entry) => !entry.activationDecisionReady),
  sourceFactGapAgentIds: idsWhere(
    (entry) =>
      !mechanicContractById.has(entry.agentId) ||
      !getCurrentAgentDecisionMechanicContract(entry.agentId),
  ),
  mechanicContractPendingAgentIds: idsWhere((entry) => !entry.activationDecisionReady),
  recommendationEngineeringBacklogAgentIds: idsWhere((entry) => !entry.recommendationExecutable),
  resourceFlowPendingAgentIds: idsWhere((entry) =>
    entry.remainingDimensions.includes('resource_flow'),
  ),
  effectRecipientPendingAgentIds: idsWhere((entry) =>
    entry.remainingDimensions.includes('effect_recipient'),
  ),
  fieldTimePendingAgentIds: idsWhere((entry) => entry.remainingDimensions.includes('field_time')),
  teamSynergyPendingAgentIds: idsWhere((entry) =>
    entry.remainingDimensions.includes('team_synergy'),
  ),
  boundary: `当前${currentVersionProjection.gameVersion}目录有${releasedAgentIds.length}名已发布且可拥有代理人；${idsWhere((entry) => entry.recommendationExecutable).length}名具备可执行推荐规则，${idsWhere((entry) => !entry.recommendationExecutable).length}名仍缺规则。来源缺项按当前身份与锁定机制目录逐名核对；规则可执行不证明全部字段、协同全集、当前强度或完整循环。`,
} as const
