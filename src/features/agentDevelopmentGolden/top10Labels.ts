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

export function benchmarkLabel(benchmark: Benchmark | undefined, stale: boolean) {
  if (stale) return '需重新搭配'
  if (!benchmark || benchmark.status !== 'supported') return '暂无输出对比'
  const overallReason = benchmarkOverallReason(benchmark)
  const absoluteDelta = benchmark.planningDpsDelta
  if (absoluteDelta === null) return '暂无输出对比'
  if (
    benchmark.planningDpsPercentDelta === null ||
    (absoluteDelta !== 0 && Math.abs(benchmark.planningDpsPercentDelta) < 0.005)
  ) {
    return absoluteDelta === 0
      ? '同段输出持平'
      : `同段输出 ${absoluteDelta > 0 ? '+' : ''}${absoluteDelta.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（无法换算百分比）`
  }
  const value = benchmark.planningDpsPercentDelta
  if (benchmark.coverage.domain === 'fixed_event_direct_damage' || overallReason) {
    return value === 0 ? '同段输出持平' : `同段输出 ${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  }
  if (benchmark.candidateDisposition === 'executable_alternative')
    return `预计输出 ${value.toFixed(2)}%`
  if (benchmark.candidateDisposition === 'equivalent') return '预计输出持平'
  return `预计输出 ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function effectiveHitLabel(value: string) {
  return /^\d+(?:\.\d+)?$/.test(value) ? `有效副属性 ${value} 次命中` : `有效副属性 ${value}`
}
