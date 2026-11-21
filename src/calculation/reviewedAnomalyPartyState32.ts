import { stableContentHash } from '../domain/stableContentHash'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  reviewedAnomalyPartySource32,
  reviewedTargetEffectStateSchema32,
  reviewedTargetEffectSnapshotSchema32,
  type ReviewedTargetEffectSnapshot32,
} from '../domain/reviewedTargetEffectState32'
export {
  reviewedAnomalyPartySource32,
  reviewedAnomalyPartyStateHash32,
  reviewedTargetEffectSnapshotSchema32,
  reviewedTargetEffectStateSchema32,
  type ReviewedTargetEffectState32,
  type ReviewedTargetEffectSnapshot32,
} from '../domain/reviewedTargetEffectState32'

export const reviewedAnomalyPartyEffectIds32 = [
  'reviewed_guilty_abloom_defense_ignore32',
  'reviewed_cat_gaze_defense_reduction32',
  'reviewed_misstep_stun32',
] as const
const stateNames = {
  'agent-promeia': 'promeiaGuiltyAbloom32',
  'agent-sunna': 'sunnaCatGazeStacks32',
  'agent-nangong': 'nangongMisstep32',
} as const

/** Bind before evaluating a target's event. No party identity or other provider's
 * support-off switch can create/remove Guilt. Omission remains an unknown. */
export function bindReviewedAnomalyPartyState32(input: {
  providerAgentId: string
  references?: Readonly<Record<string, unknown>>
  snapshot?: ReviewedTargetEffectSnapshot32
}) {
  const references: Record<string, unknown> = { ...input.references }
  const failure = (reason: string) => ({
    status: 'unsupported' as const,
    blockers: [reason],
    state: null,
  })
  const stateName = stateNames[input.providerAgentId as keyof typeof stateNames]
  const raw = references.reviewedTargetEffectState32
  if (raw === undefined)
    return { status: 'supported' as const, references, sourceRefs: [] as string[], state: null }
  const parsed = reviewedTargetEffectStateSchema32.safeParse(raw)
  if (!parsed.success) return failure('reviewed_target_effect_state_invalid32')
  const state = parsed.data
  const owner = {
    promeia_guilty: 'agent-promeia',
    sunna_cat_gaze: 'agent-sunna',
    nangong_misstep: 'agent-nangong',
  }[state.kind]
  if (owner !== input.providerAgentId || !stateName)
    return failure('reviewed_target_effect_provider_mismatch32')
  const snapshot = reviewedTargetEffectSnapshotSchema32.safeParse(
    input.snapshot ?? references.reviewedTargetEffectSnapshot32,
  )
  delete references[stateName]
  if (!snapshot.success) return failure('reviewed_target_effect_snapshot_missing_or_invalid32')
  if (state.targetId !== snapshot.data.targetId)
    return failure('reviewed_target_effect_target_mismatch32')
  const at = snapshot.data.atSeconds
  if (input.snapshot && references.reviewedTargetEffectSnapshot32 !== undefined) {
    const declared = reviewedTargetEffectSnapshotSchema32.safeParse(
      references.reviewedTargetEffectSnapshot32,
    )
    if (
      !declared.success ||
      declared.data.targetId !== snapshot.data.targetId ||
      declared.data.atSeconds !== at
    )
      return failure('reviewed_target_effect_snapshot_mismatch32')
  }
  let value: boolean | number | null
  if (state.kind === 'promeia_guilty') {
    value = state.active
    if (state.active === true || (state.active === false && state.application !== null)) {
      const application = state.application
      if (!application) return failure('promeia_guilty_prior_EX_missing32')
      const event = getCurrentAgentEventContract('agent-promeia')?.eventContract.events.find(
        (row) => row.eventId === application.eventId,
      )
      if (event?.skill !== 'special' || !event.actionId.startsWith('EXSpecialAttack'))
        return failure('promeia_guilty_requires_source_EX_hit32')
      if (application.atSeconds >= at) return failure('promeia_guilty_prior_hit_order_unresolved32')
      value = at - application.atSeconds < reviewedAnomalyPartySource32.parameters.guiltyDuration
      if (state.active === false && value)
        return failure('promeia_guilty_false_contradicts_prior_EX32')
    }
  } else if (state.kind === 'sunna_cat_gaze') {
    if (state.appliedAtSeconds.some((t) => t === at))
      return failure('sunna_cat_gaze_same_hit_order_unresolved32')
    if (state.stacks !== null && state.stacks !== state.appliedAtSeconds.length)
      return failure('sunna_cat_gaze_stack_clock_count_mismatch32')
    if (state.appliedAtSeconds.some((t) => t > at)) return failure('sunna_cat_gaze_future_stack32')
    value =
      state.stacks === null
        ? null
        : state.appliedAtSeconds.filter(
            (t) => at - t < reviewedAnomalyPartySource32.parameters.catGazeStackDuration,
          ).length
  } else {
    value = state.applied
    if (state.applied === true) {
      if (state.appliedAtSeconds === null || !state.stun)
        return failure('nangong_misstep_application_or_stun_epoch_missing32')
      const stun = state.stun
      if (state.appliedAtSeconds >= at || stun.endsAtSeconds <= stun.startedAtSeconds)
        return failure('nangong_misstep_time_order_invalid32')
      value = at >= stun.startedAtSeconds && at < stun.endsAtSeconds
    }
  }
  if (value !== null) references[stateName] = value
  references.reviewedTargetEffectSnapshot32 = snapshot.data
  const sourceRefs = [
    ...state.sourceRefs,
    `reviewed-anomaly-party-state32:${stableContentHash({ state, snapshot: snapshot.data })}`,
  ]
  return { status: 'supported' as const, references, sourceRefs, state: value }
}
