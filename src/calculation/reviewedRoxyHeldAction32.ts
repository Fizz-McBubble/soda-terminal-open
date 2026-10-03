import {
  reviewedRoxyResourceRules32,
  settleReviewedRoxyEnergySpend32,
} from './reviewedRoxyResourceSettlement32'
import {
  compileReviewedRoxyTapAction32,
  type ReviewedRoxyTapActionInput32,
} from './reviewedRoxyTapAction32'
import { resolveSourceEventQuantity32 } from './sourceEventQuantity32'
import { reviewedRoxyPreparedTriggersIdentity32 } from './reviewedRoxyPreparedTriggersIdentity32'

export type ReviewedRoxyHeldActionInput32 = Omit<ReviewedRoxyTapActionInput32, 'conditions'> & {
  mindscape?: number
  holdDurationSeconds: number
  conditions?: NonNullable<ReviewedRoxyTapActionInput32['conditions']> & {
    uninterruptedWhirlwind: boolean
    fullWhirlwindContact: boolean
    releaseWithoutJoystickMovement: boolean
    afterechoContactSeconds?: number
    afterechoCompletesWithinWindow?: boolean
  }
}

export const reviewedRoxyHeldActionIdentity32 = Object.freeze({
  revision: 'reviewed-roxy-prepared-one-second-held-m0-m6-r3',
  mindscapeRules: reviewedRoxyPreparedTriggersIdentity32,
  kitCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  dumpCommit: '1277ebca4b8a7a6c3bcbaac6d5708dc9f4a55f23',
  contractRef: "soda-source-ref:4f3e188aea8d94c5322afbe53a952b2b",
  releasePath: "soda-source-ref:55937822144525c0b816abb37188ae94",
  resourceAuthority: 'source-policy-bounded-accounting-not-exact-runtime-ledger',
})

/** A single uninterrupted held interval under the source kit's 30 Energy/s
 * contract. The two retained modifier attachment states permit a conservative
 * allowance of up to two -0.1*30 entry adjustments. This does not decide whether
 * either adjustment is additional to the continuous drain or part of it.
 * No animation duration or repeatable rotation is inferred. */
