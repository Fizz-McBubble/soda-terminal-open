type BenchmarkDispositionEvidence = {
  status: string
  coverage: { generalConclusion: string }
  candidateDisposition: string
}

export function valueBenchmarkSaveLabel(
  valueBenchmark: BenchmarkDispositionEvidence | null | undefined,
) {
  if (
    valueBenchmark?.status === 'supported' &&
    (valueBenchmark.coverage.generalConclusion !== 'supported' ||
      valueBenchmark.candidateDisposition === 'unresolved')
  )
    return '固定事件数值可参考，整体优劣未确定'
  if (valueBenchmark?.candidateDisposition === 'recommendation') return '预计提升'
  if (valueBenchmark?.candidateDisposition === 'executable_alternative')
    return '当前方案更优，保存为可执行替代'
  if (valueBenchmark?.candidateDisposition === 'equivalent') return '预计持平'
  return '独立配装方案，未计算相对提升'
}
