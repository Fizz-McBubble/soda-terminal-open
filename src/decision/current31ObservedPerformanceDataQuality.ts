import { current31DeadlyAssault313ObservedCalibration } from './current31DeadlyAssault313ObservedCalibration'
import { current31Shiyu313ObservedCalibration } from './current31Shiyu313ObservedCalibration'
import { resolveCurrent31TeamFamily } from './current31TeamCoreAggregation'

export const current31ObservedPerformanceDataQualityContractId =
  'soda-current-3.1-observed-performance-data-quality/v1' as const

type ObservedPerformanceMode = 'shiyu_defense' | 'deadly_assault'

type RawObservedPerformanceRow = {
  observationId: string
  contextId: string
  mode: ObservedPerformanceMode
  memberIds: readonly [string, string, string]
  averageScore: number
  appearanceRatePercent: number
  rank: number
}

function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function percentileRankDescending(value: number, values: readonly number[]) {
  if (values.length <= 1) return 1
  const lowerCount = values.filter((candidate) => candidate < value).length
  const equalCount = values.filter((candidate) => candidate === value).length
  return (lowerCount + Math.max(0, equalCount - 1) / 2) / (values.length - 1)
}

const rows: readonly RawObservedPerformanceRow[] = [
  ...current31Shiyu313ObservedCalibration.observations.map((row) => ({
    observationId: row.observationId,
    contextId: `shiyu:${row.stage}`,
    mode: 'shiyu_defense' as const,
    memberIds: row.memberIds,
    averageScore: row.averageScore,
    appearanceRatePercent: row.appearanceRatePercent,
    rank: row.rank,
  })),
  ...current31DeadlyAssault313ObservedCalibration.observations.map((row) => ({
    observationId: row.observationId,
    contextId: `deadly-assault:${row.stage}`,
    mode: 'deadly_assault' as const,
    memberIds: row.memberIds,
    averageScore: row.averageScore,
    appearanceRatePercent: row.appearanceRatePercent,
    rank: row.rank,
  })),
]

const scoresByContext = new Map<string, number[]>()
for (const row of rows) {
  const scores = scoresByContext.get(row.contextId) ?? []
  scores.push(row.averageScore)
  scoresByContext.set(row.contextId, scores)
}

export const current31ObservedPerformanceDiagnostics = Object.freeze(
  rows.map((row) => {
    const contextScores = scoresByContext.get(row.contextId) ?? []
    const family = resolveCurrent31TeamFamily(row.memberIds)
    return Object.freeze({
      ...row,
      exactAgentFormationKey: formationKey(row.memberIds),
      familyId: family?.familyId ?? null,
      bangbooId: null,
      contextMedianScore: median(contextScores),
      withinContextScorePercentile: percentileRankDescending(row.averageScore, contextScores),
      diagnosticUse: 'contextual_reality_calibration' as const,
      referencePerformanceEligible: false,
      teamStrengthDirectInputEligible: false,
      metaCalibrationDiagnosticEligible: true,
      exclusionReasons: [
        'bangboo_missing',
        'team_specific_sample_size_missing',
        'team_specific_variance_missing',
        'single_publisher_cycle',
        'top_10_selection_bias',
      ] as const,
    })
  }),
)

const observationsByFormation = new Map<string, typeof current31ObservedPerformanceDiagnostics>()
for (const row of current31ObservedPerformanceDiagnostics) {
  const current = observationsByFormation.get(row.exactAgentFormationKey) ?? []
  observationsByFormation.set(row.exactAgentFormationKey, [...current, row])
}

export const current31ObservedFormationRobustnessDiagnostics = Object.freeze(
  [...observationsByFormation.entries()].map(([exactAgentFormationKey, observations]) => {
    const distinctContexts = new Set(observations.map((row) => row.contextId))
    return Object.freeze({
      exactAgentFormationKey,
      memberIds: observations[0].memberIds,
      familyId: observations[0].familyId,
      observationCount: observations.length,
      distinctContextCount: distinctContexts.size,
      medianWithinContextScorePercentile: median(
        observations.map((row) => row.withinContextScorePercentile),
      ),
      crossContextDiagnosticEligible: distinctContexts.size >= 2,
      referencePerformanceEligible: false,
      boundary:
        '该聚合只描述同一精确三人组合在不同已观测场景中的相对稳健性；缺少邦布、队伍样本量和方差，不能升级为 Reference Performance 或 Team Strength。',
    })
  }),
)

const exactFormationCount = observationsByFormation.size
const repeatedExactFormationCount = current31ObservedFormationRobustnessDiagnostics.filter(
  (row) => row.distinctContextCount >= 2,
).length
const familyIds = new Set(
  current31ObservedPerformanceDiagnostics
    .map((row) => row.familyId)
    .filter((familyId): familyId is string => familyId !== null),
)

export const current31ObservedPerformanceDataQuality = Object.freeze({
  contract: current31ObservedPerformanceDataQualityContractId,
  gameVersion: '3.1.3',
  status: 'diagnostic_only' as const,
  grain: {
    raw: 'exact_3_agent_formation_x_context_x_publisher_cycle' as const,
    requiredReferencePerformance: 'exact_3_agent_plus_bangboo_variant_x_baseline' as const,
    familyUse: 'reporting_and_recall_only' as const,
  },
  rowCount: rows.length,
  contextCount: scoresByContext.size,
  exactFormationCount,
  repeatedExactFormationCount,
  recognizedFamilyCount: familyIds.size,
  missingness: {
    bangboo: rows.length,
    teamSpecificSampleSize: rows.length,
    teamSpecificVariance: rows.length,
    sourceIndependentPerformanceLabel: rows.length,
  },
  eligibility: {
    referencePerformanceRowCount: 0,
    teamStrengthDirectInputRowCount: 0,
    metaCalibrationDiagnosticRowCount: rows.length,
  },
  checks: [
    {
      checkId: 'grain-mismatch',
      severity: 'critical',
      result: 'fail',
      finding: '全部观测均缺少邦布，无法对应产品冻结的精确三人 + 邦布 Variant 性能粒度。',
    },
    {
      checkId: 'uncertainty-missing',
      severity: 'critical',
      result: 'fail',
      finding: '全部观测均缺少队伍级样本量与方差，无法建立可比较的置信区间。',
    },
    {
      checkId: 'selection-bias',
      severity: 'high',
      result: 'fail',
      finding: '每个场景只保留发布页 Top 10，缺少完整候选分母，不能推导跨场景全序。',
    },
    {
      checkId: 'publisher-independence',
      severity: 'high',
      result: 'fail',
      finding: 'Shiyu 与 DA 虽为不同玩法，但来自同一发布方与周期，不构成独立性能金标。',
    },
    {
      checkId: 'context-normalization',
      severity: 'info',
      result: 'pass',
      finding:
        '已提供同场景分位数和跨场景中位分位数，只作为现实校准诊断，不进入 Reference Performance 或 Team Strength。',
    },
  ] as const,
  remediation: [
    '补齐每个精确三人 Variant 的来源化邦布参数与事件时序。',
    '取得可复核的同 baseline 输出、队伍级样本量和方差，或建立受控模拟输出。',
    '增加独立发布方或受控实测性能 holdout，并保留完整候选分母。',
  ] as const,
  boundary:
    '当前观测只可形成 Meta Calibration 的场景化诊断和 violation；禁止直接充当 Reference Performance、Team Strength 数值或 Family 共享评级。',
})
