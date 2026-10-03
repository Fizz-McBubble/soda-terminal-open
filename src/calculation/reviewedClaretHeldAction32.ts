import { resolveCurrentAgentEvent } from './currentAgentMechanicContracts'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import { resolveSourceEventQuantity32 } from './sourceEventQuantity32'
import { reviewedClaretTapActionIdentity32 } from './reviewedClaretTapAction32'

export type ReviewedClaretHeldActionInput32 = {
  skillLevel: number
  preparedState: { crimsonInscription: boolean; targetGash: number }
  conditions: {
    upwardSlashContact: boolean
    completeBloodBurialContact: boolean
    heldMaimContacts: number
    constantDamageState: boolean
    uninterruptedBloodBurial: boolean
  }
}

export const reviewedClaretHeldActionIdentity32 = Object.freeze({
  ...reviewedClaretTapActionIdentity32,
  revision: 'reviewed-claret-prepared-blood-burial-aggregate-r1',
  contractRef: "soda-source-ref:d724aa2504f262c7ecd3aad4fd68aa8e",
  maimSource: 'https://www.kocpc.com.tw/archives/669096',
  maimLocator: '特殊技派生: three held detonations equal three separate tap detonations',
  scope: 'source-M0-M6-P0-finite-prepared-held-constant-state',
})

/** Ordinary damage is a complete-move coefficient, not three physical-hit
 * copies. The three Maims share the tap coefficient only within the declared
 * constant effect state. This does not resolve variable Basic3 extensions. */
export function compileReviewedClaretHeldAction32(input: ReviewedClaretHeldActionInput32) {
  const reasons: string[] = []
  if (!Number.isInteger(input.skillLevel) || input.skillLevel < 1 || input.skillLevel > 16)
    reasons.push('unsupported_skill_level')
  if (input.preparedState.crimsonInscription !== true)
    reasons.push('prepared_crimson_inscription_required')
  if (input.preparedState.targetGash !== 3) reasons.push('prepared_target_gash_3_required')
  if (
    input.conditions.upwardSlashContact !== true ||
    input.conditions.completeBloodBurialContact !== true ||
    input.conditions.heldMaimContacts !== 3 ||
    input.conditions.uninterruptedBloodBurial !== true
  )
    reasons.push('complete_held_three_maim_contacts_required')
  if (input.conditions.constantDamageState !== true)
    reasons.push('constant_damage_state_required_for_maim_aggregate')
  const rows = [
    ['special.SpecialAttackBloodbloomOathCleavingGoldAndIron.hit-0', 1, 'special'],
    ['special.SpecialAttackBloodbloomOathBloodBurialAssault.hit-0', 1, 'special'],
    ['special.SpecialAttackBloodbloomOathCleavingGoldAndIron.hit-2', 3, 'maim'],
  ] as const
  const eventUsages: PlanningEventUsage[] = rows.map(([eventId, occurrenceCount]) => ({
    ownerAgentId: 'agent-claret',
    eventId,
    skillLevel: input.skillLevel,
    occurrenceCount,
    evidenceRefs: [
      reviewedClaretHeldActionIdentity32.contractRef,
      reviewedClaretHeldActionIdentity32.maimSource,
      `${reviewedClaretHeldActionIdentity32.kitCommit}:${reviewedClaretHeldActionIdentity32.sourcePath}`,
      'source-measure:complete-blood-burial-coefficient-once-three-maim-coefficients',
    ],
  }))
  if (!reasons.length)
    for (const [index, usage] of eventUsages.entries()) {
      const resolved = resolveCurrentAgentEvent({ stableId: 'agent-claret', ...usage })
      if (
        resolved.status !== 'supported' ||
        resolved.source.commit !== reviewedClaretHeldActionIdentity32.kitCommit ||
        resolved.formulaFamily !== 'sharp_damage' ||
        resolved.scalingAttribute !== 'def' ||
        resolved.attribute !== 'electric' ||
        resolved.damageType !== rows[index]![2] ||
        resolved.formulaProjection !== 'source_registered' ||
        resolveSourceEventQuantity32(usage).status !== 'supported'
      )
        reasons.push(`shared_source_event_contract_mismatch:${usage.eventId}`)
    }
  if (reasons.length)
    return { status: 'unsupported' as const, reasons, eventUsages: [] as PlanningEventUsage[] }
  return {
    status: 'supported' as const,
    eventUsages,
    sourceIdentity: reviewedClaretHeldActionIdentity32,
    resourceLegality: {
      legal: true as const,
      targetGash: { initial: 3, capacity: 3, consumedByHeldMaim: 3, final: 0 },
      crimsonInscription: { initial: true, maintainedDuringAction: true },
    },
    boundaries: {
      kind: 'finite_prepared_blood_burial' as const,
      timingAuthority: 'source_partial_order_only' as const,
      maimAuthority: 'source_equivalent_total_in_constant_effect_state' as const,
      measuredFieldTimeSeconds: null,
      repeatedRotation: false,
      wholeTeamFormal: false,
      // M1 changes the sourced Maim multiplier and M2 changes resistance;
      // both are resolved by the existing actor-bound effect graph. M6 adds
      // Maim only to Chain/Ultimate, neither of which belongs to this action.
      consumerMindscapeRange: [0, 6] as const,
      consumerPotential: 0 as const,
    },
    formalCyclePromotion: false as const,
  }
}
