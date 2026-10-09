import { describe, expect, it } from 'vitest'
import { benchmarkLabel, benchmarkScopeNote } from './top10Labels'

type Benchmark = NonNullable<Parameters<typeof benchmarkLabel>[0]>
function comparison(qualified: boolean): Benchmark {
  const model = {
    status: 'formal',
    scope: 'personal_prepared_fixed_event_model',
    policyId: 'personal-roxy-prepared-held-one-second-30s-r1',
    sourceHash: 'source-fixture',
  }
  return {
    status: 'supported',
    planningDpsDelta: 17.15,
    planningDpsPercentDelta: 17.15,
    candidateDisposition: 'executable_alternative',
    coverage: { domain: 'fixed_event_direct_damage', generalConclusion: 'supported', reasons: [] },
    baseline: qualified ? { modelQualification32: model } : {},
    candidate: qualified ? { modelQualification32: model } : {},
  } as unknown as Benchmark
}
describe('output model summary', () => {
  it('makes a representative-action fallback distinguishable without suppressing its result', () => {
    expect(benchmarkLabel(comparison(false), false)).toBe('近似输出 +17.15%')
    expect(benchmarkScopeNote(comparison(false))).toContain('代表动作近似')
  })
  it('retains same-window output only for a matching qualified model on both sides', () => {
    const value = comparison(true)
    expect(benchmarkLabel(value, false)).toBe('同段输出 +17.15%')
    expect(benchmarkScopeNote(value)).toContain('固定窗口')
    value.candidate!.modelQualification32 = {
      ...value.candidate!.modelQualification32!,
      policyId: 'personal-claret-prepared-held-subduing-axe-30s-r1',
    }
    expect(benchmarkLabel(value, false)).toBe('近似输出 +17.15%')
  })
  it('does not show a model note for unsupported or stale results', () => {
    const value = comparison(true)
    expect(benchmarkLabel(value, true)).toBe('需重新搭配')
    value.status = 'unsupported'
    expect(benchmarkScopeNote(value)).toBeNull()
    expect(benchmarkLabel(value, false)).toBe('暂无输出对比')
  })
  it('labels single anomaly damage without presenting it as same-window output or DPS', () => {
    const value = {
      ...comparison(false),
      totalDamageDelta: 12834,
      totalDamagePercentDelta: 10,
      planningDpsDelta: null,
      planningDpsPercentDelta: null,
      coverage: {
        ...comparison(false).coverage,
        domain: 'prepared_anomaly_settlement' as const,
        generalConclusion: 'limited' as const,
      },
    }
    expect(benchmarkLabel(value, false)).toBe('单次异常比较 +10.00%')
    expect(benchmarkScopeNote(value)).toContain('同一准备条件')
    value.totalDamageDelta = 0
    value.totalDamagePercentDelta = 0
    expect(benchmarkLabel(value, false)).toBe('单次异常比较持平')
  })
})
