import { stableContentHash } from '../gameDataPacks/types'
import type { qualifyReviewedPreparedBenchmark32 } from './reviewedPreparedBenchmark32'
import type { qualifyReviewedPreparedTeamBenchmark32 } from './reviewedPreparedTeamBenchmark32'
import type { evaluateReviewedFunctionalCapacity32 } from './reviewedFunctionalCapacity32'
import {
  hasWellFormedValueBenchmarkCoverage,
  valueBenchmarkEvidencePolicy,
  valueBenchmarkSideEvidenceIssues,
} from './valueBenchmarkEvidence'

export const valueBenchmarkComparisonContract = 'soda-value-benchmark-comparison/v1' as const

export type ValueBenchmarkState = 'supported' | 'limited' | 'unknown' | 'unsupported' | 'stale'

export type ValueBenchmarkEffectExclusion = {
  effectKey: string
  reason: string
  fields: string[]
  sourceRefs: string[]
  effectPath?: string | null
  recipientAgentIds?: string[] | null
  writeFields?: string[]
  resolvedInactive?: boolean
  action?: string | null
}

export type ValueBenchmarkCoverage = {
  domain: 'fixed_event_direct_damage' | 'prepared_anomaly_settlement'
  includedEffectKeys: string[]
  excludedEffects: ValueBenchmarkEffectExclusion[]
  exclusionContextFingerprint: string
  boundary: string
}

export type ValueBenchmarkDimension =
  | 'game_version'
  | 'subject'
  | 'scenario'
  | 'event_set'
  | 'duration'
  | 'formula'
  | 'runtime'
  | 'disc_loadout'
  | 'w_engine'
  | 'bangboo'
  | 'potential'

export type ValueBenchmarkSide = {
  state: ValueBenchmarkState
  dimensions: Record<Exclude<ValueBenchmarkDimension, 'potential'>, string> & { potential?: string }
  totalDamage: number | null
  planningDps: number | null
  calculationFingerprint: string | null
  reasons: string[]
  coverage?: ValueBenchmarkCoverage
  /** Internal same-action non-regression evidence; never a damage-equivalent score. */
  functionalCapacities32?: ReturnType<typeof evaluateReviewedFunctionalCapacity32>
  /** Actual projected inputs for functional domains not covered by a numeric outcome. */
  functionalStats32?: { impact: number; enerRegen: number; anomMas: number; anomProf: number }
  sourceResourceProduction32?: ReturnType<
    typeof import('./sourceResourceProduction32').summarizeSourceResourceProduction32
  >
  modelQualification32?: NonNullable<ReturnType<typeof qualifyReviewedPreparedBenchmark32>>
  memberModelQualification32?: NonNullable<
    ReturnType<typeof qualifyReviewedPreparedTeamBenchmark32>
  >
}

export type ValueBenchmarkComparisonBasis = {
  baselineLabel: string
  candidateLabel: string
  /** Provenance belongs to the comparison, never to account equipment facts. */
  baselineSource?: { kind: 'actual' | 'saved' | 'candidate' | 'none'; referenceId: string | null }
  changedDimensions: ValueBenchmarkDimension[]
  scenario: {
    baseline: string
    candidate: string
  }
  support: {
    baseline: ValueBenchmarkState
    candidate: ValueBenchmarkState
    comparison: ValueBenchmarkState
  }
  rankingMethod: 'fixed_event_planning_dps_delta' | 'prepared_anomaly_settlement_damage_delta'
}

export type ValueBenchmarkComparison = ReturnType<typeof compareValueBenchmarkSides>

const lockedDimensions: ValueBenchmarkDimension[] = [
  'game_version',
  'subject',
  'scenario',
  'event_set',
  'duration',
  'formula',
  'runtime',
  'disc_loadout',
  'w_engine',
  'bangboo',
  'potential',
]

const mutableDimensions: readonly ValueBenchmarkDimension[] = [
  'disc_loadout',
  'w_engine',
  'bangboo',
  'potential',
]

function unique<T extends string>(values: readonly T[]) {
  return [...new Set(values)]
}

