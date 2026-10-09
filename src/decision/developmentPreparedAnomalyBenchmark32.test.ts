import { describe, expect, it } from 'vitest'
import { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from './developmentPreparedAnomalyBenchmark32'
import { createLevel60NeutralEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { compareValueBenchmarkSides } from '../calculation/valueBenchmarkComparison'
import { labels, side } from '../calculation/valueBenchmarkTestFixtures'

function input() {
  const member = createLevel60NeutralEffectRuntimeMember('agent-piper')
  member.coreLevel = 7
  member.finalStats = {
    ...member.finalStats,
    atk: 3000,
    anomProf: 300,
    anomMas: 200,
    damageBonus: 0,
    pen_: 0,
  }
  member.initialStats = { ...member.finalStats, atk: 2000 }
  return {
    member,
    baseline: {
      ...currentNormalizedPlanningBaseline,
      enemy: {
        id: 'neutral-fixture',
        defense: 0,
        resistance: 0,
        stunMultiplier: 1,
        vulnerability: 0,
      },
    },
    discs: [{ setId: 'set-freedom-blues' }],
    wEngine: { engineId: 'wengine-13008', refinement: 1 },
    engineKey: 'wengine-13008:p1:lv60:asc5',
    discLoadoutKey: 'disc-a',
    subjectKey: 'agent:agent-piper',
    potential: 0,
  }
}
const compare = (
  baseline = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(input()),
  candidate = baseline,
) =>
  compareValueBenchmarkSides({ baseline, candidate, changedDimensions: ['disc_loadout'], labels })

describe('prepared anomaly candidate comparison adapter', () => {
  it('binds actual settlement numbers with no DPS, and preserves all exclusions read-only', () => {
    const raw = input(),
      before = structuredClone(raw)
    const result = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(raw)
    expect(result.state).toBe('supported')
    expect(result.totalDamage).toBeCloseTo(128340, 8)
    expect(result.planningDps).toBeNull()
    expect(result.dimensions.duration).toBe('not_applicable')
    expect(result.coverage?.domain).toBe('prepared_anomaly_settlement')
    expect(result.coverage?.excludedEffects.map((row) => row.effectKey)).toEqual(
      expect.arrayContaining(['unmodeled:direct-and-cycle', 'unmodeled:buildup-frequency']),
    )
    expect(raw).toEqual(before)
  })
  it('compares AP+30 as independent 10% single settlement improvement, without whole-build recommendation', () => {
    const raw = input(),
      changed = input()
    changed.member.finalStats.anomProf = 330
    changed.discLoadoutKey = 'disc-b'
    const baseline = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(raw),
      candidate = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(changed)
    const result = compare(baseline, candidate)
    expect(result).toMatchObject({
      status: 'supported',
      comparable: true,
      totalDamageDelta: 12834,
      totalDamagePercentDelta: 10,
      planningDpsDelta: null,
      planningDpsPercentDelta: null,
      verdict: 'candidate_better',
      direction: 'higher',
      candidateDisposition: 'unresolved',
      coverage: {
        domain: 'prepared_anomaly_settlement',
        generalConclusion: 'limited',
        exclusionContextChanged: true,
      },
      comparisonBasis: { rankingMethod: 'prepared_anomaly_settlement_damage_delta' },
    })
    expect(result.coverage.baseline?.excludedEffects.length).toBeGreaterThan(0)
    expect(result.coverage.candidate?.excludedEffects.length).toBeGreaterThan(0)
  })
  it('same full input remains a comparable equivalent slice with limited overall conclusion', () => {
    const result = compare()
    expect(result).toMatchObject({
      comparable: true,
      totalDamageDelta: 0,
      totalDamagePercentDelta: 0,
      verdict: 'equivalent',
      candidateDisposition: 'unresolved',
      coverage: { generalConclusion: 'limited' },
    })
  })
  it('cannot compare a direct domain against a prepared settlement even with matching dimensions', () => {
    const prepared = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(input())
    const direct = side({
      dimensions: { ...prepared.dimensions },
      totalDamage: 128340,
      planningDps: 4278,
    })
    const result = compare(prepared, direct)
    expect(result.comparable).toBe(false)
    expect(result.totalDamagePercentDelta).toBeNull()
    expect(result.planningDpsPercentDelta).toBeNull()
    expect(result.reasons.join(' ')).toContain('不同数值域')
  })
  it.each(['unknown', 'limited', 'stale', 'unsupported'] as const)(
    'preserves %s without substituting 0%%',
    (state) => {
      const prepared = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(input())
      const result = compare({ ...prepared, state, totalDamage: null }, prepared)
      expect(result.status).toBe(state)
      expect(result.totalDamageDelta).toBeNull()
      expect(result.totalDamagePercentDelta).toBeNull()
    },
  )
  it('rejects fabricated duration/DPS, missing fingerprints, source drift and non-finite damage', () => {
    const prepared = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(input())
    for (const candidate of [
      { ...prepared, planningDps: 0 },
      { ...prepared, dimensions: { ...prepared.dimensions, duration: '30' } },
      { ...prepared, calculationFingerprint: null },
      { ...prepared, totalDamage: Number.NaN },
    ])
      expect(compare(prepared, candidate).comparable).toBe(false)
    expect(
      evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
        ...input(),
        sourceIdentityHash: 'old-source',
      }).state,
    ).toBe('unsupported')
  })
  it('zero baseline yields only finite absolute damage delta; unknown is distinct from proven zero', () => {
    const prepared = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(input())
    const result = compare({ ...prepared, totalDamage: 0 }, prepared)
    expect(result.totalDamageDelta).toBe(128340)
    expect(result.totalDamagePercentDelta).toBeNull()
    expect(result.planningDpsDelta).toBeNull()
  })
  it('preserves sourced disc exclusions including their source path/hash', () => {
    const raw = input()
    raw.discs = Array.from({ length: 4 }, () => ({ setId: 'set-freedom-blues' }))
    const prepared = evaluateDevelopmentPreparedAnomalyBenchmarkSide32(raw)
    expect(prepared.state).toBe('supported')
    expect(
      prepared.coverage?.excludedEffects
        .filter((row) => row.effectKey.startsWith('disc:'))
        .every((row) => row.sourceRefs.every((ref) => typeof ref === 'string' && ref.length > 0)),
    ).toBe(true)
    expect(compare(prepared).comparable).toBe(true)
  })
})
