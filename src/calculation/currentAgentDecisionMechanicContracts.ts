import decisionMechanicCatalog from '../gameDataPacks/generated/current-agent-decision-mechanic-catalog.v1.json'
import { agentCatalog } from '../assault/catalogData'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import { isRuntimeResourceFlowCompiled32 } from './currentAgentResourceFlow32'
import phoenixEventOverlay from '../gameDataPacks/data/phoenix-event-contract.3.3.json'
import severianEventOverlay from '../gameDataPacks/data/severian-event-contract.3.3.json'
import {
  phoenixDecisionEffects33,
  phoenixDecisionFunctionalInputs33,
  phoenixDecisionSynergy33,
} from './phoenixDecisionMechanic33'
import {
  severianDecisionEffects33,
  severianDecisionFunctionalInputs33,
  severianDecisionSynergy33,
} from './severianDecisionMechanic33'

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

/** AST presence is separate from mechanism completeness. The upstream's
 * three generic conditional examples are templates, even when their branches
 * can be evaluated to zero. Specific expressions still need consumer coverage. */
export function classifyAgentEffectSource32(
  contract:
    | { effects: readonly { effectId: string; numericExpression: { expressionIr: unknown } }[] }
    | null
    | undefined,
) {
  if (!contract) return 'unknown' as const
  if (!contract.effects.length) return 'raw_event_only' as const
  const expected = {
    m6_dmg_: 'boolConditional',
    team_dmg_: 'listConditional',
    enemy_defRed_: 'numConditional',
  } as const
  const generic =
    contract.effects.length === 3 &&
    Object.entries(expected).every(([id, path]) => {
      const effect = contract.effects.find((row) => row.effectId === id)
      const ir = JSON.stringify(effect?.numericExpression.expressionIr)
      return ir?.includes(`"path":"${path}"`)
    })
  return generic ? ('generic_template' as const) : ('specific_expression' as const)
}

const catalogDecisionMechanicContracts = [...effectsByAgentId].map(([agentId, effectContract]) => ({
  agentId,
  resourceContract: resourceByAgentId.get(agentId) ?? null,
  effectContract,
  fieldTimeContract: fieldTimeByAgentId.get(agentId) ?? null,
  synergyContract: synergyByAgentId.get(agentId) ?? null,
  specialInteractionContract: specialInteractionByAgentId.get(agentId) ?? null,
  readiness: {
    effectSource: classifyAgentEffectSource32(effectContract),
    resourceFlow:
      resourceByAgentId.get(agentId)?.resourceFlow.parameterClassification ===
        'named_resource_or_state' &&
      isRuntimeResourceFlowCompiled32(resourceByAgentId.get(agentId)?.resourceFlow)
        ? 'compiled'
        : resourceByAgentId.get(agentId)?.resourceFlow.parameterClassification ===
              'effect_or_state_parameters_only' ||
            resourceByAgentId.get(agentId)?.resourceFlow.parameterClassification === 'not_expressed'
          ? 'not_applicable'
          : 'mechanic_contract_pending',
    effectRecipient: 'compiled',
    fieldTime: fieldTimeByAgentId.has(agentId) ? 'compiled' : 'contract_pending',
    teamSynergy: synergyByAgentId.has(agentId) ? 'compiled_seed' : 'source_contract_pending',
    specialInteraction: specialInteractionByAgentId.has(agentId)
      ? 'compiled_capability'
      : 'not_applicable',
  },
}))
type CatalogDecisionContract = (typeof catalogDecisionMechanicContracts)[number]
type CatalogEffectContract = CatalogDecisionContract['effectContract']
type CurrentAgentDecisionMechanicContract = Omit<CatalogDecisionContract, 'effectContract'> & {
  effectContract: Omit<
    CatalogEffectContract,
    'runtimeDefaults' | 'effects' | 'functionalInputs'
  > & {
    effects: (
      | CatalogEffectContract['effects'][number]
      | (typeof phoenixDecisionEffects33)[number]
      | (typeof severianDecisionEffects33)[number]
    )[]
    functionalInputs:
      | CatalogEffectContract['functionalInputs']
      | typeof phoenixDecisionFunctionalInputs33
      | typeof severianDecisionFunctionalInputs33
    runtimeDefaults: {
      references: Record<string, unknown>
      source: CatalogEffectContract['runtimeDefaults']['source']
    }
  }
}

type PhoenixDecisionSource33 = {
  formulaPath?: unknown
  formulaSha256?: unknown
  formulaOrigin?: unknown
  formulaSha256Definition?: unknown
  rawSha256?: unknown
}

/** The reviewed event aggregate owns the formula identity; rawSha256 remains
 * the pinned source-document identity. Per-effect hashes identify local IR. */
export function isReviewedPhoenixDecisionSource33(source: PhoenixDecisionSource33) {
  return (
    source.formulaPath === phoenixEventOverlay.source.formulaPath &&
    source.formulaSha256 === phoenixEventOverlay.source.formulaSha256 &&
    source.formulaOrigin === 'soda_reviewed_source_text_decision_projection' &&
    source.formulaSha256Definition === phoenixEventOverlay.source.formulaSha256Definition &&
    source.rawSha256 === phoenixEventOverlay.source.rawSha256 &&
    source.formulaSha256 !== source.rawSha256
  )
}

