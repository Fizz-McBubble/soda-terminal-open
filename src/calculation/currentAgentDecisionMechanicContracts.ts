import decisionMechanicCatalog from '../gameDataPacks/generated/current-agent-decision-mechanic-catalog.v1.json'
import { agentCatalog } from '../assault/catalogData'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'

const stableIdByExternalId = new Map<string, string>([
  ...agentCatalog.map(([stableId, , , externalId]) => [externalId, stableId] as const),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.stableId.startsWith('agent-'))
    .map((entry) => [entry.gameEvidenceId, entry.stableId] as const),
])

const resourceByAgentId = new Map(
  decisionMechanicCatalog.resourceContracts.map((contract) => [contract.agentId, contract]),
)
const effectsByAgentId = new Map(
  decisionMechanicCatalog.formulaEffects.map((contract) => {
    const stableId = stableIdByExternalId.get(contract.externalId)
    if (!stableId) throw new Error(`角色效果合同无法解析 current stable id：${contract.externalId}`)
    return [stableId, contract] as const
  }),
)
const synergyByAgentId = new Map(
  decisionMechanicCatalog.synergyContracts.map((contract) => [contract.agentId, contract]),
)
const fieldTimeByAgentId = new Map(
  decisionMechanicCatalog.fieldTimeContracts.map((contract) => [contract.agentId, contract]),
)
const specialInteractionByAgentId = new Map(
  decisionMechanicCatalog.specialInteractionCapabilities.map((contract) => [
    contract.agentId,
    contract,
  ]),
)

export const currentAgentDecisionMechanicContracts = Object.freeze(
  [...effectsByAgentId].map(([agentId, effectContract]) => ({
    agentId,
    resourceContract: resourceByAgentId.get(agentId) ?? null,
    effectContract,
    fieldTimeContract: fieldTimeByAgentId.get(agentId) ?? null,
    synergyContract: synergyByAgentId.get(agentId) ?? null,
    specialInteractionContract: specialInteractionByAgentId.get(agentId) ?? null,
    readiness: {
      resourceFlow:
        resourceByAgentId.get(agentId)?.resourceFlow.parameterClassification ===
          'named_resource_or_state' &&
        resourceByAgentId.get(agentId)?.resourceFlow.status === 'compiled'
          ? 'compiled'
          : resourceByAgentId.get(agentId)?.resourceFlow.parameterClassification ===
                'effect_or_state_parameters_only' ||
              resourceByAgentId.get(agentId)?.resourceFlow.parameterClassification ===
                'not_expressed'
            ? 'not_applicable'
            : 'mechanic_contract_pending',
      effectRecipient: 'compiled',
      fieldTime: fieldTimeByAgentId.has(agentId) ? 'compiled' : 'contract_pending',
      teamSynergy: synergyByAgentId.has(agentId) ? 'compiled_seed' : 'source_contract_pending',
      specialInteraction: specialInteractionByAgentId.has(agentId)
        ? 'compiled_capability'
        : 'not_applicable',
    },
  })),
)

const contractByAgentId = new Map(
  currentAgentDecisionMechanicContracts.map((contract) => [contract.agentId, contract]),
)

export function getCurrentAgentDecisionMechanicContract(agentId: string) {
  return contractByAgentId.get(agentId) ?? null
}

export const currentAgentDecisionMechanicCoverage = Object.freeze({
  contract: 'soda-current-agent-decision-mechanic-coverage/v1',
  population: currentAgentDecisionMechanicContracts.length,
  resourceFlowReadyAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.resourceFlow === 'compiled')
    .map((item) => item.agentId),
  resourceFlowPendingAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.resourceFlow === 'mechanic_contract_pending')
    .map((item) => item.agentId),
  resourceFlowNotApplicableAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.resourceFlow === 'not_applicable')
    .map((item) => item.agentId),
  effectRecipientReadyAgentIds: currentAgentDecisionMechanicContracts.map((item) => item.agentId),
  fieldTimeReadyAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.fieldTime === 'compiled')
    .map((item) => item.agentId),
  teamSynergyReadyAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.teamSynergy === 'compiled_seed')
    .map((item) => item.agentId),
  specialInteractionReadyAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.specialInteraction === 'compiled_capability')
    .map((item) => item.agentId),
  boundary:
    'Graduation facts compile resource/state flow; formula AST compiles effect recipients; current guide relations compile observed partners and five source-backed field-time modes. Field-time values are shared planning-budget weights, not measured seconds or percentages. Historical continuity does not prove current strength and no seed or guide set is an exhaustive pair universe.',
})
