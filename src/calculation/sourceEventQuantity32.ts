/** Table rows are coefficient units, not necessarily individual hits. */
export const sourceEventQuantityIdentity32 = Object.freeze({
  revision: 'roxy-explicit-rate-duration-r1',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  path: 'libs/zzz/dm-localization/assets/locales/en/char_Roxy_gen.json',
  sha256: '2479FD13C7812CBCE726361C41322997758236DC237665B3410CE2A820CC67BD',
  rateRows: {
    'special.EXSpecialAttackDontCatchAChill.hit-1': 'Whirlwind Per Second',
    'special.EyeOfTheStorm.hit-1': 'Miniature Windstorm per Second',
    'special.EyeOfTheStorm.hit-2': 'Giant Windstorm per Second',
  },
})

export function isSourceRateEvent32(ownerAgentId: string, eventId: string) {
  return (
    ownerAgentId === 'agent-roxy' && Object.hasOwn(sourceEventQuantityIdentity32.rateRows, eventId)
  )
}

/** Duration is total exposure across all occurrences, never a guessed tick count.
 * It describes integration under the caller's declared constant state. This
 * does not establish animation occupancy, physical ticks or a legal rotation. */
export function resolveSourceEventQuantity32(input: {
  ownerAgentId: string
  eventId: string
  occurrenceCount: number
  durationSeconds?: number
}) {
  if (!Number.isInteger(input.occurrenceCount) || input.occurrenceCount <= 0)
    return { status: 'unsupported' as const, reason: '事件次数必须是正整数。' }
  if (isSourceRateEvent32(input.ownerAgentId, input.eventId)) {
    if (!Number.isFinite(input.durationSeconds) || input.durationSeconds! <= 0)
      return {
        status: 'unsupported' as const,
        reason: '该倍率单位为每秒伤害，必须声明有效持续秒数，不能把表行当作单次命中。',
      }
    return { status: 'supported' as const, unit: 'seconds' as const, value: input.durationSeconds! }
  }
  if (input.durationSeconds !== undefined)
    return { status: 'unsupported' as const, reason: '非每秒倍率不能以持续时间放大伤害。' }
  return {
    status: 'supported' as const,
    unit: 'coefficient_uses' as const,
    value: input.occurrenceCount,
  }
}
