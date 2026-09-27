export type WarehouseInvestmentAssessment = 'poor_seed' | 'failed_rolls' | null

export type WarehouseInvestmentAssessmentInput = {
  /** The sub-stat ledger was complete enough to derive the supplied roll counts. */
  historyKnown: boolean
  level: number
  slot: number
  remainingRollOpportunities: number
  unlocksRemaining: 0 | 1
  /**
   * The lowest known non-target-roll count across every current demand role.
   * A role that still values a landing must keep this value low.
   */
  minKnownNonTargetRolls: number | null
  /**
   * The highest realized effective-roll count across every current demand role.
   * A role with a stronger present use must keep this value high.
   */
  maxRealizedEffectiveRolls: number | null
  /** One finished physical same-class replacement covers every current demand role. */
  hasCompletedCoverageAlternative: boolean
  /** The account owns a current agent or saved team that actually demands this class. */
  hasMeaningfulDemand: boolean
}

function isNonNegativeInteger(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0
}

/**
 * Returns a local stop-investment direction only. It does not claim that a
 * disc has no mathematical upside, predict game roll probability, define a
 * source-backed graduation line, or authorize cleanup. Callers must retain
 * their independent ownership, demand, and deletion safeguards.
 *
 * The aggregate inputs deliberately fail closed: use the minimum missed-roll
 * count and maximum present effective count across all demanded roles. This
 * prevents one role's poor landings from overriding another role's useful use.
 */
export function assessWarehouseInvestment(
  input: WarehouseInvestmentAssessmentInput,
): WarehouseInvestmentAssessment {
  if (
    !input.historyKnown ||
    !input.hasMeaningfulDemand ||
    !input.hasCompletedCoverageAlternative ||
    !Number.isInteger(input.level) ||
    input.level < 0 ||
    !Number.isInteger(input.slot) ||
    input.slot < 1 ||
    input.slot > 6 ||
    !isNonNegativeInteger(input.remainingRollOpportunities) ||
    (input.unlocksRemaining !== 0 && input.unlocksRemaining !== 1) ||
    !isNonNegativeInteger(input.minKnownNonTargetRolls) ||
    !isNonNegativeInteger(input.maxRealizedEffectiveRolls)
  )
    return null

  // Fixed-main-stat slots are plentiful enough to pause a one-effective-line
  // embryo early. Variable-main-stat slots remain protected for scarcity.
  if (input.slot <= 3 && input.level <= 3 && input.maxRealizedEffectiveRolls <= 1)
    return 'poor_seed'

  // This is intentionally stricter than the generic retention floor: it only
  // pauses an already-developed disc after two misses, when a finished demand
  // replacement exists and even the best demanded role has at most three hits.
  if (
    input.maxRealizedEffectiveRolls <= 3 &&
    input.minKnownNonTargetRolls >= 2 &&
    input.remainingRollOpportunities <= 2
  )
    return 'failed_rolls'

  return null
}
