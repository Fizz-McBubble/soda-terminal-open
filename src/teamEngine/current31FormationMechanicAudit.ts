import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { current31TeamEngineD1Pack } from './current31D1Pack'
import { current31LegalAgentFormations } from './current31LegalCandidateUniverse'
import { evaluateTeamPredicate, type TeamContext } from './teamMethodR1'
import { requiredAgentResources } from './teamResourceRequirements'

const rulesById = new Map(current31TeamEngineD1Pack.agentRules.map((rule) => [rule.agentId, rule]))

function inspectCurrent31FormationMechanicStateUncached(
  memberIds: readonly [string, string, string],
) {
  const agents = memberIds.map((agentId) => rulesById.get(agentId))
  if (agents.some((agent) => !agent))
    return {
      ruleComplete: false,
      fieldTimeWithinBudget: false,
      resourceLoopClosed: false,
      activationAtBase: false,
      activationAtMaximumKnownState: false,
      observedPartnerRelationForEveryMember: false,
      observedSourceBackedTeamFamily: false,
    }
  const resolved = agents as [
    NonNullable<(typeof agents)[number]>,
    ...NonNullable<(typeof agents)[number]>[],
  ]
  const producedTags = new Set(resolved.flatMap((agent) => agent.produces))
  const context = (mindscape: number): TeamContext => ({
    agents: resolved,
    producedTags,
    agentStateById: Object.fromEntries(resolved.map((agent) => [agent.agentId, { mindscape }])),
  })
  const abilityActive = (teamContext: TeamContext) =>
    resolved.every(
      (agent) =>
        agent.additionalAbility.status === 'none' ||
        (agent.additionalAbility.status === 'modeled' &&
          evaluateTeamPredicate(agent.additionalAbility.predicate, teamContext)),
    )
  const observedPartnerRelationForEveryMember = resolved.every((agent) => {
    const partners =
      getCurrentAgentDecisionMechanicContract(agent.agentId)?.synergyContract?.seeds.flatMap(
        (seed) => seed.partnerIds,
      ) ?? []
    return memberIds.some((memberId) => memberId !== agent.agentId && partners.includes(memberId))
  })
  const memberSet = new Set(memberIds)
  const observedSourceBackedTeamFamily = current31TeamEngineD1Pack.kernels.some(
    (kernel) =>
      kernel.coreAgentIds.every((agentId) => memberSet.has(agentId)) &&
      kernel.eligibleThirdAgentIds.some((agentId) => memberSet.has(agentId)),
  )
  return {
    ruleComplete: true,
    fieldTimeWithinBudget:
      resolved.reduce((total, agent) => total + agent.fieldTimeDemand, 0) <= 1.35,
    resourceLoopClosed: resolved.every((agent) =>
      requiredAgentResources(agent.consumes).every((tag) => producedTags.has(tag)),
    ),
    activationAtBase: abilityActive(context(0)),
    activationAtMaximumKnownState: abilityActive(context(6)),
    observedPartnerRelationForEveryMember,
    observedSourceBackedTeamFamily,
  }
}

const entries = current31LegalAgentFormations.map((memberIds) => ({
  memberIds,
  ...inspectCurrent31FormationMechanicStateUncached(memberIds),
}))

const mechanicStateByFormation = new Map(
  entries.map(({ memberIds, ...state }) => [[...memberIds].sort().join('|'), state]),
)

export function inspectCurrent31FormationMechanicState(
  memberIds: readonly [string, string, string],
) {
  const cached = mechanicStateByFormation.get([...memberIds].sort().join('|'))
  return cached ? { ...cached } : inspectCurrent31FormationMechanicStateUncached(memberIds)
}

const count = (predicate: (entry: (typeof entries)[number]) => boolean) =>
  entries.filter(predicate).length

export const current31FormationMechanicAudit = Object.freeze({
  contract: 'soda-current-formation-mechanic-audit/v1',
  population: entries.length,
  ruleComplete: count((entry) => entry.ruleComplete),
  fieldTimeWithinBudget: count((entry) => entry.fieldTimeWithinBudget),
  resourceLoopClosed: count((entry) => entry.resourceLoopClosed),
  activationAtBase: count((entry) => entry.activationAtBase),
  activationAtMaximumKnownState: count((entry) => entry.activationAtMaximumKnownState),
  accountStateDependentActivation: count(
    (entry) => !entry.activationAtBase && entry.activationAtMaximumKnownState,
  ),
  observedPartnerRelationForEveryMember: count(
    (entry) => entry.observedPartnerRelationForEveryMember,
  ),
  observedSourceBackedTeamFamily: count((entry) => entry.observedSourceBackedTeamFamily),
  sharedMechanicClosedAtBase: count(
    (entry) => entry.fieldTimeWithinBudget && entry.resourceLoopClosed && entry.activationAtBase,
  ),
  boundary:
    '这是完整合法身份域上的共享机制审计，不是强度排名或 Team DPS。Observed partner 只证明具名关系；未观察不等于 hard-invalid。事件频率、持续时间、队伍 buff owner、实体装备和 CalculationContext 仍须另行编译。',
})
