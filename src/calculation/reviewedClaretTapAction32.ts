import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import { resolveCurrentAgentEvent } from './currentAgentMechanicContracts'
import { resolveSourceEventQuantity32 } from './sourceEventQuantity32'

/** Internal prepared comparison conditions, never player-input requirements. */
export type ReviewedClaretTapActionInput32 = {
  skillLevel: number
  preparedState: { crimsonInscription: boolean; targetGash: number }
  conditions?: {
    upwardSlashContact: boolean
    horizontalSlashContact: boolean
    tapMaimContact: boolean
    constantDamageState: boolean
  }
}

export const reviewedClaretTapActionIdentity32 = Object.freeze({
  revision: 'reviewed-claret-prepared-tap-cleaving-r2',
  ownerAgentId: 'agent-claret',
  kitCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  dumpCommit: '1277ebca4b8a7a6c3bcbaac6d5708dc9f4a55f23',
  sourcePath: 'libs/zzz/stats/Data/Characters/Claret.json',
  localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_Claret_gen.json',
  contractRef: "soda-source-ref:6fdf9825b8238440b2a90bf52df1ab10",
  scope: 'source-M0-P0-finite-prepared-tap-only',
})

const actionId = 'SpecialAttackBloodbloomOathCleavingGoldAndIron'

/** One upward slash, one horizontal slash and one tap Maim; no held branch.
 * The consumer enforces source M0/P0 and binds the supplied Crimson state to
 * existing effect references. No energy ledger or measured timing is inferred. */
export function compileReviewedClaretTapAction32(input: ReviewedClaretTapActionInput32) {
  const reasons: string[] = []
  if (!Number.isInteger(input.skillLevel) || input.skillLevel < 1 || input.skillLevel > 16)
    reasons.push('unsupported_skill_level')
  if (input.preparedState.crimsonInscription !== true)
    reasons.push('prepared_crimson_inscription_required')
  // Core: a connected Maim consumes one stack. Requiring a full three-stack
  // target here prevents legal follow-up taps at two and one remaining stacks.
  if (
    !Number.isInteger(input.preparedState.targetGash) ||
    input.preparedState.targetGash < 1 ||
    input.preparedState.targetGash > 3
  )
    reasons.push('prepared_target_gash_1_to_3_required')
  if (!input.conditions) reasons.push('missing_contact_and_constant_state_conditions')
  else {
    if (input.conditions.upwardSlashContact !== true) reasons.push('upward_slash_contact_required')
    if (input.conditions.horizontalSlashContact !== true)
      reasons.push('horizontal_slash_contact_required')
    if (input.conditions.tapMaimContact !== true) reasons.push('tap_maim_contact_required')
    if (input.conditions.constantDamageState !== true)
      reasons.push('constant_damage_state_required')
  }
  const eventUsages: PlanningEventUsage[] = [0, 1, 2].map((row) => ({
    ownerAgentId: 'agent-claret',
    eventId: `special.${actionId}.hit-${row}`,
    skillLevel: input.skillLevel,
    occurrenceCount: 1,
    evidenceRefs: [
      reviewedClaretTapActionIdentity32.contractRef,
      `${reviewedClaretTapActionIdentity32.kitCommit}:${reviewedClaretTapActionIdentity32.sourcePath}#/skillParams/special/${actionId}/${row}`,
      `${reviewedClaretTapActionIdentity32.kitCommit}:${reviewedClaretTapActionIdentity32.localizationPath}#/special/${actionId}/desc`,
      'source-measure:one-complete-tap-row',
      `${reviewedClaretTapActionIdentity32.kitCommit}:${reviewedClaretTapActionIdentity32.localizationPath}#/core/desc/0/0`,
      `reviewed-scenario:prepared-crimson-gash${input.preparedState.targetGash}-three-contacts-constant-state`,
    ],
  }))
  if (!reasons.length)
    for (const usage of eventUsages) {
      const resolved = resolveCurrentAgentEvent({ stableId: 'agent-claret', ...usage })
      if (
        resolved.status !== 'supported' ||
        resolved.source.commit !== reviewedClaretTapActionIdentity32.kitCommit ||
        resolved.formulaProjection !== 'source_registered' ||
        resolved.formulaFamily !== 'sharp_damage' ||
        resolved.scalingAttribute !== 'def' ||
        resolved.damageType !== (usage.eventId.endsWith('hit-2') ? 'maim' : 'special') ||
        resolved.attribute !== 'electric' ||
        resolveSourceEventQuantity32(usage).status !== 'supported'
      )
        reasons.push(`shared_source_event_contract_mismatch:${usage.eventId}`)
    }
  if (reasons.length)
    return {
      status: 'unsupported' as const,
      reasons,
      eventUsages: [] as PlanningEventUsage[],
      sourceIdentity: reviewedClaretTapActionIdentity32,
      resourceLegality: { legal: false as const },
      formalCyclePromotion: false as const,
    }
  return {
    status: 'supported' as const,
    eventUsages,
    sourceIdentity: reviewedClaretTapActionIdentity32,
    resourceLegality: {
      legal: true as const,
      targetGash: {
        initial: input.preparedState.targetGash,
        capacity: 3,
        consumedByTapMaim: 1,
        final: input.preparedState.targetGash - 1,
      },
      crimsonInscription: { initial: true, maintainedDuringAction: true },
      scope: 'known-gash-and-crimson-action-legality-only' as const,
    },
    boundaries: {
      kind: 'finite_prepared_tap_cleaving' as const,
      contactAuthority: 'supplied_reviewed_scenario_conditions' as const,
      timingAuthority: 'source_partial_order_only' as const,
      measuredFieldTimeSeconds: null,
      energyLedger: null,
      repeatedRotation: false,
      heldIncluded: false,
      bloodBurialIncluded: false,
      wholeTeamFormal: false,
      consumerMustEnforceM0P0: true,
      consumerMustBindCrimsonEffectState: true,
    },
    formalCyclePromotion: false as const,
  }
}
