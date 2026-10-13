import { evaluateCurrentBangbooPlanningParameter } from './currentBangbooPlanningAdapter'
import type { AdditionalContractDefinition } from './currentBangbooMechanicDefinitions'
import type {
  BangbooComparableSlice,
  BangbooUtilityProjectionInput,
  BangbooUtilityPurpose,
} from './currentBangbooUtilityProjectionTypes'

const cache = new Map<string, BangbooComparableSlice | null>()

/** A fixed source-event capacity, never a battle rotation or a comparison of raw bonuses. */
export function projectBangbooFixedUtilityCapacity(
  input: BangbooUtilityProjectionInput,
  purpose: BangbooUtilityPurpose,
  definition: AdditionalContractDefinition,
): BangbooComparableSlice | undefined {
  if (!['bangboo_damage', 'daze', 'anomaly'].includes(purpose)) return undefined
  if (input.activationStatus === 'unknown') return undefined
  // With no event flags or accumulators, this slice depends only on the activated
  // source contract, not on the identities of other trios satisfying that contract.
  const cacheKey = `${input.bangbooId}|${input.stars}|${input.activationStatus}|${purpose}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? undefined
  const result = evaluateCurrentBangbooPlanningParameter({
    stableId: input.bangbooId,
    stars: input.stars,
    memberIds: input.memberIds as readonly [string, string, string],
    additionalAbilityEnabled: input.activationStatus === 'active',
  })
  let slice: BangbooComparableSlice | undefined
  const key = {
    purpose,
    unit: 'fixed_event_expected_damage',
    receiver: 'one_normalized_enemy',
    trigger: 'one_active_and_one_chain',
    isDeterministic: true,
    deliveryModel: 'level60_skill10_fixed_source_events',
    capacityBasis: JSON.stringify(result.settledEnemyConditions),
  }
  if (
    result.status === 'supported' &&
    purpose === 'bangboo_damage' &&
    result.directDamage !== null
  ) {
    slice = { key, value: result.directDamage }
  } else if (
    result.status === 'supported' &&
    result.stats &&
    (purpose === 'anomaly' || purpose === 'daze')
  ) {
    const stat = purpose === 'anomaly' ? 'anomaly_buildup' : 'daze'
    const attributes = [
      ...new Set(
        [...(definition.allOf ?? []), ...(definition.anyOf ?? [])]
          .filter((condition) => condition.key.startsWith('attribute:'))
          .map((condition) => condition.key),
      ),
    ]
    // The catalogue does not expose an independently verified element for every
    // Bangboo. Do not compare accumulation into different or unknown gauges.
    const attribute = attributes.length === 1 ? attributes[0] : undefined
    if (purpose !== 'anomaly' || attribute) {
      const bases = result.outputs.filter((output) => output.stat === stat)
      const modifiers = result.outputs.filter((output) => output.mechanic === `${stat}_multiplier`)
      let complete = true
      const value = bases.reduce((sum, base) => {
        const action = String(base.action)
        let bonus = 0
        for (const modifier of modifiers) {
          const target = String(modifier.targetAction)
          if (![action, 'all', 'active_and_chain'].includes(target)) {
            if (target.startsWith(`${action}:`)) complete = false
            continue
          }
          const values = Array.isArray(modifier.values) ? modifier.values.map(Number) : []
          if (
            values.length !== 1 ||
            !Number.isFinite(values[0]) ||
            modifier.accumulator !== undefined
          ) {
            complete = false
            continue
          }
          const chance = modifier.chance === undefined ? 1 : Number(modifier.chance)
          if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
            complete = false
            continue
          }
          bonus += values[0]! * chance
        }
        return sum + Number(base.value) * (1 + bonus)
      }, 0)
      if (bases.length && complete && Number.isFinite(value)) {
        slice = {
          key: {
            ...key,
            unit: `source_${stat}_coefficient`,
            receiver: attribute ?? 'one_normalized_enemy',
            // Compare only equal base efficiency; no undocumented conversion
            // from a source coefficient to actual enemy gauge points.
            capacityBasis: `${purpose === 'anomaly' ? result.stats.anomalyMastery : result.stats.breakStun}`,
          },
          value,
        }
      }
    }
  }
  cache.set(cacheKey, slice ?? null)
  return slice
}
