import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { calculateCommonAnomalySettlement32 } from './currentCommonAnomalySettlement32'
import { publicPlanningAnomalyLifecycleSchema32 } from '../application/publicPlanningAnomalyLifecycle32'
import {
  planningAnomalyLifecycleHash32,
  planningAnomalyLifecycleIdentity32,
} from './currentPlanningAnomalyLifecycleIdentity32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
export {
  planningAnomalyLifecycleHash32,
  planningAnomalyLifecycleIdentity32,
} from './currentPlanningAnomalyLifecycleIdentity32'
export const planningAnomalyLifecycleSchema32 = publicPlanningAnomalyLifecycleSchema32.extend({
  sourceIdentityHash: z.literal(planningAnomalyLifecycleHash32),
})
export type PlanningAnomalyLifecycle32 = z.infer<typeof planningAnomalyLifecycleSchema32>

/** A qualified settlement creates the clock. An arbitrary elapsed-time scalar
 * or a damage snapshot taken before application cannot create an anomaly. */
export function compilePlanningAnomalyLifecycle32(input: {
  declaration: unknown
  memberIds: readonly string[]
  eventId?: string
  ownerAgentId?: string
  targetId?: string
}) {
  const failure = (blocker: string) => ({ status: 'unsupported' as const, blockers: [blocker] })
  const parsed = planningAnomalyLifecycleSchema32.safeParse(input.declaration)
  if (!parsed.success) return failure('anomaly_lifecycle_declaration_invalid32')
  const value = parsed.data
  const { application, event } = value
  if (
    new Set(input.memberIds).size !== input.memberIds.length ||
    input.memberIds.length !== application.memberAgentIds.length ||
    application.memberAgentIds.some((id) => !input.memberIds.includes(id)) ||
    !input.memberIds.includes(event.ownerAgentId)
  )
    return failure('anomaly_lifecycle_formation_mismatch32')
  if (
    event.targetId !== application.targetId ||
    (input.targetId !== undefined && event.targetId !== input.targetId) ||
    (input.eventId !== undefined && event.eventId !== input.eventId) ||
    (input.ownerAgentId !== undefined && event.ownerAgentId !== input.ownerAgentId)
  )
    return failure('anomaly_lifecycle_event_identity_mismatch32')
  if (
    event.atSeconds < application.atSeconds ||
    value.activeUntilSeconds <= application.atSeconds ||
    (value.endedAtSeconds !== null &&
      (value.endedAtSeconds < application.atSeconds ||
        value.endedAtSeconds > value.activeUntilSeconds))
  )
    return failure('anomaly_lifecycle_time_order_invalid32')
  if (
    application.contributions.some(
      (row) =>
        row.instance.kind !== 'anomaly' || ![0, 1].includes(row.instance.motionValueMultiplier),
    )
  )
    return failure('anomaly_lifecycle_requires_ordinary_application32')
  try {
    const settled = calculateCommonAnomalySettlement32(application)
    const active = event.atSeconds < (value.endedAtSeconds ?? value.activeUntilSeconds)
    const elapsedSeconds = event.atSeconds - application.atSeconds
    // This is the adopted expression domain. Do not clip an older state to 30
    // or replace a fractional physical clock with the condition UI's integer.
    if (active && elapsedSeconds > 30) return failure('anomaly_lifecycle_clock_out_of_domain32')
    return {
      status: 'supported' as const,
      active,
      elapsedSeconds: active ? elapsedSeconds : null,
      attribute: application.attribute,
      original: application,
      event,
      fingerprint: stableContentHash(value),
      sourceRefs: [
        ...new Set([
          ...settled.attribution.sourceRefs,
          ...value.sourceRefs,
          `anomaly-lifecycle:${stableContentHash(value)}`,
        ]),
      ],
    }
  } catch (error) {
    return failure(
      `anomaly_lifecycle_application_rejected32:${error instanceof Error ? error.message : 'unknown'}`,
    )
  }
}

