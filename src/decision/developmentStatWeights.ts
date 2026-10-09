import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc, StatKey } from '../domain/schemas'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { standardSubstatProbes } from '../calculation/standardSubstatProbe'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import { driveDiscData } from '../data/gameData'
import { stableContentHash } from '../gameDataPacks/types'
import {
  absoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from '../warehouse/absoluteDiscRetentionCatalog'
import { history } from '../warehouse/absoluteDiscRetentionScoring'
import {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmark'

export const developmentStatWeightVersion = 'standard-roll-full-projection-declared-objective-r2'
export type DevelopmentStatWeightRow = {
  stat: StatKey
  step: number
  status: 'supported' | 'limited' | 'unsupported'
  damageDelta: number | null
  /** Ratio, not a percentage-point value. Null when the baseline is zero. */
  relativeGain: number | null
  normalizedWeight: number | null
  reasons: string[]
}
export type DevelopmentStatWeights = {
  version: string
  status: 'supported' | 'limited' | 'unsupported' | 'stale'
  objective: 'personal_fixed_event_damage' | 'prepared_anomaly_settlement'
  baseline: ValueBenchmarkSide
  rows: DevelopmentStatWeightRow[]
  fingerprint: string
  reasons: string[]
  boundary: string
}
export type DevelopmentStatWeightInput = {
  warehouse: CoreWarehouse
  agentId: string
  discs: readonly DriveDisc[]
  stale: boolean
  parameters?: DevelopmentComparisonParameters
}

/** Marginals are local search hints. Actual swaps must pass full-model comparison again. */
export function evaluateDevelopmentStatWeights(
  input: DevelopmentStatWeightInput,
): DevelopmentStatWeights {
  const baseline = evaluateDevelopmentValueBenchmarkSide(input)
  const probes = standardSubstatProbes()
  const reasons: string[] = []
  const specialty = getCurrentAgentEventContract(input.agentId)?.identity.specialty
  const preparedAnomaly = baseline.coverage?.domain === 'prepared_anomaly_settlement'
  if (!preparedAnomaly && !['attack', 'armorer', 'rupture'].includes(specialty ?? ''))
    reasons.push('当前目标尚未提供异常、击破时序或团队功能的词条收益模型。')
  if (input.stale || baseline.state !== 'supported') reasons.push(...baseline.reasons)
  if (!probes.length) reasons.push('缺少 S 级标准副词条增量。')
  try {
    for (const disc of input.discs)
      history(toAbsoluteRetentionDisc(disc), absoluteDiscRetentionCatalog.rules)
  } catch {
    reasons.push('盘面或强化记录不合法，不能生成词条收益。')
  }
  const rows: DevelopmentStatWeightRow[] = probes.map((probe) => {
    const unavailable = (issues: string[]): DevelopmentStatWeightRow => ({
      stat: probe.stat,
      step: probe.value,
      status: 'unsupported',
      damageDelta: null,
      relativeGain: null,
      normalizedWeight: null,
      reasons: issues,
    })
    if (reasons.length || baseline.state !== 'supported') return unavailable(reasons)
    // The fixed-event model does not measure anomaly settlement or team support.
    if (probe.stat === 'anomaly_proficiency' && !preparedAnomaly)
      return unavailable(['此固定事件目标不覆盖异常结算或异常支援，不能把未建模收益当作零。'])
    if (
      preparedAnomaly &&
      !['atk_percent', 'atk_flat', 'anomaly_proficiency', 'pen'].includes(probe.stat)
    )
      return unavailable(['单次异常结算未覆盖此词条的直伤、循环或其他功能收益。'])
    const candidate = evaluateDevelopmentValueBenchmarkSide({ ...input, statProbe: probe })
    const comparison = compareValueBenchmarkSides({
      baseline,
      candidate,
      changedDimensions: ['disc_loadout'],
      independentCounterfactual: true,
      labels: { baseline: '当前六盘', candidate: '虚拟增加一档 S 级副词条' },
    })
    if (!comparison.comparable || comparison.totalDamageDelta === null)
      return unavailable([...candidate.reasons, ...comparison.reasons])
    const relative =
      baseline.totalDamage! > 0 ? comparison.totalDamageDelta / baseline.totalDamage! : null
    return {
      stat: probe.stat,
      step: probe.value,
      status: comparison.coverage.generalConclusion === 'supported' ? 'supported' : 'limited',
      damageDelta: comparison.totalDamageDelta,
      relativeGain: relative !== null && Number.isFinite(relative) ? relative : null,
      normalizedWeight: null,
      reasons: comparison.coverage.reasons,
    }
  })
  const largest = Math.max(0, ...rows.map((row) => row.damageDelta ?? 0))
  for (const row of rows)
    if (row.damageDelta !== null && largest > 0) row.normalizedWeight = row.damageDelta / largest
  const supported = rows.filter((row) => row.status !== 'unsupported')
  const status: DevelopmentStatWeights['status'] =
    input.stale || baseline.state === 'stale'
      ? 'stale'
      : !supported.length
        ? 'unsupported'
        : supported.some((row) => row.status === 'limited')
          ? 'limited'
          : 'supported'
  const result = {
    version: developmentStatWeightVersion,
    status,
    objective: preparedAnomaly
      ? ('prepared_anomaly_settlement' as const)
      : ('personal_fixed_event_damage' as const),
    baseline,
    rows,
    reasons,
    boundary:
      '仅表示当前角色、音擎、六盘和声明比较目标中增加一档 S 级副词条的收益；异常目标只是一回准备态结算。归一权重只用于探索，换盘仍完整重算。未建模效果保持未覆盖；零值不表示无其他用途，不用于仓库品质或清理判定。',
  }
  return {
    ...result,
    fingerprint: stableContentHash({
      ...result,
      parameters: input.parameters,
      gameDataVersion: driveDiscData?.dataVersion,
      statRules: probes,
    }),
  }
}
