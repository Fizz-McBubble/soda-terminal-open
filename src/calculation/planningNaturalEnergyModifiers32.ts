import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'

/** The supplied final panel holds its existing observation. New combat
 * percentages use the completed initial rate, matching the source stat layer. */
export function applyPlanningNaturalEnergyModifiers32(
  initialRate: number,
  finalRate: number,
  buckets: readonly SourceBackedPlanningEffectBucket[],
) {
  const percent = buckets
    .filter((row) => row.application === 'energy_regen_percent')
    .reduce((sum, row) => sum + row.value, 0)
  const flat = buckets
    .filter((row) => row.application === 'energy_regen_flat')
    .reduce((sum, row) => sum + row.value, 0)
  const value = finalRate + initialRate * percent + flat
  return [initialRate, finalRate, percent, flat, value].every(Number.isFinite) &&
    initialRate >= 0 &&
    finalRate >= 0 &&
    value >= 0
    ? { status: 'supported' as const, value }
    : { status: 'unsupported' as const, blockers: ['invalid_final_energy_recovery_rate'] }
}
