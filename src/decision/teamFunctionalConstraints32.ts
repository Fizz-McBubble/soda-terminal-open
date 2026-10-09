import {
  preservesReviewedFunctionalCapacities32,
  type ReviewedFunctionalCapacity32,
} from '../calculation/reviewedFunctionalCapacity32'

/** Numeric functional outcomes supersede only the raw stat they actually cover.
 * Natural recovery has a sourced rate; full energy and anomaly cadence remain separate. */
export function preservesTeamFunctionalConstraints32(input: {
  baselineCapacities: readonly ReviewedFunctionalCapacity32[]
  candidateCapacities: readonly ReviewedFunctionalCapacity32[]
  /** impact, energy regeneration, anomaly mastery, anomaly proficiency */
  baselineUtility: ReadonlyMap<string, readonly number[]>
  candidateUtility: ReadonlyMap<string, readonly number[]>
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
    return baseline.every(
      (value, index) =>
        (index === 0 && eventImpactCovered) ||
        (index === 1 && energyRateCovered) ||
        current[index]! + 1e-9 >= value,
    )
  })
}
