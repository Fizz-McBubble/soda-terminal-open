import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  compileCurrentPlanningBaselineResourceContracts,
  compileCurrentPlanningBaselineTimelineContracts,
  currentPlanningBaselineAgentObservations,
} from './currentPlanningBaselineObservations'
import {
  compileCurrentPlanningFormationEffectObservations,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectRuntime'
import { compileSourceBackedPlanningInteractionContracts } from './currentPlanningInteractionMechanicIR'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import type {
  PlanningInteractionContract,
  PlanningInteractionOperator,
} from './planningInteractionOperators'

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

const observationByAgentId = new Map(
  currentPlanningBaselineAgentObservations.map((observation) => [observation.agentId, observation]),
)

function compileAuxiliaryContracts(memberIds: readonly [string, string, string]) {
  const contracts: PlanningInteractionContract[] = []
  const baselineRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:auxiliary`
  const background = memberIds.flatMap((agentId) => {
    const observation = observationByAgentId.get(agentId)
    const mechanic = getCurrentAgentEventContract(agentId)
    const capability = getCurrentAgentDecisionMechanicContract(agentId)?.fieldTimeContract
    if (!observation || !mechanic || observation.fieldTimeMode !== 'background' || !capability)
      return []
    const level60BaseAttack = mechanic.baseStats.atk_base + mechanic.baseStats.atk_growth * 59
    return [
      {
        observation,
        damagePerOccurrence:
          (level60BaseAttack * observation.normalizedDamageMultiplier) /
          observation.occurrenceCount,
      },
    ]
  })
  if (background.length > 0) {
    contracts.push({
      contractId: `${currentNormalizedPlanningBaseline.baselineId}:${memberIds.join('+')}:off-field`,
      operator: 'off_field_shared_damage',
      authority: 'source_backed',
      sourceRefs: unique([
        baselineRef,
        ...background.flatMap(({ observation }) => [
          ...observation.eventSourceRefs,
          ...observation.fieldTimeSourceRefs,
        ]),
      ]),
      events: background.map(({ observation, damagePerOccurrence }) => ({
        eventKey: `${observation.agentId}:${observation.actionId}:off-field`,
        ownerAgentId: observation.agentId,
        attribution: 'own',
        damagePerOccurrence,
        occurrenceCount: observation.occurrenceCount,
      })),
    })
  }

  for (const agentId of memberIds) {
    const decision = getCurrentAgentDecisionMechanicContract(agentId)
    const special = decision?.specialInteractionContract
    if (!special) continue
    contracts.push({
      contractId: `${currentNormalizedPlanningBaseline.baselineId}:${agentId}:chain-conversion`,
      operator: 'chain_ultimate_conversion',
      authority: 'source_backed',
      sourceRefs: unique([baselineRef, special.source.sourceId, special.source.locator]),
      initialChainCount: 0,
      initialUltimateCount: 0,
      chainToUltimateCount: 0,
      ultimateToChainCount: 0,
      extraChainCount: 0,
    })
  }
  return contracts
}

export function compileCurrentPlanningInteractionBundle(input: {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}) {
  const timeline = compileCurrentPlanningBaselineTimelineContracts(input.memberIds)
  if (timeline.status === 'unsupported') return timeline
  const resources = compileCurrentPlanningBaselineResourceContracts(input.memberIds)
  if (resources.status === 'unsupported') return resources
  const effects = compileCurrentPlanningFormationEffectObservations(input)
  if (effects.status === 'unsupported') return effects
  const auxiliary = compileAuxiliaryContracts(input.memberIds)
  const contracts = [
    ...timeline.contracts,
    ...resources.contracts,
    ...effects.contracts,
    ...auxiliary,
  ]
  const requiredOperators = unique(
    contracts.map((contract) => contract.operator),
  ) as PlanningInteractionOperator[]
  const compilation = compileSourceBackedPlanningInteractionContracts({
    memberIds: input.memberIds,
    contracts,
    requiredOperators,
  })
  if (compilation.status === 'unsupported') return compilation
  return {
    status: 'supported' as const,
    contracts,
    requiredOperators,
    effectDispositions: effects.dispositions,
    sourceCompilation: compilation,
    bundleHash: stableContentHash({
      memberIds: input.memberIds,
      contracts,
      effectDispositions: effects.dispositions,
    }),
  }
}
