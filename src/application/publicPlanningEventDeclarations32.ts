import { z } from 'zod'
import { contentHash } from './contentHash'
import {
  publicTriggerAftershockWindowSchema32,
  type PublicTriggerAftershockWindow32,
} from './publicTriggerAftershockWindow32'
import {
  publicPlanningAnomalyLifecycleSchema32,
  type PublicPlanningAnomalyLifecycle32,
} from './publicPlanningAnomalyLifecycle32'

export const planningEventDeclarations32Contract = 'soda-planning-event-declarations32/v1' as const

export type PlanningEventConditionDefinition32 = {
  providerAgentId: string
  referenceKey: string
  label: string
  valueKind: 'boolean' | 'number' | 'enum'
  options?: Array<{ value: string | number | boolean; label: string }>
  minimum?: number
  maximum?: number
  sourceRefs: string[]
}
export type PlanningEventDeclarationsMetadata32 = {
  contract: typeof planningEventDeclarations32Contract
  gameVersion: '3.2'
  phaseId: 'phase_ii'
  sourceFingerprint: string
  declaredDurationSeconds: number
  memberIds: string[]
  triggerAftershockWindowSourceIdentity32?: string
  events: Array<{
    ownerAgentId: string
    eventId: string
    skillLevel: number
    /** Explicit source coefficient unit; omitted historical rows are per use. */
    quantityUnit?: 'seconds'
    requiresWindsweptObservation: boolean
    sourceRefs: string[]
    conditions: PlanningEventConditionDefinition32[]
  }>
}
export type PlanningEventDeclaredCondition32 = {
  providerAgentId: string
  referenceKey: string
  value: string | number | boolean
}
export type PlanningEventOccurrence32 = {
  occurrenceId: string
  ownerAgentId: string
  eventId: string
  atSeconds: number
  durationSeconds?: number
  rateState?: 'constant_over_interval'
  snapshotAtSeconds?: number
  conditions: PlanningEventDeclaredCondition32[]
  windswept: 'active' | 'inactive' | 'unobserved'
  sourceRefs: string[]
  anomalyLifecycleByAgentId?: Record<string, PublicPlanningAnomalyLifecycle32>
}
export type PlanningEventDeclarationsInput32 = {
  contract: typeof planningEventDeclarations32Contract
  sourceFingerprint: string
  confirmedDeclaredConditions: boolean
  occurrences: PlanningEventOccurrence32[]
  triggerAftershockWindow32?: PublicTriggerAftershockWindow32
}
export type PlanningEventDeclarationsValidation32 = {
  occurrences: PlanningEventOccurrence32[]
  gaps: string[]
}

const text = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)
const finite = z.number().finite()
const scalar = z.union([text, finite, z.boolean()])
const refs = z.array(text).min(1)
const conditionDefinition = z
  .object({
    providerAgentId: text,
    referenceKey: text,
    label: text,
    valueKind: z.enum(['boolean', 'number', 'enum']),
    options: z
      .array(z.object({ value: scalar, label: text }).strict())
      .min(1)
      .optional(),
    minimum: finite.optional(),
    maximum: finite.optional(),
    sourceRefs: refs,
  })
  .strict()
