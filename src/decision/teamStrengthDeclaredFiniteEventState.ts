import {
  bindReviewedAnomalyPartyState32,
  reviewedTargetEffectSnapshotSchema32,
  type ReviewedTargetEffectSnapshot32,
} from '../calculation/reviewedAnomalyPartyState32'

export type DeclaredTeamStrengthFiniteEventState = {
  /** Actual controlled packet coordinate; never a provider preview or observed uptime. */
  eventObservation?: ReviewedTargetEffectSnapshot32
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

/** Validate explicit declarations without manufacturing an absent provider state. */
export function bindDeclaredTeamStrengthFiniteEventState(
  input: DeclaredTeamStrengthFiniteEventState,
  memberIds: readonly string[],
  targetId: string,
) {
  const unsupported = (blocker: string) => ({ status: 'unsupported' as const, blockers: [blocker] })
  const observation = input.eventObservation
  if (observation !== undefined) {
    if (!reviewedTargetEffectSnapshotSchema32.safeParse(observation).success)
      return unsupported('declared_finite_event_observation_invalid32')
    if (observation.targetId !== targetId)
      return unsupported('declared_finite_event_observation_target_mismatch32')
  }
  const references: Record<string, Readonly<Record<string, unknown>>> = structuredClone(
    input.baselineReferencesByAgentId ?? {},
  )
  if (Object.keys(references).some((id) => !memberIds.includes(id)))
    return unsupported('declared_finite_event_provider_outside_trio32')
  for (const [id, refs] of Object.entries(references)) {
    const hasState = refs.reviewedTargetEffectState32 !== undefined
    if (id === 'agent-sunna' && Object.hasOwn(refs, 'sunnaCatGazeStacks32') && !hasState)
      return unsupported('declared_sunna_stacks_require_source_bound_target_state32')
    if (hasState) {
      if (!observation)
        return unsupported('declared_target_state_requires_actual_event_observation32')
      const bound = bindReviewedAnomalyPartyState32({
        providerAgentId: id,
        references: refs,
        snapshot: observation,
      })
      if (bound.status !== 'supported') return bound
      if (
        id === 'agent-sunna' &&
        Object.hasOwn(refs, 'sunnaCatGazeStacks32') &&
        refs.sunnaCatGazeStacks32 !== bound.references.sunnaCatGazeStacks32
      )
        return unsupported('declared_sunna_scalar_target_state_conflict32')
      references[id] = bound.references
    }
    if (id === 'agent-zhao') {
      const switched = refs.zhaoM1SwitchedOut32
      const age = refs.zhaoM1SecondsSinceSwitchOut32
      if (switched !== undefined && typeof switched !== 'boolean')
        return unsupported('declared_zhao_switch_state_invalid32')
      if (age !== undefined && (typeof age !== 'number' || !Number.isFinite(age) || age < 0))
        return unsupported('declared_zhao_switch_age_invalid32')
    }
  }
  return {
    status: 'supported' as const,
    eventObservation: observation === undefined ? undefined : { ...observation },
    references,
  }
}
