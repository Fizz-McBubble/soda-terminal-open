/** Source partial-order settlement, not a measured combat timeline. The full
 * Wind accumulator cap is retained from the adopted release dump contract;
 * it is not promoted from the new supplement's community prestorage claim. */
export const reviewedRoxyResourceRules32 = Object.freeze({
  energyCapacity: 120,
  baseEnergyRegenPerSecond: 1.2,
  castThreshold: 25,
  initialSpend: 10,
  heldSpendPerSecond: 30,
  windCapacity: 3,
  consumptionThreshold: 25,
  ultimateWindOnCompletion: 1,
  evidenceRef:
    "soda-source-ref:fd853e4bc610fc016e9347a4c09b37fe",
})

/** Consumption dispatch only. Wind consumption itself does not settle banked
 * Energy. Preserves the remainder across calls and accounts for capped excess. */
export function settleReviewedRoxyEnergySpend32(input: {
  windEnergy: number
  energyConsumptionAccumulator: number
  energySpent: number
}) {
  const { windEnergy, energyConsumptionAccumulator, energySpent } = input
  if (
    !Number.isInteger(windEnergy) ||
    windEnergy < 0 ||
    windEnergy > 3 ||
    !Number.isFinite(energyConsumptionAccumulator) ||
    energyConsumptionAccumulator < 0 ||
    energyConsumptionAccumulator > 25 ||
    (windEnergy < 3 && energyConsumptionAccumulator >= 25) ||
    !Number.isFinite(energySpent) ||
    energySpent < 0
  )
    return { status: 'unsupported' as const, reasons: ['invalid_roxy_resource_settlement'] }
  const accumulated = energyConsumptionAccumulator + energySpent
  if (!Number.isFinite(accumulated))
    return { status: 'unsupported' as const, reasons: ['invalid_roxy_resource_settlement'] }
  const windGranted = Math.min(3 - windEnergy, Math.floor(accumulated / 25))
  const remainder = accumulated - windGranted * 25
  const finalAccumulator = Math.min(25, remainder)
  return {
    status: 'supported' as const,
    windEnergy: windEnergy + windGranted,
    energyConsumptionAccumulator: finalAccumulator,
    windGranted,
    discardedConsumptionAtCap: remainder - finalAccumulator,
    sourcePolicyOnly: true as const,
    runtimeSelectorProven: false as const,
  }
}
