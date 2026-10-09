import { compileCurrentPlanningBaselineTimelineContracts } from './currentPlanningBaselineObservations'

export type FormationTimeline = ReturnType<typeof compileCurrentPlanningBaselineTimelineContracts>
const verifiedTimelines = new WeakMap<
  FormationTimeline,
  { memberIds: readonly string[]; observationHash: string }
>()

function freezeContracts(value: unknown) {
  if (!value || typeof value !== 'object') return
  Object.values(value).forEach(freezeContracts)
  Object.freeze(value)
}

/** Reuses only verified immutable source contracts, never dynamic effect values. */
export function compileCurrentPlanningFormationEffectTimeline(
  memberIds: readonly [string, string, string],
) {
  const timeline = compileCurrentPlanningBaselineTimelineContracts(memberIds)
  if (timeline.status === 'supported') {
    freezeContracts(timeline.contracts)
    Object.freeze(timeline)
    verifiedTimelines.set(timeline, {
      memberIds: [...memberIds],
      observationHash: timeline.observationHash,
    })
  }
  return timeline
}

export function isVerifiedFormationTimeline(
  timeline: FormationTimeline,
  memberIds: readonly string[],
) {
  const verified = verifiedTimelines.get(timeline)
  return (
    !!verified &&
    timeline.status === 'supported' &&
    verified.memberIds.length === memberIds.length &&
    verified.memberIds.every((agentId, index) => agentId === memberIds[index]) &&
    timeline.observationHash === verified.observationHash
  )
}
