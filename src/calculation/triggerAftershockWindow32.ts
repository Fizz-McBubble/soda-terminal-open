import { publicTriggerAftershockWindowSchema32 } from '../application/publicTriggerAftershockWindow32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { sourceBoundStunApplicationPolicy32 } from './sourceBoundStunApplication32'
import { stableContentHash } from '../gameDataPacks/types'
import type { PlanningEventSchedule32 } from './planningEventOccurrenceState32'

const hitEventIds = [
  'basic.BasicAttackHarmonizingShot.hit-0',
  'basic.BasicAttackHarmonizingShotTartarus.hit-0',
  'basic.BasicAttackHarmonizingShotTartarus.hit-1',
] as const

export const triggerAftershockWindowPolicy32 = Object.freeze({
  revision: 'declared-accepted-aftershock-hit-window-r1',
  source: sourceBoundStunApplicationPolicy32,
  statsSha256: '8B8F196B8B56332347E034544195D7B4F5A691AC0B255579DAE19F6A3CF2603C',
  durationSeconds: 5,
  hitEventIds,
  eventLocators: [
    '/basic/BasicAttackHarmonizingShot/desc/4',
    '/basic/BasicAttackHarmonizingShotTartarus/desc/4',
  ],
  interval:
    'strictly subsequent hit time < occurrence time < hit time + 5; simultaneous order unknown',
  refresh: 'union of each accepted same-target five-second application; no additive stacks',
  boundary:
    'Declared accepted contacts only; no Purge, cooldown, action timing or rotation legality inferred.',
})
export const triggerAftershockWindowIdentity32 = stableContentHash(triggerAftershockWindowPolicy32)
export const triggerAftershockFormulaRef32 = `${sourceBoundStunApplicationPolicy32.formulaPath}#sha256=${sourceBoundStunApplicationPolicy32.formulaSha256}`

/** Bind the existing aftershock_hit producer input once per actual occurrence.
 * The activating contact's own damage has no proven before/after ordering. */
export function bindTriggerAftershockWindow32(input: {
  schedule: PlanningEventSchedule32
  memberIds: readonly string[]
  targetId: string
}) {
  if (!input.schedule.triggerAftershockWindow32)
    return { status: 'supported' as const, states: null }
  const failure = (blocker: string) => ({ status: 'unsupported' as const, blockers: [blocker] })
  const parsed = publicTriggerAftershockWindowSchema32.safeParse(
    input.schedule.triggerAftershockWindow32,
  )
  if (!parsed.success) return failure('trigger_aftershock_window_declaration_invalid32')
  const declaration = parsed.data
  const source = getCurrentAgentEventContract('agent-trigger')
  if (
    declaration.sourceIdentityHash !== triggerAftershockWindowIdentity32 ||
    source?.source.commit !== sourceBoundStunApplicationPolicy32.commit ||
    source.source.formulaSha256 !== sourceBoundStunApplicationPolicy32.formulaSha256 ||
    source.source.statsSha256 !== triggerAftershockWindowPolicy32.statsSha256
  )
    return failure('trigger_aftershock_window_source_changed32')
  if (!input.memberIds.includes('agent-trigger') || declaration.targetId !== input.targetId)
    return failure('trigger_aftershock_window_target_or_provider_mismatch32')
  if (new Set(declaration.hitOccurrenceIds).size !== declaration.hitOccurrenceIds.length)
    return failure('trigger_aftershock_window_duplicate_hit32')
  const hits = input.schedule.occurrences.filter(
    (row) =>
      row.ownerAgentId === 'agent-trigger' &&
      (hitEventIds as readonly string[]).includes(row.eventId),
  )
  if (
    hits.length !== declaration.hitOccurrenceIds.length ||
    hits.some((hit) => !declaration.hitOccurrenceIds.includes(hit.occurrenceId))
  )
    return failure('trigger_aftershock_window_hit_set_mismatch32')
  for (const hit of hits) {
    const event = source.eventContract.events.find((row) => row.eventId === hit.eventId)
    if (
      !event ||
      event.formulaProjection !== 'source_registered' ||
      !hit.sourceRefs.includes(triggerAftershockFormulaRef32)
    )
      return failure('trigger_aftershock_window_hit_source_invalid32')
  }
  const states: Record<string, { active?: boolean; sourceRefs: string[] }> = {}
  const windowSeconds = triggerAftershockWindowPolicy32.durationSeconds
  for (const occurrence of input.schedule.occurrences) {
    const time = occurrence.atSeconds
    if (
      occurrence.durationSeconds !== undefined &&
      hits.some((hit) =>
        [hit.atSeconds, hit.atSeconds + windowSeconds].some(
          (boundary) => boundary > time && boundary < time + occurrence.durationSeconds!,
        ),
      )
    )
      return failure('trigger_aftershock_window_rate_interval_crosses_boundary32')
    const prior = hits.filter((hit) => hit.atSeconds < time)
    const simultaneous = hits.some((hit) => hit.atSeconds === time)
    const active = prior.some((hit) => time < hit.atSeconds + windowSeconds)
      ? true
      : simultaneous
        ? undefined
        : prior.length || declaration.initialState === 'inactive'
          ? false
          : undefined
    const explicit = occurrence.referencesByAgentId['agent-trigger']?.aftershock_hit
    if (explicit !== undefined && (active === undefined || explicit !== active))
      return failure(
        `trigger_aftershock_window_explicit_state_conflict32:${occurrence.occurrenceId}`,
      )
    states[occurrence.occurrenceId] = {
      ...(active === undefined ? {} : { active }),
      sourceRefs: [
        ...new Set([
          ...declaration.sourceRefs,
          triggerAftershockFormulaRef32,
          `${sourceBoundStunApplicationPolicy32.path}#sha256=${sourceBoundStunApplicationPolicy32.sha256}`,
          `trigger-aftershock-window:${triggerAftershockWindowIdentity32}:${active === undefined ? 'unknown' : active ? 'active' : 'inactive'}`,
        ]),
      ],
    }
  }
  return { status: 'supported' as const, states }
}
