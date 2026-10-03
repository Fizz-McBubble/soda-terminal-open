import { settleReviewedRoxyEnergySpend32 } from './reviewedRoxyResourceSettlement32'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import {
  resolveSourceEventQuantity32,
  sourceEventQuantityIdentity32,
} from './sourceEventQuantity32'

/** Internal source-action conditions, supplied by a reviewed scenario consumer.
 * These are not player inputs or observations inferred from animation dispatch. */
export type ReviewedRoxyTapActionInput32 = {
  skillLevel: number
  preparedState: {
    energy: number
    energyCapacity: number
    windEnergy: number
    groundEyes: number
    energyConsumptionAccumulator: number
  }
  conditions?: {
    directDamageContacts: boolean
    createdEyes: number
    simultaneousHammerEyeContacts: number
    hammerBeforeEyeExpiry: boolean
    eyeBlastContacts: number
    giantWindstormContactSeconds: number
    constantDamageState: boolean
  }
}

export const reviewedRoxyTapActionIdentity32 = Object.freeze({
  revision: 'reviewed-roxy-prepared-tap-finite-chain-r2',
  ownerAgentId: 'agent-roxy',
  kitCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  dumpCommit: '1277ebca4b8a7a6c3bcbaac6d5708dc9f4a55f23',
  dumpRelease: 'CNPRODWin3.2.0_R19329161_S19159270_D19329161',
  contractRef: "soda-source-ref:4f3e188aea8d94c5322afbe53a952b2b",
  quantityRevision: sourceEventQuantityIdentity32.revision,
  resourceBasis:
    'reviewed-community-initial10-and-release-config-record982; runtime-selector-not-proven',
})

const textRef = `${reviewedRoxyTapActionIdentity32.kitCommit}:libs/zzz/dm-localization/assets/locales/en/char_Roxy_gen.json`
const eventRows = [
  ['EXSpecialAttackDontCatchAChill', 0, 1, 'action_total'],
  ['EXSpecialAttackKindlyRestInPeace', 0, 1, 'action_total'],
  ['EXSpecialAttackKindlyRestInPeace', 1, 3, 'per_wind_energy_consumed'],
  ['SpecialAttackForgiveMeForNotSeeingYouOff', 0, 1, 'action_total'],
  ['EyeOfTheStorm', 0, 3, 'per_eye_detonated'],
  ['EyeOfTheStorm', 2, 1, 'per_second'],
] as const

/** Compiles a finite prepared-state tap EX into existing shared formula units.
 * No startup/hit time, teammate action, held loop, or damage formula is invented. */
