import { clamp, finite } from './numeric'
/** Source-text semantics, deliberately different from GO@3456cd0 second-roll extrapolation.
 * Source: char_Claret_gen.json / core.desc[*][1], blob 2aea405b533c0fcb93fa8f28cf753f23cec305dc.
 * One ordinary check followed by at most one additional check; not a whole-character model.
 */
export const lacerationProbabilityVersion = 'source-text-two-check-probability-r1'
export function boundedLacerationMultipliers(critRate: number, lacerationDamage: number) {
  finite(critRate, 'crit_rate', 0)
  finite(lacerationDamage, 'laceration_damage', 0)
  const first = clamp(critRate, 0, 1)
  const secondGivenFirst = clamp(critRate - 1, 0, 1)
  const nonCriticalProbability = 1 - first
  const criticalProbability = first * (1 - secondGivenFirst)
  const doubleCriticalProbability = first * secondGivenFirst
  const critical = 1 + lacerationDamage
  const expected =
    nonCriticalProbability +
    criticalProbability * critical +
    doubleCriticalProbability * critical ** 2
  finite(expected, 'laceration_expectation', 0)
  return {
    nonCritical: 1,
    critical,
    doubleCritical: critical ** 2,
    expected,
    probabilities: {
      nonCritical: nonCriticalProbability,
      critical: criticalProbability,
      doubleCritical: doubleCriticalProbability,
    },
  }
}
