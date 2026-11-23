import type { GoldenTop10Data } from './types'

export function formatStat(value: number, unit: '%' | '', signed = false) {
  const rounded = Math.round(value * 10) / 10
  const prefix = signed && rounded > 0 ? '+' : ''
  return `${prefix}${rounded.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}${unit}`
}

type Benchmark = NonNullable<GoldenTop10Data['valueBenchmarks']>[number]

export function benchmarkOverallReason(benchmark: Benchmark | undefined) {
  if (!benchmark || benchmark.status !== 'supported') return null
  if (
    benchmark.coverage.generalConclusion === 'supported' &&
    benchmark.candidateDisposition !== 'unresolved'
  )
    return null
  return (
    benchmark.coverage.reasons[0] ??
    (benchmark.coverage.generalConclusion === 'not_declared'
      ? '部分效果尚未纳入比较。'
      : '部分效果未计入比较。')
  )
}

export function benchmarkModelScope(benchmark: Benchmark | undefined) {
  if (!benchmark || benchmark.status !== 'supported') return null
  const baseline =
    benchmark.baseline?.modelQualification32 ?? benchmark.baseline?.memberModelQualification32
  const candidate =
    benchmark.candidate?.modelQualification32 ?? benchmark.candidate?.memberModelQualification32
  if (
    baseline?.status !== 'formal' ||
    candidate?.status !== 'formal' ||
    baseline.scope !== candidate.scope ||
    baseline.policyId !== candidate.policyId ||
    baseline.sourceHash !== candidate.sourceHash
  )
    return null
  return baseline.scope
}

export function benchmarkScopeNote(benchmark: Benchmark | undefined) {
  if (!benchmark || benchmark.status !== 'supported') return null
  if (benchmark.coverage.domain === 'prepared_anomaly_settlement')
    return '比较同条件下的单次异常伤害。'
  if (benchmark.coverage.generalConclusion === 'limited') return '比较固定动作的近似输出。'
  return benchmarkModelScope(benchmark) ? '比较同一时段内的动作输出。' : '比较代表动作的近似输出。'
}

export function benchmarkLabel(benchmark: Benchmark | undefined, stale: boolean) {
  if (stale) return '需重新搭配'
  if (!benchmark || benchmark.status !== 'supported') return '近似输出 —'
  if (benchmark.coverage.domain === 'prepared_anomaly_settlement') {
    const delta = benchmark.totalDamageDelta
    const percent = benchmark.totalDamagePercentDelta
    if (delta === null) return '单次异常比较 —'
    if (delta === 0) return '单次异常比较持平'
    if (percent === null || Math.abs(percent) < 0.005)
      return `单次异常比较 ${delta > 0 ? '+' : ''}${delta.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（无法换算百分比）`
    return `单次异常比较 ${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`
  }
  const overallReason = benchmarkOverallReason(benchmark)
  const outputLabel = benchmarkModelScope(benchmark) ? '同段输出' : '近似输出'
  const singleAction =
    benchmark.comparisonBasis?.rankingMethod === 'fixed_single_action_damage_delta'
  const absoluteDelta = singleAction ? benchmark.totalDamageDelta : benchmark.planningDpsDelta
  const percentDelta = singleAction
    ? benchmark.totalDamagePercentDelta
    : benchmark.planningDpsPercentDelta
  if (absoluteDelta === null) return `${outputLabel} —`
  if (percentDelta === null || (absoluteDelta !== 0 && Math.abs(percentDelta) < 0.005)) {
    return absoluteDelta === 0
      ? `${outputLabel}持平`
      : `${outputLabel} ${absoluteDelta > 0 ? '+' : ''}${absoluteDelta.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（无法换算百分比）`
  }
  const value = percentDelta
  if (benchmark.coverage.domain === 'fixed_event_direct_damage' || overallReason) {
    return value === 0
      ? `${outputLabel}持平`
      : `${outputLabel} ${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  }
  if (benchmark.candidateDisposition === 'executable_alternative')
    return `预计输出 ${value.toFixed(2)}%`
  if (benchmark.candidateDisposition === 'equivalent') return '预计输出持平'
  return `预计输出 ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function effectiveHitLabel(value: string) {
  return /^\d+(?:\.\d+)?$/.test(value) ? `有效副属性 ${value} 次命中` : `有效副属性 ${value}`
}

/** Search provenance is independent of the displayed comparison formula. */
export function candidateSearchLabel(search: GoldenTop10Data['candidateSearch']) {
  if (!search) return '本次排序方法未记录，请重新搭配查看。'
  const method =
    search.rankingMethod === 'parameter_bound_unranked'
      ? '当前没有足够的同条件可比候选，未生成伤害排序'
      : search.rankingMethod === 'prepared_anomaly_settlement'
        ? '按同条件单次异常结算排序；仅覆盖已声明条件和结算，不代表持续输出、全角色循环或游戏内整体最优'
        : search.rankingMethod === 'comparison_groups'
          ? `可比候选分组取舍：${[
              ...(search.rankingScopes?.includes('panel_target') ? ['支援按机制面板目标'] : []),
              ...(search.rankingScopes?.includes('declared_event') ? ['已覆盖事件按输出'] : []),
              ...(search.rankingScopes?.includes('fixed_event_slice')
                ? ['其他功能条件与覆盖相同的候选，仅按已计入的固定事件输出排序']
                : []),
            ].join(
              '；',
            )}；异常精通可能还有未计入的收益，未覆盖效果及其换装影响仍未知；顺序不代表整体优先级或游戏内最优`
          : search.rankingMethod === 'dynamic_objective'
            ? '按已覆盖属性与输出目标排序；未覆盖效果仍未知，不代表游戏内整体最优'
            : '按来源建议与局部细化排序；未覆盖效果仍未知，输出对比不代表名次依据或游戏内最优'
  if (search.status === 'not_run')
    return search.rankingMethod === 'comparison_groups'
      ? `${method}；未运行额外搜索。`
      : '排序尚未运行；当前顺序不能作为比较结论。'
  if (search.status === 'budget_exhausted')
    return `${method}；目前只搜索了部分搭配，可能还有其他方案。`
  if (search.status === 'objective_unresolved')
    return `${method}；部分目标尚未解决，未解决项不会按 0 处理。`
  return `${method}。`
}
