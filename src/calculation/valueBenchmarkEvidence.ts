import type {
  ValueBenchmarkCoverage,
  ValueBenchmarkDimension,
  ValueBenchmarkSide,
} from './valueBenchmarkComparison'

/** A comparison can keep its numeric slice without asserting an overall recommendation. */
export const valueBenchmarkEvidencePolicy = 'value-benchmark-evidence-r4' as const

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString)
}

function sourceReferences(value: unknown): value is string[] {
  return (
    stringArray(value) &&
    value.length > 0 &&
    value.every(
      (reference) =>
        !/^(?:source[-_:])?(?:unknown|unresolved|todo|placeholder|missing)(?:$|[-_: /])/i.test(
          reference.trim(),
        ),
    )
  )
}

export function valueBenchmarkSideEvidenceIssues(
  side: ValueBenchmarkSide,
  dimensions: readonly ValueBenchmarkDimension[],
): string[] {
  if (side.state !== 'supported') return []
  const issues: string[] = []
  for (const dimension of dimensions) {
    if (!nonEmptyString(side.dimensions?.[dimension])) issues.push(`缺少比较上下文：${dimension}。`)
  }
  if (!nonEmptyString(side.calculationFingerprint)) issues.push('缺少计算结果指纹。')
  return issues
}

export function hasWellFormedValueBenchmarkCoverage(
  value: unknown,
): value is ValueBenchmarkCoverage {
  if (!value || typeof value !== 'object') return false
  const coverage = value as Partial<ValueBenchmarkCoverage>
  return (
    coverage.domain === 'fixed_event_direct_damage' &&
    nonEmptyString(coverage.boundary) &&
    nonEmptyString(coverage.exclusionContextFingerprint) &&
    stringArray(coverage.includedEffectKeys) &&
    Array.isArray(coverage.excludedEffects) &&
    coverage.excludedEffects.every(
      (effect) =>
        effect !== null &&
        typeof effect === 'object' &&
        nonEmptyString(effect.effectKey) &&
        nonEmptyString(effect.reason) &&
        stringArray(effect.fields) &&
        sourceReferences(effect.sourceRefs),
    )
  )
}
