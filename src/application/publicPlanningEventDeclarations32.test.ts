import { describe, expect, it } from 'vitest'
import {
  planningEventDeclarations32Contract,
  planningEventDeclarationsInputFingerprint32,
  planningEventDeclarationsMetadataFingerprint32,
  planningEventDeclarationsMetadataGaps32,
  validatePlanningEventDeclarations32,
  type PlanningEventDeclarationsInput32,
  type PlanningEventDeclarationsMetadata32,
} from './publicPlanningEventDeclarations32'

function fixture() {
  const metadata: PlanningEventDeclarationsMetadata32 = {
    contract: planningEventDeclarations32Contract,
    gameVersion: '3.2',
    phaseId: 'phase_ii',
    sourceFingerprint: '',
    declaredDurationSeconds: 20,
    memberIds: ['attacker', 'support'],
    events: [
      {
        ownerAgentId: 'attacker',
        eventId: 'hit',
        skillLevel: 12,
        requiresWindsweptObservation: true,
        sourceRefs: ['event-ir'],
        conditions: [
          {
            providerAgentId: 'support',
            referenceKey: 'buff',
            label: 'Buff',
            valueKind: 'boolean',
            sourceRefs: ['buff-ir'],
          },
          {
            providerAgentId: 'attacker',
            referenceKey: 'stacks',
            label: 'Stacks',
            valueKind: 'number',
            minimum: 0,
            maximum: 3,
            sourceRefs: ['event-ir'],
          },
          {
            providerAgentId: 'attacker',
            referenceKey: 'mode',
            label: 'Mode',
            valueKind: 'enum',
            options: [
              { value: 'normal', label: 'Normal' },
              { value: 'enhanced', label: 'Enhanced' },
            ],
            sourceRefs: ['event-ir'],
          },
        ],
      },
    ],
  }
  metadata.sourceFingerprint = planningEventDeclarationsMetadataFingerprint32(metadata)
  const input: PlanningEventDeclarationsInput32 = {
    contract: planningEventDeclarations32Contract,
    sourceFingerprint: metadata.sourceFingerprint,
    confirmedDeclaredConditions: true,
    occurrences: [
      {
        occurrenceId: 'first',
        ownerAgentId: 'attacker',
        eventId: 'hit',
        atSeconds: 0,
        snapshotAtSeconds: 0,
        conditions: [
          { providerAgentId: 'support', referenceKey: 'buff', value: false },
          { providerAgentId: 'attacker', referenceKey: 'stacks', value: 0 },
          { providerAgentId: 'attacker', referenceKey: 'mode', value: 'normal' },
        ],
        windswept: 'inactive',
        sourceRefs: ['event-ir', 'buff-ir'],
      },
    ],
  }
  return { metadata, input }
}
const gaps = (input: unknown, metadata: PlanningEventDeclarationsMetadata32) =>
  validatePlanningEventDeclarations32(input, metadata).gaps