export function compileReviewedRoxyHeldAction32(input: ReviewedRoxyHeldActionInput32) {
  const tap = compileReviewedRoxyTapAction32(input)
  const reasons = tap.status === 'unsupported' ? [...tap.reasons] : []
  const mindscape = input.mindscape ?? 0
  if (!Number.isInteger(mindscape) || mindscape < 0 || mindscape > 6)
    reasons.push('invalid_roxy_mindscape')
  if (
    mindscape === 6 &&
    (input.conditions?.afterechoContactSeconds !== 2 ||
      input.conditions?.afterechoCompletesWithinWindow !== true)
  )
    reasons.push('two_complete_afterecho_storms_within_window_required')
  if (input.preparedState.energy < 46)
    reasons.push('insufficient_energy_for_full_held_spend_envelope')
  if (input.holdDurationSeconds !== 1) reasons.push('one_second_held_policy_required')
  if (input.conditions?.uninterruptedWhirlwind !== true)
    reasons.push('single_uninterrupted_whirlwind_required')
  if (input.conditions?.fullWhirlwindContact !== true)
    reasons.push('full_whirlwind_contact_required')
  if (input.conditions?.releaseWithoutJoystickMovement !== true)
    reasons.push('release_without_joystick_required')
  if (reasons.length || tap.status !== 'supported')
    return {
      status: 'unsupported' as const,
      reasons,
      eventUsages: [] as typeof tap.eventUsages,
      sourceIdentity: reviewedRoxyHeldActionIdentity32,
      resourceLegality: { legal: false as const },
      formalCyclePromotion: false as const,
    }
  const whirlwind = {
    ownerAgentId: 'agent-roxy',
    eventId: 'special.EXSpecialAttackDontCatchAChill.hit-1',
    skillLevel: input.skillLevel,
    occurrenceCount: 1,
    durationSeconds: 1,
    evidenceRefs: [
      reviewedRoxyHeldActionIdentity32.contractRef,
      `${reviewedRoxyHeldActionIdentity32.kitCommit}:libs/zzz/dm-localization/assets/locales/en/char_Roxy_gen.json#/special/EXSpecialAttackDontCatchAChill/params/3`,
      'reviewed-scenario:single-uninterrupted-held-second-full-contact-constant-state',
    ],
  }
  if (resolveSourceEventQuantity32(whirlwind).status !== 'supported')
    return {
      status: 'unsupported' as const,
      reasons: ['shared_source_quantity_contract_mismatch'],
      eventUsages: [] as typeof tap.eventUsages,
      sourceIdentity: reviewedRoxyHeldActionIdentity32,
      resourceLegality: { legal: false as const },
      formalCyclePromotion: false as const,
    }
  return {
    status: 'supported' as const,
    eventUsages: [tap.eventUsages[0]!, whirlwind, ...tap.eventUsages.slice(1)].map((usage) =>
      mindscape === 6 && usage.eventId === 'special.EyeOfTheStorm.hit-2'
        ? {
            ...usage,
            occurrenceCount: 3,
            durationSeconds: 3,
            evidenceRefs: [
              ...usage.evidenceRefs,
              `${reviewedRoxyPreparedTriggersIdentity32.localizationPath}#/mindscapes/6`,
            ],
          }
        : usage,
    ),
    sourceIdentity: reviewedRoxyHeldActionIdentity32,
    resourceLegality: {
      legal: true as const,
      castThreshold: 25,
      initialEnergy: input.preparedState.energy,
      sourceResourceRules: reviewedRoxyResourceRules32,
      initialEnergyCost: 10,
      heldEnergyPerSecond: 30,
      maximumEntryApplications: 2,
      entryAccountingAllowance: [0, 6] as const,
      totalEnergySpendRange: [40, 46] as const,
      minimumEnergyWithoutRecovery: input.preparedState.energy - 46,
      terminalEnergyRange: [
        input.preparedState.energy - 46,
        input.preparedState.energyCapacity,
      ] as const,
      exactTerminalEnergy: null,
      rangeCondition: 'single-source-held-second-nonnegative-recovery-capacity-clamping',
      windEnergy: { initial: 3, capacity: 3, maximumDuringHold: 3, consumedByRelease: 3, final: 0 },
      eyes: tap.resourceLegality.eyes,
      consumptionAccumulator: {
        initial: input.preparedState.energyConsumptionAccumulator,
        maximumWhileWindFull: 25,
        sourcePolicyFinal: 25,
        exactFinal: null,
        settlements: [40, 46].map((energySpent) =>
          settleReviewedRoxyEnergySpend32({
            windEnergy: input.preparedState.windEnergy,
            energyConsumptionAccumulator: input.preparedState.energyConsumptionAccumulator,
            energySpent,
          }),
        ),
      },
      terminalSourcePolicyState: {
        energyRange: [input.preparedState.energy - 46, input.preparedState.energyCapacity] as const,
        windEnergy: 0,
        groundEyes: 0,
        energyConsumptionAccumulator: 25,
        exactRuntimeStateProven: false as const,
      },
      conversionBoundary:
        'spend-settlement-only; Wind-full caps accumulator, Wind-decrement does not dispatch settlement; no drain after held exit',
      hammerBranch: tap.resourceLegality.hammerBranch,
      windflow: {
        initial: 0,
        earned: mindscape >= 2 ? 3 : 0,
        consumed: 0,
        freeWhirlwindSeconds: 0,
        switchedDuringHold: false,
      },
      afterecho: {
        additionalStorms: mindscape === 6 ? 2 : 0,
        offsetsAfterPrimaryStormSeconds: mindscape === 6 ? [3, 6] : [],
        totalContactSeconds: mindscape === 6 ? 3 : 1,
      },
      resourceBasis: tap.sourceIdentity.resourceBasis,
    },
    boundaries: {
      ...tap.boundaries,
      kind: 'finite_prepared_one_second_held_chain' as const,
      heldWhirlwindIncluded: true,
      exactDrainAccountingResolved: false,
      measuredFieldTimeSeconds: null,
      resourceAuthority: 'source-policy-conservative-envelope' as const,
      maximumMindscape: 6,
      consumerMustEnforceP0: true,
    },
    formalCyclePromotion: false as const,
  }
}
