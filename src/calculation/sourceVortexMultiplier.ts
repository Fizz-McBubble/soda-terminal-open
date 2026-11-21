/** Accept an explicitly supplied, separately sourced settlement coefficient. */
export function sourceVortexMultiplier(baseMultiplier: number) {
  if (!Number.isFinite(baseMultiplier) || baseMultiplier <= 0)
    throw new Error('invalid_sourced_vortex_multiplier')
  return baseMultiplier
}
