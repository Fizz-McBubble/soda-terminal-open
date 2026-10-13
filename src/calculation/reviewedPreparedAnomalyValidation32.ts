import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { PlanningBaseline } from './planningDpsContract'
import type { PreparedAnomalyPreparation32 } from './reviewedPreparedAnomalyDeclarations32'

/** Validate declared preparation state independently of numeric settlement. */
export function validateReviewedPreparedAnomalyPreparation32(
  member: PlanningEffectRuntimeMember,
  preparation: PreparedAnomalyPreparation32,
  baseline: PlanningBaseline,
): string[] | null {
  if (preparation.kind === 'piper_single_assault' && preparation.powerStacks !== 0)
    return ['unreviewed_piper_power_preparation']
  if (preparation.kind === 'alice_single_polarized_assault' && preparation.bladeEtiquette !== 300)
    return ['alice_blade_etiquette_preparation_invalid']
  if (
    preparation.kind === 'promeia_single_self_ice_abloom' &&
    (preparation.trialByCold !== 1 ||
      typeof preparation.ownIceAnomalyPresent !== 'boolean' ||
      member.coreLevel < 2)
  )
    return ['promeia_core_tier_or_trial_preparation_unresolved']
  if (
    preparation.kind === 'jane_single_assault' &&
    (typeof preparation.passion !== 'boolean' ||
      typeof preparation.gnawed !== 'boolean' ||
      typeof preparation.priorAssaultOrDisorderBuffActive !== 'boolean')
  )
    return ['jane_prepared_state_unresolved']
  if (
    preparation.kind === 'aria_single_self_ether_abloom' &&
    (preparation.perfectPitchHit3Heavy !== true ||
      preparation.fandomPowerPrepared !== true ||
      typeof preparation.ownEtherAnomalyPresent !== 'boolean' ||
      typeof preparation.enemyStunned !== 'boolean' ||
      (preparation.enemyStunned
        ? baseline.enemy.stunMultiplier !== 1.5
        : baseline.enemy.stunMultiplier !== 1) ||
      (preparation.momentOfDelusion !== undefined &&
        typeof preparation.momentOfDelusion !== 'boolean') ||
      (member.mindscape >= 2 && typeof preparation.momentOfDelusion !== 'boolean') ||
      member.coreLevel < 1 ||
      member.coreLevel > 7)
  )
    return ['aria_prepared_state_unresolved']
  return null
}
