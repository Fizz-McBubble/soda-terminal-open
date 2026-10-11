import { z } from 'zod'
import type { ObservedAgentFacts, ObservedAgentField, RosterAgent } from '../assault/types'

export const observedAgentFields = [
  'owned',
  'level',
  'ascension',
  'mindscape',
  'potentialImage',
  'skillLevels.basic',
  'skillLevels.dodge',
  'skillLevels.assist',
  'skillLevels.special',
  'skillLevels.chain',
  'skillLevels.core',
  'wEngineDetails.id',
  'wEngineDetails.name',
  'wEngineDetails.level',
  'wEngineDetails.ascension',
  'wEngineDetails.refinement',
  'equippedDiscIds',
] as const satisfies readonly ObservedAgentField[]

const observedMarkerSchema = z.object({
  capturedAt: z.string().datetime({ offset: true }),
  snapshotSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
})

export const observedAgentFactsSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal('asset_quick_read'),
  protocolVersion: z.literal('3.2'),
  fields: z.partialRecord(z.enum(observedAgentFields), observedMarkerSchema),
})

/** Read/migration boundary: unknown keys and malformed markers never acquire authority. */
export function normalizeObservedAgentFacts(input: unknown): ObservedAgentFacts | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
  const candidate = input as Record<string, unknown>
  if (
    candidate.schemaVersion !== 1 ||
    candidate.source !== 'asset_quick_read' ||
    candidate.protocolVersion !== '3.2'
  )
    return undefined
  if (!candidate.fields || typeof candidate.fields !== 'object' || Array.isArray(candidate.fields))
    return undefined
  const fields: ObservedAgentFacts['fields'] = {}
  for (const field of observedAgentFields) {
    const marker = observedMarkerSchema.safeParse(
      (candidate.fields as Record<string, unknown>)[field],
    )
    if (marker.success) fields[field] = marker.data
  }
  return Object.keys(fields).length
    ? { schemaVersion: 1, source: 'asset_quick_read', protocolVersion: '3.2', fields }
    : undefined
}

/** A valid marker protects only a populated, valid value of its exact allowlisted field. */
export function getObservedAgentFieldValue(agent: unknown, field: ObservedAgentField): unknown {
  if (!agent || typeof agent !== 'object') return undefined
  const record = agent as Record<string, unknown>
  const [parent, child] = field.split('.')
  const nested = record[parent]
  return child
    ? nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>)[child]
      : undefined
    : record[parent]
}

export function hasObservedAgentField(agent: RosterAgent, field: ObservedAgentField): boolean {
  if (!normalizeObservedAgentFacts(agent.observedFacts)?.fields[field]) return false
  const value = getObservedAgentFieldValue(agent, field)
  if (field === 'owned') return typeof value === 'boolean'
  if (field === 'equippedDiscIds')
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 6 &&
      value.every((id) => typeof id === 'string' && id.trim().length > 0)
    )
  if (field === 'wEngineDetails.id' || field === 'wEngineDetails.name')
    return typeof value === 'string' && value.trim().length > 0
  const min =
    field === 'mindscape' ||
    field === 'potentialImage' ||
    field.endsWith('ascension') ||
    field === 'wEngineDetails.refinement'
      ? 0
      : 1
  const max =
    field === 'mindscape' || field === 'potentialImage'
      ? 6
      : field.endsWith('ascension') || field === 'wEngineDetails.refinement'
        ? 5
        : field === 'skillLevels.core'
          ? 7
          : field.startsWith('skillLevels.')
            ? 16
            : 60
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/** Retained values from a previous equipment identity are not current item facts. */
export function hasCurrentWEngineProgression(
  agent: Pick<RosterAgent, 'observedFacts' | 'wEngineDetails'>,
) {
  const facts = agent.observedFacts?.fields
  const identity = facts?.['wEngineDetails.id']
  const manual = agent.wEngineDetails.manualProgression
  if (!identity && !manual) return true // Existing manual/legacy maintenance contract.
  const fields: Array<'level' | 'refinement' | 'ascension'> = ['level', 'refinement']
  if (agent.wEngineDetails.ascension != null) fields.push('ascension')
  return fields.every((field) => {
    const fact = facts?.[`wEngineDetails.${field}`]
    if (
      manual?.engineId === agent.wEngineDetails.id &&
      typeof manual[field] === 'number' &&
      manual[field] === agent.wEngineDetails[field]
    )
      return true
    return Boolean(
      identity &&
      fact &&
      (Date.parse(fact.capturedAt) > Date.parse(identity.capturedAt) ||
        (fact.capturedAt === identity.capturedAt &&
          fact.snapshotSha256 === identity.snapshotSha256)),
    )
  })
}