const phoenixDecisionSource33 = {
  ...phoenixEventOverlay.source,
  formulaOrigin: 'soda_reviewed_source_text_decision_projection',
}

if (!isReviewedPhoenixDecisionSource33(phoenixDecisionSource33))
  throw new Error('Phoenix decision formula/source identity mismatch')

export function isReviewedSeverianDecisionSource33(source: PhoenixDecisionSource33) {
  return (
    source.formulaPath === severianEventOverlay.source.formulaPath &&
    source.formulaSha256 === severianEventOverlay.source.formulaSha256 &&
    source.formulaOrigin === 'soda_reviewed_source_text_decision_projection' &&
    source.formulaSha256Definition === severianEventOverlay.source.formulaSha256Definition &&
    source.rawSha256 === severianEventOverlay.source.rawSha256 &&
    source.formulaSha256 !== source.rawSha256
  )
}

const severianDecisionSource33 = {
  ...severianEventOverlay.source,
  formulaOrigin: 'soda_reviewed_source_text_decision_projection',
}

if (!isReviewedSeverianDecisionSource33(severianDecisionSource33))
  throw new Error('Severian decision formula/source identity mismatch')

const phoenixDecisionMechanicContract: CurrentAgentDecisionMechanicContract | null =
  currentGameDataSelection.gameVersion === '3.3'
    ? {
        agentId: 'agent-phoenix',
        resourceContract: null,
        effectContract: {
          externalId: '1641',
          upstreamKey: 'Phoenix',
          effects: phoenixDecisionEffects33,
          functionalInputs: phoenixDecisionFunctionalInputs33,
          runtimeDefaults: {
            references: {},
            source: {
              allStatPath: 'nanoka/3.3/zh/character/1641.json',
              allStatSha256: '237C5B060657DB1FD8ABABE6CD26FB275C325D74A67EDA481BDE6732C7D93DFE',
              mappedStatsPath: 'nanoka/3.3/zh/character/1641.json',
              mappedStatsSha256: '237C5B060657DB1FD8ABABE6CD26FB275C325D74A67EDA481BDE6732C7D93DFE',
            },
          },
          source: phoenixDecisionSource33,
        },
        fieldTimeContract: null,
        synergyContract: phoenixDecisionSynergy33,
        specialInteractionContract: null,
        readiness: {
          effectSource: classifyAgentEffectSource32({ effects: phoenixDecisionEffects33 }),
          resourceFlow: 'mechanic_contract_pending' as const,
          effectRecipient: 'compiled' as const,
          fieldTime: 'contract_pending' as const,
          teamSynergy: 'compiled_seed' as const,
          specialInteraction: 'not_applicable' as const,
        },
      }
    : null

const severianDecisionMechanicContract: CurrentAgentDecisionMechanicContract | null =
  currentGameDataSelection.gameVersion === '3.3'
    ? {
        agentId: 'agent-severian',
        resourceContract: null,
        effectContract: {
          externalId: '1631',
          upstreamKey: 'Severian',
          effects: severianDecisionEffects33,
          functionalInputs: severianDecisionFunctionalInputs33,
          runtimeDefaults: {
            references: {},
            source: {
              allStatPath: 'nanoka/3.3/zh/character/1631.json',
              allStatSha256: '89F3A03B90FCA880851352D6D686E6BBE658411D7B4CDF6B78D2A14A97FF5974',
              mappedStatsPath: 'nanoka/3.3/zh/character/1631.json',
              mappedStatsSha256: '89F3A03B90FCA880851352D6D686E6BBE658411D7B4CDF6B78D2A14A97FF5974',
            },
          },
          source: severianDecisionSource33,
        },
        fieldTimeContract: null,
        synergyContract: severianDecisionSynergy33,
        specialInteractionContract: null,
        readiness: {
          effectSource: classifyAgentEffectSource32({ effects: severianDecisionEffects33 }),
          resourceFlow: 'mechanic_contract_pending' as const,
          effectRecipient: 'compiled' as const,
          fieldTime: 'contract_pending' as const,
          teamSynergy: 'compiled_seed' as const,
          specialInteraction: 'not_applicable' as const,
        },
      }
    : null

export const currentAgentDecisionMechanicContracts: readonly CurrentAgentDecisionMechanicContract[] =
  Object.freeze([
    ...catalogDecisionMechanicContracts,
    ...(phoenixDecisionMechanicContract ? [phoenixDecisionMechanicContract] : []),
    ...(severianDecisionMechanicContract ? [severianDecisionMechanicContract] : []),
  ])

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
  effectRecipientReadyAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.effectRecipient === 'compiled')
    .map((item) => item.agentId),
  genericTemplateAgentIds: currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.effectSource === 'generic_template')
    .map((item) => item.agentId),
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
    'Graduation facts compile resource/state flow only when a named resource has a runtime edge, transition template and declared initial state; formula AST compiles effect recipients; current guide and reviewed aggregate exact-team observations compile observed partners and five source-backed field-time modes. Aggregate composition is neither a recommendation nor a strength label. Field-time values are shared planning-budget weights, not measured seconds or percentages. Historical continuity does not prove current strength and no seed or guide set is an exhaustive pair universe.',
})