/** Shared by ordinary effect evaluation and the rating adapter. No declaration
 * preserves the historical explicit-scalar API. A supplied invalid declaration
 * can never fall back to that scalar or to another target's clock. */
export function bindPlanningAnomalyLifecycleReferences32(input: {
  references?: Readonly<Record<string, unknown>>
  memberIds: readonly string[]
  eventId?: string
  ownerAgentId?: string
  targetId?: string
  providerAgentId?: string
  providerMindscape?: number
}) {
  const references: Record<string, unknown> = { ...input.references }
  const sourceRefs: string[] = []
  if (!Object.hasOwn(references, 'anomalyLifecycle32'))
    return { status: 'supported' as const, references, sourceRefs, lifecycle: null }
  const lifecycle = compilePlanningAnomalyLifecycle32({
    ...input,
    declaration: references.anomalyLifecycle32,
  })
  delete references.anomTimePassed
  if (lifecycle.status !== 'supported') return lifecycle
  if (input.providerAgentId === 'agent-alice') {
    const pin = planningAnomalyLifecycleIdentity32.alice
    if (getCurrentAgentEventContract('agent-alice')?.source.formulaSha256 !== pin.formulaSha256)
      return { status: 'unsupported' as const, blockers: ['alice_anomaly_clock_source_changed32'] }
    if (lifecycle.attribute !== pin.originalAttribute)
      return { status: 'unsupported' as const, blockers: ['alice_requires_physical_anomaly32'] }
    sourceRefs.push(`${pin.localizationPath}#${pin.localizationSha256}:${pin.locator}`)
  }
  const scalar = input.references?.anomTimePassed
  if (scalar !== undefined && scalar !== lifecycle.elapsedSeconds)
    return { status: 'unsupported' as const, blockers: ['anomaly_lifecycle_scalar_conflict32'] }
  if (lifecycle.active) references.anomTimePassed = lifecycle.elapsedSeconds
  references.anomalyStateActive32 = lifecycle.active
  sourceRefs.push(...lifecycle.sourceRefs)
  if (input.providerAgentId === 'agent-yanagi') {
    const pin = planningAnomalyLifecycleIdentity32.yanagi
    const contract = getCurrentAgentEventContract('agent-yanagi')!
    if (contract.source.formulaSha256 !== pin.formulaSha256)
      return {
        status: 'unsupported' as const,
        blockers: ['yanagi_polarity_trigger_source_changed32'],
      }
    if (lifecycle.active && lifecycle.event.ownerAgentId === 'agent-yanagi') {
      if (lifecycle.event.eventId === pin.unresolvedUltimateEventId)
        return {
          status: 'unsupported' as const,
          blockers: ['yanagi_ultimate_lightning_phase_unresolved32'],
        }
      if (
        lifecycle.event.eventId === pin.unresolvedThrustEventId &&
        (input.providerMindscape === undefined || input.providerMindscape >= 2)
      )
        return {
          status: 'unsupported' as const,
          blockers: ['yanagi_thrust_trigger_state_unresolved32'],
        }
    }
    const triggered =
      lifecycle.active &&
      lifecycle.event.ownerAgentId === 'agent-yanagi' &&
      lifecycle.event.eventId === pin.triggerEventId
    const original = references['polarityDisorder.value']
    if (original !== undefined && (!triggered || original !== pin.polarityCondition))
      return { status: 'unsupported' as const, blockers: ['yanagi_polarity_trigger_conflict32'] }
    delete references['polarityDisorder.value']
    if (triggered) references['polarityDisorder.value'] = pin.polarityCondition
    references.yanagiPolarityTrigger32 = triggered
    sourceRefs.push(`${pin.localizationPath}#${pin.localizationSha256}:${pin.locator}`)
  }
  return { status: 'supported' as const, references, sourceRefs, lifecycle }
}
