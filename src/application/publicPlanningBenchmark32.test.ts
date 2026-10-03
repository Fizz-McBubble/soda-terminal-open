import { createPlanningBenchmarkMetadata32Fixture } from '../testing/planningBenchmark32Fixture'
import { describe, expect, it } from 'vitest'
import {
  acceptPlanningBenchmarkResult32,
  planningBenchmark32Contract,
  planningBenchmarkResultFingerprint32,
  planningBenchmarkResultGaps32,
  type PlanningBenchmarkExpected32,
  type PlanningBenchmarkResult32,
} from './publicPlanningBenchmark32'

function seal(result: PlanningBenchmarkResult32) {
  const payload = { ...result }
  Reflect.deleteProperty(payload, 'resultFingerprint')
  result.resultFingerprint = planningBenchmarkResultFingerprint32(payload)
  return result
}
function fixture() {
  const metadata = createPlanningBenchmarkMetadata32Fixture({
    ownerAgentId: 'attacker',
    sourceRefs: ['event-ir'],
  })
  const expected: PlanningBenchmarkExpected32 = {
    runId: 'run',
    candidateId: 'candidate',
    fitFingerprint: 'fit',
    accountFingerprint: 'account',
    sourceBindingFingerprint: 'private-source-account-fit',
    inputFingerprint: 'input',
  }
  const result: PlanningBenchmarkResult32 = seal({
    contract: planningBenchmark32Contract,
    ...expected,
    sourceBindingFingerprint: expected.sourceBindingFingerprint!,
    metadata,
    sideEffect: 'read_only',
    status: 'declared_event_benchmark',
    formalCycleReady: false,
    totalDamage: 600,
    benchmarkDps: 30,
    declaredDurationSeconds: 20,
    eventResults: [
      {
        occurrenceId: 'first',
        ownerAgentId: 'attacker',
        eventId: 'hit',
        atSeconds: 0,
        snapshotAtSeconds: null,
        totalDamage: 200,
        runtimeHash: 'runtime-1',
        sourceRefs: ['event-ir'],
      },
      {
        occurrenceId: 'second',
        ownerAgentId: 'attacker',
        eventId: 'hit',
        atSeconds: 5,
        snapshotAtSeconds: 0,
        totalDamage: 400,
        runtimeHash: 'runtime-2',
        sourceRefs: ['event-ir'],
      },
    ],
    includedEffectKeys: ['source-direct'],
    excludedEffects: [
      {
        effectKey: 'unproved-cycle',
        reason: '轮转资源尚未证明',
        fields: ['resource'],
        sourceRefs: ['event-ir'],
      },
    ],
    gaps: [],
    missingContext: ['完整轮转与异常伤害不在本次逐次声明范围内'],
    resultFingerprint: '',
  })
  return { result, expected }
}

