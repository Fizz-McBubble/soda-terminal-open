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
    return '单次异常比较只覆盖同一准备条件下的结算，部分效果未计入。'
  return benchmarkModelScope(benchmark)
    ? '按已列动作与固定窗口比较，不代表持续实战输出。'
    : '按代表动作近似比较，部分效果可能未计入。'
}

export function benchmarkLabel(benchmark: Benchmark | undefined, stale: boolean) {
  if (stale) return '需重新搭配'
  if (!benchmark || benchmark.status !== 'supported') return '暂无输出对比'
  if (benchmark.coverage.domain === 'prepared_anomaly_settlement') {
    const delta = benchmark.totalDamageDelta
    const percent = benchmark.totalDamagePercentDelta
    if (delta === null) return '暂无输出对比'
    if (delta === 0) return '单次异常比较持平'
    if (percent === null || Math.abs(percent) < 0.005)
      return `单次异常比较 ${delta > 0 ? '+' : ''}${delta.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（无法换算百分比）`
    return `单次异常比较 ${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`
  }
  const overallReason = benchmarkOverallReason(benchmark)
  const outputLabel = benchmarkModelScope(benchmark) ? '同段输出' : '近似输出'
  const absoluteDelta = benchmark.planningDpsDelta
  if (absoluteDelta === null) return '暂无输出对比'
  if (
    benchmark.planningDpsPercentDelta === null ||
    (absoluteDelta !== 0 && Math.abs(benchmark.planningDpsPercentDelta) < 0.005)
  ) {
    return absoluteDelta === 0
      ? `${outputLabel}持平`
      : `${outputLabel} ${absoluteDelta > 0 ? '+' : ''}${absoluteDelta.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（无法换算百分比）`
  }
  const value = benchmark.planningDpsPercentDelta
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