function nonSupportedState(left: ValueBenchmarkState, right: ValueBenchmarkState) {
  if (left === 'stale' || right === 'stale') return 'stale' as const
  if (left === 'unsupported' || right === 'unsupported') return 'unsupported' as const
  if (left === 'unknown' || right === 'unknown') return 'unknown' as const
  return 'limited' as const
}

function exclusionKey(exclusion: ValueBenchmarkEffectExclusion) {
  return stableContentHash({
    effectKey: exclusion.effectKey,
    reason: exclusion.reason,
    fields: [...exclusion.fields].sort(),
    sourceRefs: [...exclusion.sourceRefs].sort(),
  })
}

function symmetricDifference(left: readonly string[], right: readonly string[]) {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return unique([
    ...left.filter((value) => !rightSet.has(value)),
    ...right.filter((value) => !leftSet.has(value)),
  ]).sort()
}

export function valueBenchmarkComparabilityKey(
  side: ValueBenchmarkSide,
  changedDimensions: readonly ValueBenchmarkDimension[],
) {
  const changed = new Set(
    changedDimensions.filter((dimension) => mutableDimensions.includes(dimension)),
  )
  return stableContentHash(
    Object.fromEntries(
      lockedDimensions
        .filter((dimension) => !changed.has(dimension))
        .map((dimension) => [dimension, side.dimensions?.[dimension]]),
    ),
  )
}

