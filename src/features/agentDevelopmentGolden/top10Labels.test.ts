import { describe, expect, it } from 'vitest'
import { benchmarkLabel, benchmarkScopeNote, candidateSearchLabel } from './top10Labels'

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
    expect(benchmarkScopeNote(comparison(false))).toBe('比较代表动作的近似输出。')
  })
  it('identifies limited comparisons as fixed-action output', () => {
    const value = comparison(false)
    value.coverage.generalConclusion = 'limited'
    expect(benchmarkScopeNote(value)).toBe('比较固定动作的近似输出。')
  })
  it('retains same-window output only for a matching qualified model on both sides', () => {
    const value = comparison(true)
    expect(benchmarkLabel(value, false)).toBe('同段输出 +17.15%')
    expect(benchmarkScopeNote(value)).toBe('比较同一时段内的动作输出。')
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
    expect(benchmarkLabel(value, false)).toBe('近似输出 —')
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
    expect(benchmarkScopeNote(value)).toBe('比较同条件下的单次异常伤害。')
    value.totalDamageDelta = 0
    value.totalDamagePercentDelta = 0
    expect(benchmarkLabel(value, false)).toBe('单次异常比较持平')
  })
})

describe('candidate search provenance', () => {
  it('distinguishes fallback order, modeled search and missing historic provenance', () => {
    const search = {
      rankingMethod: 'source_and_local_refinement',
      status: 'budget_exhausted',
      nodes: 30000,
      evaluations: 384,
      exactWithinDeclaredModel: false,
      productionGameAccuracyCertified: false,
    } as const
    expect(candidateSearchLabel(search)).toContain('输出对比不代表名次依据')
    expect(
      candidateSearchLabel({
        ...search,
        rankingMethod: 'comparison_groups',
        rankingScopes: ['fixed_event_slice'],
      }),
    ).toContain('未覆盖效果及其换装影响仍未知')
    const slice = candidateSearchLabel({
      ...search,
      status: 'not_run',
      rankingMethod: 'comparison_groups',
      rankingScopes: ['fixed_event_slice'],
    })
    expect(slice).toContain('仅按已计入的固定事件输出排序')
    expect(slice).toContain('异常精通可能还有未计入的收益')
    expect(slice).toContain('顺序不代表整体优先级')
    expect(slice).toContain('未覆盖效果及其换装影响仍未知')
    expect(slice).toContain('未运行额外搜索')
    expect(candidateSearchLabel(search)).toContain('目前只搜索了部分搭配')
    const dynamic = candidateSearchLabel({ ...search, rankingMethod: 'dynamic_objective' })
    expect(dynamic).toContain('按已覆盖属性与输出目标排序')
    expect(dynamic).toContain('未覆盖效果仍未知')
    expect(dynamic).toContain('不代表游戏内整体最优')
    const anomaly = candidateSearchLabel({
      ...search,
      rankingMethod: 'prepared_anomaly_settlement',
    })
    expect(anomaly).toContain('按同条件单次异常结算排序')
    expect(anomaly).toContain('仅覆盖已声明条件和结算')
    expect(anomaly).toContain('不代表持续输出、全角色循环或游戏内整体最优')
    expect(anomaly).toContain('目前只搜索了部分搭配')
    expect(anomaly).not.toContain('按已覆盖属性与输出目标排序')
    const unranked = candidateSearchLabel({
      ...search,
      status: 'complete',
      rankingMethod: 'parameter_bound_unranked',
    })
    expect(unranked).toContain('未生成伤害排序')
    expect(unranked).not.toContain('按同条件单次异常结算排序')
    expect(candidateSearchLabel(undefined)).toContain('未记录')
  })
})

describe('personal damage remains the primary output metric', () => {
  it('does not relabel functional protection as a damage percentage', () => {
    const v = comparison(false)
    v.planningDpsDelta = -99
    v.planningDpsPercentDelta = -99
    const objective = {
      kind: 'functional_capacity' as const,
      capacityKey: 'source-daze',
      capacityKind: 'source_daze_basis' as const,
      value: 10,
      unit: '失衡量' as const,
      contextKey: 'same',
      coverageIdentity: 'same',
      sourceRefs: ['source'],
      included: [],
      excluded: [],
    }
    v.baseline = { ...v.baseline!, personalObjective32: objective }
    v.candidate = { ...v.candidate!, personalObjective32: { ...objective, value: 20 } }
    expect(benchmarkLabel(v, false)).toBe('近似输出 -99.00%')
  })
})