export function compileReviewedRoxyTapAction32(input: ReviewedRoxyTapActionInput32) {
  const reasons: string[] = []
  const state = input.preparedState
  // Shared source special-skill table supports effective levels 1..16.
  if (!Number.isInteger(input.skillLevel) || input.skillLevel < 1 || input.skillLevel > 16)
    reasons.push('unsupported_skill_level')
  const energyLegal =
    Number.isFinite(state.energy) &&
    Number.isFinite(state.energyCapacity) &&
    state.energy >= 25 &&
    state.energyCapacity === 120 &&
    state.energy <= state.energyCapacity
  if (!energyLegal) reasons.push('insufficient_or_invalid_prepared_energy')
  if (state.windEnergy !== 3) reasons.push('requires_prepared_wind_energy_3')
  if (state.groundEyes !== 0) reasons.push('requires_prepared_ground_eyes_0')
  const settlement = settleReviewedRoxyEnergySpend32({
    windEnergy: state.windEnergy,
    energyConsumptionAccumulator: state.energyConsumptionAccumulator,
    energySpent: 10,
  })
  if (settlement.status !== 'supported') reasons.push(...settlement.reasons)
  const conditions = input.conditions
  if (!conditions) reasons.push('missing_contact_and_constant_state_conditions')
  else {
    if (conditions.directDamageContacts !== true)
      reasons.push('direct_damage_contacts_not_confirmed')
    if (conditions.createdEyes !== 3) reasons.push('three_completed_eye_creations_required')
    if (conditions.simultaneousHammerEyeContacts !== 3)
      reasons.push('three_simultaneous_hammer_eye_contacts_required')
    if (conditions.hammerBeforeEyeExpiry !== true) reasons.push('hammer_before_eye_expiry_required')
    if (conditions.eyeBlastContacts !== 3) reasons.push('three_eye_blast_contacts_required')
    if (conditions.giantWindstormContactSeconds !== 1)
      reasons.push('full_one_second_giant_contact_required')
    if (conditions.constantDamageState !== true) reasons.push('constant_damage_state_required')
  }
  if (reasons.length || settlement.status !== 'supported')
    return {
      status: 'unsupported' as const,
      reasons,
      eventUsages: [] as PlanningEventUsage[],
      sourceIdentity: reviewedRoxyTapActionIdentity32,
      resourceLegality: { legal: false as const },
      formalCyclePromotion: false as const,
    }

  const eventUsages: PlanningEventUsage[] = eventRows.map(([skill, row, count, measure]) => ({
    ownerAgentId: 'agent-roxy',
    eventId: `special.${skill}.hit-${row}`,
    skillLevel: input.skillLevel,
    occurrenceCount: count,
    ...(measure === 'per_second' ? { durationSeconds: 1 } : {}),
    evidenceRefs: [
      reviewedRoxyTapActionIdentity32.contractRef,
      `${textRef}#/special/${skill}`,
      `source-measure:${measure}`,
      'reviewed-scenario:completed-creation-simultaneous-three-eye-contact-full-giant-second-constant-state',
    ],
  }))
  // The shared unit resolver remains the authority for coefficient/rate use.
  if (eventUsages.some((usage) => resolveSourceEventQuantity32(usage).status !== 'supported'))
    return {
      status: 'unsupported' as const,
      reasons: ['shared_source_quantity_contract_mismatch'],
      eventUsages: [] as PlanningEventUsage[],
      sourceIdentity: reviewedRoxyTapActionIdentity32,
      resourceLegality: { legal: false as const },
      formalCyclePromotion: false as const,
    }
  return {
    status: 'supported' as const,
    eventUsages,
    sourceIdentity: reviewedRoxyTapActionIdentity32,
    resourceLegality: {
      legal: true as const,
      castThreshold: 25,
      initialEnergyCost: 10,
      energyAfterInitialSpend: state.energy - 10,
      terminalEnergyRange: [state.energy - 10, state.energyCapacity] as const,
      exactTerminalEnergy: null,
      energyRangeCondition: 'nonnegative-passive-recovery-with-capacity-clamping',
      windEnergy: { initial: 3, capacity: 3, consumed: 3, final: 0 },
      eyes: { initial: 0, capacity: 9, created: 3, maximumInChain: 3, detonated: 3, final: 0 },
      consumptionAccumulator: {
        initial: state.energyConsumptionAccumulator,
        spent: 10,
        final: settlement.energyConsumptionAccumulator,
        conversionThreshold: 25,
        discardedConsumptionAtCap: settlement.discardedConsumptionAtCap,
      },
      hammerBranch: { windPlusGroundEyesAtReleaseCheck: 3, enabled: true },
    },
    boundaries: {
      kind: 'finite_prepared_tap_chain' as const,
      contactAuthority: 'supplied_reviewed_scenario_conditions' as const,
      timingAuthority: 'source_partial_order_only' as const,
      measuredFieldTimeSeconds: null,
      repeatedRotation: false,
      heldWhirlwindIncluded: false,
      miniatureWindstormIncluded: false,
      wholeTeamFormal: false,
      runtimeResourceSelectorProven: false,
    },
    formalCyclePromotion: false as const,
  }
}