export function compareValueBenchmarkSides(input: {
  baseline: ValueBenchmarkSide
  candidate: ValueBenchmarkSide
  changedDimensions: ValueBenchmarkDimension[]
  independentCounterfactual?: boolean
  labels: {
    baseline: string
    candidate: string
  }
  baselineSource?: ValueBenchmarkComparisonBasis['baselineSource']
}) {
  const changedDimensions = unique(input.changedDimensions)
  const invalidChangedDimensions = changedDimensions.filter(
    (dimension) => !mutableDimensions.includes(dimension),
  )
  const baselineKey = valueBenchmarkComparabilityKey(input.baseline, changedDimensions)
  const candidateKey = valueBenchmarkComparabilityKey(input.candidate, changedDimensions)
  const sideEvidenceIssues = [
    ...valueBenchmarkSideEvidenceIssues(
      input.baseline,
      lockedDimensions.filter(
        (key) =>
          key !== 'potential' ||
          input.baseline.dimensions.potential !== undefined ||
          input.candidate.dimensions.potential !== undefined ||
          changedDimensions.includes('potential'),
      ),
    ).map((reason) => `当前方案：${reason}`),
    ...valueBenchmarkSideEvidenceIssues(
      input.candidate,
      lockedDimensions.filter(
        (key) =>
          key !== 'potential' ||
          input.baseline.dimensions.potential !== undefined ||
          input.candidate.dimensions.potential !== undefined ||
          changedDimensions.includes('potential'),
      ),
    ).map((reason) => `候选方案：${reason}`),
  ]
  const reasons = unique([
    ...sideEvidenceIssues,
    ...input.baseline.reasons.map((reason) => `当前方案：${reason}`),
    ...input.candidate.reasons.map((reason) => `候选方案：${reason}`),
    ...(invalidChangedDimensions.length
      ? [`changedDimensions 含不允许变化的维度：${invalidChangedDimensions.join('、')}`]
      : []),
    ...(baselineKey === candidateKey ? [] : ['除 changedDimensions 外仍有计算上下文不一致。']),
  ])
  const bothSupported =
    input.baseline.state === 'supported' && input.candidate.state === 'supported'
  const preparedAnomaly =
    input.baseline.coverage?.domain === 'prepared_anomaly_settlement' &&
    input.candidate.coverage?.domain === 'prepared_anomaly_settlement'
  const crossDomain =
    input.baseline.coverage?.domain !== input.candidate.coverage?.domain &&
    (input.baseline.coverage?.domain === 'prepared_anomaly_settlement' ||
      input.candidate.coverage?.domain === 'prepared_anomaly_settlement')
  const numeric = (
    preparedAnomaly
      ? [input.baseline.totalDamage, input.candidate.totalDamage]
      : [
          input.baseline.totalDamage,
          input.baseline.planningDps,
          input.candidate.totalDamage,
          input.candidate.planningDps,
        ]
  ).every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  const comparable =
    bothSupported &&
    numeric &&
    !crossDomain &&
    !sideEvidenceIssues.length &&
    !invalidChangedDimensions.length &&
    baselineKey === candidateKey
  const baselineCoverage = hasWellFormedValueBenchmarkCoverage(input.baseline.coverage)
    ? input.baseline.coverage
    : undefined
  const candidateCoverage = hasWellFormedValueBenchmarkCoverage(input.candidate.coverage)
    ? input.candidate.coverage
    : undefined
  const incompleteDeclaredCoverage = Boolean(
    (input.baseline.coverage !== undefined && !baselineCoverage) ||
    (input.candidate.coverage !== undefined && !candidateCoverage),
  )
  const declaredCoverage = Boolean(baselineCoverage && candidateCoverage)
  const coverageDomainsMatch =
    declaredCoverage && baselineCoverage!.domain === candidateCoverage!.domain
  const changedIncludedEffectKeys = declaredCoverage
    ? symmetricDifference(
        baselineCoverage!.includedEffectKeys,
        candidateCoverage!.includedEffectKeys,
      )
    : []
  const changedExcludedEffectKeys = declaredCoverage
    ? symmetricDifference(
        baselineCoverage!.excludedEffects.map(exclusionKey),
        candidateCoverage!.excludedEffects.map(exclusionKey),
      )
    : []
  const hasExcludedEffects = Boolean(
    baselineCoverage?.excludedEffects.length || candidateCoverage?.excludedEffects.length,
  )
  const exclusionContextChanged = Boolean(
    declaredCoverage &&
    hasExcludedEffects &&
    baselineCoverage!.exclusionContextFingerprint !==
      candidateCoverage!.exclusionContextFingerprint,
  )
  const generalConclusionRisk = Boolean(
    comparable &&
    (preparedAnomaly ||
      !declaredCoverage ||
      !coverageDomainsMatch ||
      changedExcludedEffectKeys.length ||
      (hasExcludedEffects && exclusionContextChanged)),
  )
  const coverageReasons = unique([
    ...(preparedAnomaly
      ? ['单次异常比较只覆盖已声明结算；直伤、积蓄与循环收益尚未完整建模，不能推导整体最佳。']
      : []),
    ...(incompleteDeclaredCoverage ? ['数值覆盖声明不完整，不能推导配装整体优劣。'] : []),
    ...(!declaredCoverage && !incompleteDeclaredCoverage
      ? ['两侧尚未完整声明数值覆盖范围，仅保留固定事件数值差。']
      : []),
    ...(!declaredCoverage || coverageDomainsMatch ? [] : ['两侧声明的数值覆盖域不一致。']),
    ...(changedExcludedEffectKeys.length
      ? ['换装改变了固定事件公式未建模的效果，数值差不能推广为整体优劣。']
      : []),
    ...(hasExcludedEffects && exclusionContextChanged
      ? ['未建模效果的相关盘面或条件上下文发生变化，不能假定两侧影响相互抵消。']
      : []),
  ])
  const totalDamageDelta = comparable
    ? input.candidate.totalDamage! - input.baseline.totalDamage!
    : null
  const planningDpsDelta =
    comparable && !preparedAnomaly
      ? input.candidate.planningDps! - input.baseline.planningDps!
      : null
  const rawPlanningDpsPercentDelta =
    comparable && !preparedAnomaly && input.baseline.planningDps !== 0
      ? (planningDpsDelta! / input.baseline.planningDps!) * 100
      : null
  const planningDpsPercentDelta =
    rawPlanningDpsPercentDelta !== null && Number.isFinite(rawPlanningDpsPercentDelta)
      ? rawPlanningDpsPercentDelta
      : null
  const rawTotalDamagePercentDelta =
    comparable && input.baseline.totalDamage !== 0
      ? (totalDamageDelta! / input.baseline.totalDamage!) * 100
      : null
  const totalDamagePercentDelta =
    rawTotalDamagePercentDelta !== null && Number.isFinite(rawTotalDamagePercentDelta)
      ? rawTotalDamagePercentDelta
      : null
  const status = comparable
    ? ('supported' as const)
    : bothSupported
      ? ('unsupported' as const)
      : nonSupportedState(input.baseline.state, input.candidate.state)
  const attribution =
    changedDimensions.length === 1 && input.independentCounterfactual
      ? ('single_variable' as const)
      : ('combination' as const)
  const comparisonDelta = preparedAnomaly ? totalDamageDelta : planningDpsDelta
  const verdict =
    comparisonDelta === null
      ? ('not_comparable' as const)
      : comparisonDelta > 0
        ? ('candidate_better' as const)
        : comparisonDelta < 0
          ? ('baseline_better' as const)
          : ('equivalent' as const)
  const candidateDisposition = generalConclusionRisk
    ? ('unresolved' as const)
    : verdict === 'candidate_better'
      ? ('recommendation' as const)
      : verdict === 'baseline_better'
        ? ('executable_alternative' as const)
        : verdict === 'equivalent'
          ? ('equivalent' as const)
          : ('unresolved' as const)
  const comparisonBasis: ValueBenchmarkComparisonBasis = {
    baselineLabel: input.labels.baseline,
    candidateLabel: input.labels.candidate,
    ...(input.baselineSource ? { baselineSource: input.baselineSource } : {}),
    changedDimensions,
    scenario: {
      baseline: input.baseline.dimensions?.scenario ?? '',
      candidate: input.candidate.dimensions?.scenario ?? '',
    },
    support: {
      baseline: input.baseline.state,
      candidate: input.candidate.state,
      comparison: status,
    },
    rankingMethod: preparedAnomaly
      ? 'prepared_anomaly_settlement_damage_delta'
      : 'fixed_event_planning_dps_delta',
  }
  const core = {
    contract: valueBenchmarkComparisonContract,
    evidencePolicy: valueBenchmarkEvidencePolicy,
    status,
    comparable,
    sideEffect: 'read_only' as const,
    changedDimensions,
    attribution,
    comparabilityKey: comparable ? baselineKey : null,
    baseline: input.baseline,
    candidate: input.candidate,
    totalDamageDelta,
    totalDamagePercentDelta,
    planningDpsDelta,
    planningDpsPercentDelta,
    coverage: {
      domain:
        declaredCoverage && coverageDomainsMatch
          ? baselineCoverage!.domain
          : ('not_declared' as const),
      baseline: baselineCoverage ?? null,
      candidate: candidateCoverage ?? null,
      changedIncludedEffectKeys,
      changedExcludedEffectKeys,
      exclusionContextChanged,
      generalConclusion: !comparable
        ? ('unavailable' as const)
        : !declaredCoverage && !incompleteDeclaredCoverage
          ? ('not_declared' as const)
          : generalConclusionRisk
            ? ('limited' as const)
            : ('supported' as const),
      reasons: coverageReasons,
    },
    comparisonBasis,
    verdict,
    candidateDisposition,
    direction:
      comparisonDelta === null
        ? null
        : comparisonDelta > 0
          ? ('higher' as const)
          : comparisonDelta < 0
            ? ('lower' as const)
            : ('equal' as const),
    reasons: comparable
      ? []
      : unique([
          ...reasons,
          ...(crossDomain ? ['单次异常比较与固定事件输出属于不同数值域，不能直接比较。'] : []),
          ...(!numeric && bothSupported ? ['supported 两侧仍缺少有限且非负的数值。'] : []),
        ]),
    boundary:
      '只比较同版本、同主体、同场景、同事件集、同时长、同公式与同运行时的两侧固定事件数值；只有 changedDimensions 可不同。缺失上下文或计算指纹不视为相同；覆盖声明缺失或不完整时不推导整体优劣。显式排除效果或其上下文发生变化时保留数值切片，但不推广为整体优劣。unsupported、unknown、limited、stale 与缺参保持原状，不补成 0%。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
