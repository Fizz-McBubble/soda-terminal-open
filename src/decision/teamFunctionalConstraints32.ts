import {
  preservesReviewedFunctionalCapacities32,
  type ReviewedFunctionalCapacity32,
} from '../calculation/reviewedFunctionalCapacity32'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'

/** Anomaly actors use both anomaly stats for their declared purpose. Other
 * specialties can still have source-defined conversions or team buffs that
 * depend on either stat, so inspect source expressions rather than role alone.
 * Missing contracts remain conservative. */
export function protectedAnomalyUtility32(agentId: string) {
  const event = getCurrentAgentEventContract(agentId)
  const decision = getCurrentAgentDecisionMechanicContract(agentId)
  if (!event || !decision || event.identity.specialty === 'anomaly') return [true, true] as const
  const expressions = JSON.stringify([
    decision.effectContract.effects,
    decision.effectContract.functionalInputs,
  ])
  return ['anomMas', 'anomProf'].map(
    (stat) =>
      new RegExp(`"path":"(?:own|self)\\.(?:initial|final)\\.${stat}"`).test(expressions) ||
      (stat === 'anomMas' &&
        event.eventContract.events.some((row) => {
          const operator = row.operators.anomalyBuildup
          if (operator.kind === 'constant') return operator.value > 0
          return (
            ('base' in operator && typeof operator.base === 'number' && operator.base > 0) ||
            ('growthPerLevel' in operator &&
              typeof operator.growthPerLevel === 'number' &&
              operator.growthPerLevel > 0)
          )
        })),
  )
}

export function sourceReviewedProtectedUtilityIndices32(agentId: string) {
  const anomaly = protectedAnomalyUtility32(agentId)
  return [0, 1, ...(anomaly[0] ? [2] : []), ...(anomaly[1] ? [3] : [])]
}

/** Numeric functional outcomes supersede only the raw stat they actually cover.
 * Natural recovery has a sourced rate; full energy and anomaly cadence remain separate. */
export function preservesTeamFunctionalConstraints32(input: {
  baselineCapacities: readonly ReviewedFunctionalCapacity32[]
  candidateCapacities: readonly ReviewedFunctionalCapacity32[]
  /** impact, energy regeneration, anomaly mastery, anomaly proficiency */
  baselineUtility: ReadonlyMap<string, readonly number[]>
  candidateUtility: ReadonlyMap<string, readonly number[]>
  /** Explicit source-reviewed indices; absent agents retain all four guards. */
  protectedUtilityIndicesByAgentId?: ReadonlyMap<string, readonly number[]>
}) {
  if (!preservesReviewedFunctionalCapacities32(input.baselineCapacities, input.candidateCapacities))
    return false
  return [...input.baselineUtility].every(([agentId, baseline]) => {
    const current = input.candidateUtility.get(agentId)
    if (
      !current ||
      baseline.length !== 4 ||
      current.length !== 4 ||
      [...baseline, ...current].some((value) => !Number.isFinite(value))
    )
      return false
    const eventImpactCovered = input.baselineCapacities.some(
      (row) => row.key === `${agentId}:source_daze_basis` && row.kind === 'source_daze_basis',
    )
    const energyRateCovered = input.baselineCapacities.some(
      (row) =>
        row.key === `${agentId}:natural_energy_recovery_rate` &&
        row.kind === 'natural_energy_recovery_rate' &&
        row.value !== null,
    )
    const anomalyMasteryCovered = input.baselineCapacities.some(
      (row) =>
        row.key.startsWith(`${agentId}:`) && row.kind === 'anomaly_mastery' && row.value !== null,
    )
    const protectedIndices = input.protectedUtilityIndicesByAgentId?.get(agentId) ?? [0, 1, 2, 3]
    if (protectedIndices.some((index) => !Number.isInteger(index) || index < 0 || index > 3))
      return false
    return baseline.every(
      (value, index) =>
        (index === 0 && eventImpactCovered) ||
        (index === 1 && energyRateCovered) ||
        (index === 2 && anomalyMasteryCovered) ||
        !protectedIndices.includes(index) ||
        current[index]! + 1e-9 >= value,
    )
  })
}