const metadataSchema = z
  .object({
    contract: z.literal(planningEventDeclarations32Contract),
    gameVersion: z.literal('3.2'),
    phaseId: z.literal('phase_ii'),
    sourceFingerprint: text,
    declaredDurationSeconds: finite.positive(),
    memberIds: z.array(text).min(1).max(3),
    triggerAftershockWindowSourceIdentity32: text.optional(),
    events: z
      .array(
        z
          .object({
            ownerAgentId: text,
            eventId: text,
            skillLevel: finite.int().min(1).max(16),
            quantityUnit: z.literal('seconds').optional(),
            requiresWindsweptObservation: z.boolean(),
            sourceRefs: refs,
            conditions: z.array(conditionDefinition),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
const inputSchema = z
  .object({
    contract: z.literal(planningEventDeclarations32Contract),
    sourceFingerprint: text,
    confirmedDeclaredConditions: z.boolean(),
    triggerAftershockWindow32: publicTriggerAftershockWindowSchema32.optional(),
    occurrences: z
      .array(
        z
          .object({
            occurrenceId: text,
            ownerAgentId: text,
            eventId: text,
            atSeconds: finite.nonnegative(),
            durationSeconds: finite.positive().optional(),
            rateState: z.literal('constant_over_interval').optional(),
            snapshotAtSeconds: finite.nonnegative().optional(),
            conditions: z.array(
              z.object({ providerAgentId: text, referenceKey: text, value: scalar }).strict(),
            ),
            windswept: z.enum(['active', 'inactive', 'unobserved']),
            sourceRefs: refs,
            anomalyLifecycleByAgentId: z
              .record(text, publicPlanningAnomalyLifecycleSchema32)
              .optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

const pair = (left: string, right: string) => JSON.stringify([left, right])
/** Transport shape only. Source/domain validation still requires producer metadata. */
export function planningEventDeclarationsInputShapeGaps32(raw: unknown): string[] {
  const parsed = inputSchema.safeParse(raw)
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => `invalid_input:${issue.path.join('.')}:${issue.code}`)
}
const conditionKey = (condition: { providerAgentId: string; referenceKey: string }) =>
  pair(condition.providerAgentId, condition.referenceKey)
const eventKey = (event: { ownerAgentId: string; eventId: string }) =>
  pair(event.ownerAgentId, event.eventId)
const duplicate = (values: string[]) => new Set(values).size !== values.length
const sorted = (values: string[]) => [...values].sort()
const byKey = <T>(values: T[], key: (value: T) => string) =>
  [...values].sort((left, right) => key(left).localeCompare(key(right)))

/** Fingerprint the complete public declaration vocabulary, excluding its own fingerprint. */
export function planningEventDeclarationsMetadataFingerprint32(
  metadata:
    | Omit<PlanningEventDeclarationsMetadata32, 'sourceFingerprint'>
    | PlanningEventDeclarationsMetadata32,
): string {
  return contentHash({
    contract: metadata.contract,
    gameVersion: metadata.gameVersion,
    phaseId: metadata.phaseId,
    declaredDurationSeconds: metadata.declaredDurationSeconds,
    memberIds: sorted(metadata.memberIds),
    ...(metadata.triggerAftershockWindowSourceIdentity32
      ? {
          triggerAftershockWindowSourceIdentity32: metadata.triggerAftershockWindowSourceIdentity32,
        }
      : {}),
    events: byKey(metadata.events, eventKey).map((event) => ({
      ...event,
      sourceRefs: sorted(event.sourceRefs),
      conditions: byKey(event.conditions, conditionKey).map((condition) => ({
        ...condition,
        sourceRefs: sorted(condition.sourceRefs),
        ...(condition.options
          ? { options: byKey(condition.options, (option) => contentHash(option.value)) }
          : {}),
      })),
    })),
  })
}

export function planningEventDeclarationsMetadataGaps32(raw: unknown): string[] {
  const parsed = metadataSchema.safeParse(raw)
  if (!parsed.success)
    return parsed.error.issues.map(
      (issue) => `invalid_metadata:${issue.path.join('.')}:${issue.code}`,
    )
  const metadata = parsed.data
  const gaps: string[] = []
  if (duplicate(metadata.memberIds)) gaps.push('duplicate_member_id')
  if (
    metadata.triggerAftershockWindowSourceIdentity32 &&
    !metadata.memberIds.includes('agent-trigger')
  )
    gaps.push('trigger_window_metadata_provider_missing32')
  if (duplicate(metadata.events.map(eventKey))) gaps.push('duplicate_metadata_event')
  for (const event of metadata.events) {
    const key = eventKey(event)
    if (!metadata.memberIds.includes(event.ownerAgentId)) gaps.push(`unknown_event_owner:${key}`)
    if (duplicate(event.sourceRefs)) gaps.push(`duplicate_event_source:${key}`)
    if (duplicate(event.conditions.map(conditionKey)))
      gaps.push(`duplicate_condition_definition:${key}`)
    for (const condition of event.conditions) {
      const id = conditionKey(condition)
      if (!metadata.memberIds.includes(condition.providerAgentId))
        gaps.push(`unknown_condition_provider:${id}`)
      if (duplicate(condition.sourceRefs)) gaps.push(`duplicate_condition_source:${id}`)
      if (
        (condition.valueKind === 'enum' && !condition.options) ||
        (condition.valueKind !== 'enum' && condition.options !== undefined) ||
        (condition.valueKind !== 'number' &&
          (condition.minimum !== undefined || condition.maximum !== undefined)) ||
        (condition.minimum !== undefined &&
          condition.maximum !== undefined &&
          condition.minimum > condition.maximum) ||
        (condition.options &&
          duplicate(condition.options.map((option) => contentHash(option.value))))
      )
        gaps.push(`invalid_condition_definition:${id}`)
    }
  }
  if (metadata.sourceFingerprint !== planningEventDeclarationsMetadataFingerprint32(metadata))
    gaps.push('metadata_source_fingerprint_mismatch')
  return gaps
}

/** Validate against a producer-owned vocabulary; client-supplied metadata is never authority. */
export function validatePlanningEventDeclarations32(
  raw: unknown,
  trustedMetadata: PlanningEventDeclarationsMetadata32,
): PlanningEventDeclarationsValidation32 {
  const metadataGaps = planningEventDeclarationsMetadataGaps32(trustedMetadata)
  if (metadataGaps.length) return { occurrences: [], gaps: metadataGaps }
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success)
    return {
      occurrences: [],
      gaps: parsed.error.issues.map(
        (issue) => `invalid_input:${issue.path.join('.')}:${issue.code}`,
      ),
    }
  const input = parsed.data
  const gaps: string[] = []
  if (input.sourceFingerprint !== trustedMetadata.sourceFingerprint)
    gaps.push('source_fingerprint_mismatch')
  if (!input.confirmedDeclaredConditions) gaps.push('unconfirmed_declared_conditions')
  if (
    input.triggerAftershockWindow32 &&
    input.triggerAftershockWindow32.sourceIdentityHash !==
      trustedMetadata.triggerAftershockWindowSourceIdentity32
  )
    gaps.push('trigger_aftershock_window_source_changed32')
  if (input.triggerAftershockWindow32) {
    const hitIds = input.triggerAftershockWindow32.hitOccurrenceIds
    if (
      duplicate(hitIds) ||
      hitIds.some(
        (id) =>
          !input.occurrences.some(
            (row) => row.occurrenceId === id && row.ownerAgentId === 'agent-trigger',
          ),
      )
    )
      gaps.push('trigger_aftershock_window_hit_identity_invalid32')
  }
  if (duplicate(input.occurrences.map((occurrence) => occurrence.occurrenceId)))
    gaps.push('duplicate_occurrence_id')
  const rateIntervals = new Map<string, Array<{ start: number; end: number }>>()
  for (const occurrence of input.occurrences) {
    const id = occurrence.occurrenceId
    const event = trustedMetadata.events.find(
      (candidate) => eventKey(candidate) === eventKey(occurrence),
    )
    if (!trustedMetadata.memberIds.includes(occurrence.ownerAgentId))
      gaps.push(`unknown_occurrence_owner:${id}`)
    if (!event) gaps.push(`unknown_occurrence_event:${id}`)
    if (occurrence.atSeconds >= trustedMetadata.declaredDurationSeconds)
      gaps.push(`invalid_occurrence_time:${id}`)
    if (event?.quantityUnit === 'seconds') {
      const duration = occurrence.durationSeconds
      if (
        duration === undefined ||
        occurrence.rateState !== 'constant_over_interval' ||
        occurrence.atSeconds + duration > trustedMetadata.declaredDurationSeconds
      )
        gaps.push(`invalid_rate_interval:${id}`)
      else {
        const key = eventKey(occurrence)
        const intervals = rateIntervals.get(key) ?? []
        const interval = { start: occurrence.atSeconds, end: occurrence.atSeconds + duration }
        if (intervals.some((other) => interval.start < other.end && other.start < interval.end))
          gaps.push(`overlapping_rate_interval:${id}`)
        rateIntervals.set(key, [...intervals, interval])
      }
    } else if (occurrence.durationSeconds !== undefined || occurrence.rateState !== undefined)
      gaps.push(`unexpected_rate_interval:${id}`)
    if (
      occurrence.snapshotAtSeconds !== undefined &&
      occurrence.snapshotAtSeconds > occurrence.atSeconds
    )
      gaps.push(`invalid_snapshot_time:${id}`)
    if (event?.requiresWindsweptObservation && occurrence.windswept === 'unobserved')
      gaps.push(`windswept_unobserved:${id}`)
    if (duplicate(occurrence.conditions.map(conditionKey)))
      gaps.push(`duplicate_declared_condition:${id}`)
    if (duplicate(occurrence.sourceRefs)) gaps.push(`duplicate_occurrence_source:${id}`)
    for (const [providerId, lifecycle] of Object.entries(
      occurrence.anomalyLifecycleByAgentId ?? {},
    )) {
      if (
        !trustedMetadata.memberIds.includes(providerId) ||
        lifecycle.event.eventId !== occurrence.eventId ||
        lifecycle.event.ownerAgentId !== occurrence.ownerAgentId ||
        lifecycle.event.atSeconds !== occurrence.atSeconds
      )
        gaps.push(`anomaly_lifecycle_occurrence_mismatch:${id}:${providerId}`)
    }
    if (!event) continue
    const acceptedRefs = new Set([
      ...event.sourceRefs,
      ...event.conditions.flatMap((condition) => condition.sourceRefs),
    ])
    if (
      occurrence.sourceRefs.some((ref) => !acceptedRefs.has(ref)) ||
      [...acceptedRefs].some((ref) => !occurrence.sourceRefs.includes(ref))
    )
      gaps.push(`wrong_occurrence_source:${id}`)
    for (const declaration of occurrence.conditions) {
      const definition = event.conditions.find(
        (candidate) => conditionKey(candidate) === conditionKey(declaration),
      )
      const key = conditionKey(declaration)
      if (!definition) {
        gaps.push(`unknown_declared_condition:${id}:${key}`)
        continue
      }
      if (
        (definition.valueKind === 'boolean' && typeof declaration.value !== 'boolean') ||
        (definition.valueKind === 'number' &&
          (typeof declaration.value !== 'number' ||
            (definition.minimum !== undefined && declaration.value < definition.minimum) ||
            (definition.maximum !== undefined && declaration.value > definition.maximum))) ||
        (definition.valueKind === 'enum' &&
          !definition.options?.some((option) => option.value === declaration.value))
      )
        gaps.push(`invalid_declared_value:${id}:${key}`)
    }
    for (const definition of event.conditions)
      if (
        !(
          input.triggerAftershockWindow32 &&
          definition.providerAgentId === 'agent-trigger' &&
          definition.referenceKey === 'aftershock_hit'
        ) &&
        !(
          occurrence.anomalyLifecycleByAgentId?.[definition.providerAgentId] &&
          ['anomTimePassed', 'polarityDisorder.value'].includes(definition.referenceKey)
        ) &&
        !occurrence.conditions.some(
          (condition) => conditionKey(condition) === conditionKey(definition),
        )
      )
        gaps.push(`missing_declared_condition:${id}:${conditionKey(definition)}`)
  }
  return { occurrences: gaps.length ? [] : normalizeOccurrences(input.occurrences), gaps }
}

export const planningEventDeclarationsInputGaps32 = (
  raw: unknown,
  trustedMetadata: PlanningEventDeclarationsMetadata32,
) => validatePlanningEventDeclarations32(raw, trustedMetadata).gaps

function normalizeOccurrences(occurrences: PlanningEventOccurrence32[]) {
  return byKey(occurrences, (occurrence) => occurrence.occurrenceId).map((occurrence) => ({
    ...occurrence,
    sourceRefs: sorted(occurrence.sourceRefs),
    conditions: byKey(occurrence.conditions, conditionKey),
  }))
}

export function planningEventDeclarationsInputFingerprint32(
  input: PlanningEventDeclarationsInput32,
): string {
  return contentHash({ ...input, occurrences: normalizeOccurrences(input.occurrences) })
}