describe('public declared event benchmark contract', () => {
  it('accepts bounded event damage with honest cycle limitations and never grants formal readiness', () => {
    const { result, expected } = fixture()
    expect(planningBenchmarkResultGaps32(result, expected)).toEqual([])
    expect(acceptPlanningBenchmarkResult32(result, expected)).toBe(result)
    expect(result.formalCycleReady).toBe(false)
    expect(result.missingContext).not.toHaveLength(0)
    expect(planningBenchmarkResultFingerprint32(result)).toBe(result.resultFingerprint)
  })

  it.each([
    'runId',
    'candidateId',
    'fitFingerprint',
    'accountFingerprint',
    'inputFingerprint',
    'sourceBindingFingerprint',
  ] as const)('rejects stale or foreign %s', (field) => {
    const { result, expected } = fixture()
    result[field] = 'foreign'
    seal(result)
    expect(planningBenchmarkResultGaps32(result, expected)).toContain(
      `benchmark_binding_mismatch:${field}`,
    )
  })

  it('binds every public field and independent event state', () => {
    const { result, expected } = fixture()
    result.eventResults[0].runtimeHash = 'substituted-runtime'
    expect(planningBenchmarkResultGaps32(result, expected)).toContain(
      'benchmark_result_fingerprint_mismatch',
    )
    expect(() => acceptPlanningBenchmarkResult32(result, expected)).toThrow('响应无效')
    const { result: ordered } = fixture()
    const previous = ordered.resultFingerprint
    ordered.eventResults.reverse()
    expect(seal(ordered).resultFingerprint).not.toBe(previous)
  })

  it('rejects forged metadata vocabulary despite a resealed result', () => {
    const { result, expected } = fixture()
    result.metadata!.events[0].skillLevel = 13
    seal(result)
    expect(planningBenchmarkResultGaps32(result, expected)).toContain(
      'benchmark_metadata_source_fingerprint_mismatch',
    )
  })

  it.each(['metadata', 'unsupported'] as const)(
    'permits damage-free %s responses including failure input identity',
    (status) => {
      const { result, expected } = fixture()
      Object.assign(result, {
        status,
        totalDamage: null,
        benchmarkDps: null,
        declaredDurationSeconds: null,
        eventResults: [],
        gaps: status === 'unsupported' ? ['missing_declaration'] : [],
      })
      expect(planningBenchmarkResultGaps32(seal(result), expected)).toEqual([])
      result.totalDamage = 0
      expect(planningBenchmarkResultGaps32(seal(result), expected)).toContain(
        'unexpected_benchmark_damage',
      )
    },
  )

  it('accepts metadata discovery with null input and rejects absent discovery metadata', () => {
    const { result, expected } = fixture()
    expected.inputFingerprint = null
    Object.assign(result, {
      status: 'metadata',
      inputFingerprint: null,
      totalDamage: null,
      benchmarkDps: null,
      declaredDurationSeconds: null,
      eventResults: [],
    })
    expect(planningBenchmarkResultGaps32(seal(result), expected)).toEqual([])
    result.metadata = null
    expect(planningBenchmarkResultGaps32(seal(result), expected)).toContain(
      'missing_benchmark_metadata',
    )
  })

  it.each([-1, NaN, Infinity])('rejects invalid damage %s', (damage) => {
    const { result, expected } = fixture()
    result.eventResults[0].totalDamage = damage
    expect(planningBenchmarkResultGaps32(seal(result), expected).join(' ')).toContain(
      'invalid_benchmark_result',
    )
  })

  it('verifies sum, DPS and declared duration', () => {
    const { result, expected } = fixture()
    result.totalDamage = 599
    result.benchmarkDps = 100
    result.declaredDurationSeconds = 21
    const gaps = planningBenchmarkResultGaps32(seal(result), expected)
    expect(gaps).toContain('benchmark_total_damage_mismatch')
    expect(gaps).toContain('benchmark_dps_mismatch')
    expect(gaps).toContain('benchmark_duration_mismatch')
  })

  it('accepts explicit zero damage but rejects incomplete successful slices', () => {
    const { result, expected } = fixture()
    result.eventResults.forEach((event) => {
      event.totalDamage = 0
    })
    result.totalDamage = 0
    result.benchmarkDps = 0
    expect(planningBenchmarkResultGaps32(seal(result), expected)).toEqual([])
    result.gaps.push('unobserved_condition')
    result.eventResults = []
    expect(planningBenchmarkResultGaps32(seal(result), expected)).toContain(
      'benchmark_contains_unresolved_gaps',
    )
    expect(planningBenchmarkResultGaps32(seal(result), expected)).toContain(
      'missing_benchmark_event_results',
    )
  })

  it.each(['ownerAgentId', 'eventId'] as const)('rejects event identity mismatch in %s', (key) => {
    const { result, expected } = fixture()
    result.eventResults[0][key] = 'foreign'
    expect(planningBenchmarkResultGaps32(seal(result), expected)).toContain(
      'unknown_benchmark_event:first',
    )
  })

  it('rejects duplicate occurrence IDs, out-of-duration event times, future snapshots and wrong evidence', () => {
    const { result, expected } = fixture()
    result.eventResults[1].occurrenceId = 'first'
    result.eventResults[0].atSeconds = 20
    result.eventResults[1].snapshotAtSeconds = 6
    result.eventResults[0].sourceRefs = ['wrong-ir']
    const gaps = planningBenchmarkResultGaps32(seal(result), expected)
    expect(gaps).toContain('duplicate_benchmark_occurrence_id')
    expect(gaps).toContain('invalid_benchmark_event_time:first')
    expect(gaps).toContain('invalid_benchmark_snapshot_time:first')
    expect(gaps).toContain('wrong_benchmark_event_source:first')
  })

  it('rejects included/excluded conflicts', () => {
    const { result, expected } = fixture()
    result.excludedEffects[0].effectKey = result.includedEffectKeys[0]
    expect(planningBenchmarkResultGaps32(seal(result), expected)).toContain(
      'conflicting_benchmark_effect_key',
    )
  })

  it('rejects unknown result fields and formal cycle promotion', () => {
    const { result, expected } = fixture()
    Object.assign(result, { formalCycleReady: true, formalDps: 30 })
    const gaps = planningBenchmarkResultGaps32(result, expected).join(' ')
    expect(gaps).toContain('formalCycleReady')
    expect(gaps).toContain('unrecognized_keys')
  })
})