describe('public planning event declarations 3.2', () => {
  it('preserves explicit zero and false and distinct per-occurrence states', () => {
    const { metadata, input } = fixture()
    input.occurrences.push({
      ...structuredClone(input.occurrences[0]),
      occurrenceId: 'second',
      atSeconds: 5,
      windswept: 'active',
      conditions: [
        { providerAgentId: 'support', referenceKey: 'buff', value: true },
        { providerAgentId: 'attacker', referenceKey: 'stacks', value: 3 },
        { providerAgentId: 'attacker', referenceKey: 'mode', value: 'enhanced' },
      ],
    })
    const result = validatePlanningEventDeclarations32(input, metadata)
    expect(result.gaps).toEqual([])
    expect(result.occurrences[0].conditions).toContainEqual({
      providerAgentId: 'attacker',
      referenceKey: 'stacks',
      value: 0,
    })
    expect(result.occurrences[0].conditions).toContainEqual({
      providerAgentId: 'support',
      referenceKey: 'buff',
      value: false,
    })
    expect(result.occurrences.map((item) => item.windswept)).toEqual(['inactive', 'active'])
  })

  it('does not default undeclared values or observations', () => {
    const { metadata, input } = fixture()
    input.occurrences[0].conditions.splice(1, 1)
    input.occurrences[0].windswept = 'unobserved'
    expect(gaps(input, metadata).join(' ')).toContain('missing_declared_condition')
    expect(gaps(input, metadata)).toContain('windswept_unobserved:first')
    expect(validatePlanningEventDeclarations32(input, metadata).occurrences).toEqual([])
  })

  it('retains unobserved windswept when the event has no dependency', () => {
    const { metadata, input } = fixture()
    metadata.events[0].requiresWindsweptObservation = false
    metadata.sourceFingerprint = planningEventDeclarationsMetadataFingerprint32(metadata)
    input.sourceFingerprint = metadata.sourceFingerprint
    input.occurrences[0].windswept = 'unobserved'
    expect(validatePlanningEventDeclarations32(input, metadata).occurrences[0].windswept).toBe(
      'unobserved',
    )
  })

  it.each(['other-ir', ''])('rejects foreign or empty source refs (%s)', (source) => {
    const { metadata, input } = fixture()
    input.occurrences[0].sourceRefs = [source]
    expect(gaps(input, metadata).length).toBeGreaterThan(0)
  })

  it('rejects missing evidence, wrong fingerprints and unconfirmed declarations', () => {
    const { metadata, input } = fixture()
    input.occurrences[0].sourceRefs = ['event-ir']
    expect(gaps(input, metadata)).toContain('wrong_occurrence_source:first')
    input.sourceFingerprint = 'wrong-source'
    input.confirmedDeclaredConditions = false
    expect(gaps(input, metadata)).toContain('source_fingerprint_mismatch')
    expect(gaps(input, metadata)).toContain('unconfirmed_declared_conditions')
    metadata.declaredDurationSeconds++
    expect(planningEventDeclarationsMetadataGaps32(metadata)).toContain(
      'metadata_source_fingerprint_mismatch',
    )
  })

  it.each(['ownerAgentId', 'eventId'] as const)('rejects wrong event binding via %s', (field) => {
    const { metadata, input } = fixture()
    input.occurrences[0][field] = 'unknown'
    expect(gaps(input, metadata)).toContain('unknown_occurrence_event:first')
  })

  it('rejects unknown provider/reference pairs without cross-member guessing', () => {
    const { metadata, input } = fixture()
    input.occurrences[0].conditions[0].providerAgentId = 'attacker'
    expect(gaps(input, metadata).join(' ')).toContain('unknown_declared_condition')
    expect(gaps(input, metadata).join(' ')).toContain('missing_declared_condition')
  })

  it('rejects conflicting duplicate declarations and duplicate occurrence IDs', () => {
    const { metadata, input } = fixture()
    input.occurrences[0].conditions.push({ ...input.occurrences[0].conditions[0], value: true })
    input.occurrences.push(structuredClone(input.occurrences[0]))
    expect(gaps(input, metadata)).toContain('duplicate_occurrence_id')
    expect(gaps(input, metadata)).toContain('duplicate_declared_condition:first')
  })

  it.each([-1, 20, NaN, Infinity])('rejects invalid event times (%s)', (time) => {
    const { metadata, input } = fixture()
    input.occurrences[0].atSeconds = time
    expect(gaps(input, metadata).length).toBeGreaterThan(0)
  })

  it.each([-1, 1, Infinity])('rejects invalid snapshot times (%s)', (time) => {
    const { metadata, input } = fixture()
    input.occurrences[0].snapshotAtSeconds = time
    expect(gaps(input, metadata).length).toBeGreaterThan(0)
  })

  it.each([4, NaN, 'zero', false])('rejects invalid numeric condition values (%s)', (value) => {
    const { metadata, input } = fixture()
    input.occurrences[0].conditions[1].value = value
    expect(gaps(input, metadata).length).toBeGreaterThan(0)
  })

  it('rejects out-of-vocabulary enum values', () => {
    const { metadata, input } = fixture()
    input.occurrences[0].conditions[2].value = 'guessed'
    expect(gaps(input, metadata).join(' ')).toContain('invalid_declared_value')
  })

  it('rejects unknown fields at each input nesting level', () => {
    const { metadata, input } = fixture()
    for (const location of [input, input.occurrences[0], input.occurrences[0].conditions[0]]) {
      Object.assign(location, { arbitraryStat: 5 })
      expect(gaps(input, metadata).join(' ')).toContain('unrecognized_keys')
      Reflect.deleteProperty(location, 'arbitraryStat')
    }
  })

  it('rejects invalid metadata members, definitions, and unknown fields', () => {
    const { metadata } = fixture()
    metadata.memberIds.push('attacker')
    metadata.events[0].conditions.push(structuredClone(metadata.events[0].conditions[0]))
    metadata.sourceFingerprint = planningEventDeclarationsMetadataFingerprint32(metadata)
    expect(planningEventDeclarationsMetadataGaps32(metadata)).toContain('duplicate_member_id')
    expect(planningEventDeclarationsMetadataGaps32(metadata).join(' ')).toContain(
      'duplicate_condition_definition',
    )
    Object.assign(metadata.events[0].conditions[0], { arbitrary: true })
    expect(planningEventDeclarationsMetadataGaps32(metadata).join(' ')).toContain(
      'unrecognized_keys',
    )
  })

  it('hashes equivalent declaration ordering identically, and binds definition changes', () => {
    const { metadata, input } = fixture()
    const reorderedMetadata = structuredClone(metadata)
    reorderedMetadata.memberIds.reverse()
    reorderedMetadata.events[0].conditions.reverse()
    reorderedMetadata.events[0].conditions.forEach((condition) => condition.options?.reverse())
    expect(planningEventDeclarationsMetadataFingerprint32(reorderedMetadata)).toBe(
      metadata.sourceFingerprint,
    )
    const reorderedInput = structuredClone(input)
    reorderedInput.occurrences[0].conditions.reverse()
    reorderedInput.occurrences[0].sourceRefs.reverse()
    expect(planningEventDeclarationsInputFingerprint32(reorderedInput)).toBe(
      planningEventDeclarationsInputFingerprint32(input),
    )
    reorderedMetadata.events[0].requiresWindsweptObservation = false
    expect(planningEventDeclarationsMetadataFingerprint32(reorderedMetadata)).not.toBe(
      metadata.sourceFingerprint,
    )
  })
})
