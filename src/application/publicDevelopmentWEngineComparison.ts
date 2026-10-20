import type { ValueBenchmarkState } from '../calculation/valueBenchmarkComparison'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmark'

export type DevelopmentWEngineComparisonSelection = {
  candidateRank: number
  inputFingerprint: string
  loadoutFingerprint: string
  progressionMode?: 'account_owned_if_available' | 'theoretical_benchmark_only'
}

/** Display/selection facts only. Private event contexts and formula expressions
 * never cross this boundary. Older captured sessions may only carry id/name. */
export type DevelopmentWEngineOption = {
  engineId: string
  name: string
  optionKey?: string
  label?: string
  owned?: boolean
  isCurrent?: boolean
  progression?: 'current' | 'owned' | 'theoretical' | 'unknown'
  level?: number | null
  ascension?: number | null
  refinement?: number | null
  passiveCompatibility?: 'matched' | 'mismatched' | 'static_only'
  parameters?: NonNullable<DevelopmentComparisonParameters['wEngine']>
}

export type DevelopmentWEngineComparisonDto = {
  contract: 'soda-development-w-engine-options/v1'
  candidateRank: number
  inputFingerprint: string
  loadoutFingerprint: string
  fingerprint: string
  currentEngineRecorded: boolean
  entries: Array<
    DevelopmentWEngineOption & {
      status: ValueBenchmarkState
      passiveState: 'active' | 'unobserved_conditions' | 'inactive_mismatch' | 'static_only'
      partialOrderTier:
        | 'direct_comparable'
        | 'theoretical_comparable'
        | 'limited_coverage'
        | 'passive_inactive'
        | 'unsupported'
      metric: 'fixed_event_planning_dps' | 'prepared_anomaly_damage' | null
      value: number | null
      delta: number | null
      percentDelta: number | null
      comparableWithCurrent: boolean
      comparisonGroupId: string | null
      rankWithinGroup: number | null
      reasons: string[]
    }
  >
}

export function publicDevelopmentWEngineOption(
  option: DevelopmentWEngineOption,
): DevelopmentWEngineOption {
  return {
    engineId: option.engineId,
    name: option.name,
    ...(option.optionKey ? { optionKey: option.optionKey } : {}),
    ...(option.label ? { label: option.label } : {}),
    ...(option.owned !== undefined ? { owned: option.owned } : {}),
    ...(option.isCurrent !== undefined ? { isCurrent: option.isCurrent } : {}),
    ...(option.progression ? { progression: option.progression } : {}),
    ...(option.level !== undefined ? { level: option.level } : {}),
    ...(option.ascension !== undefined ? { ascension: option.ascension } : {}),
    ...(option.refinement !== undefined ? { refinement: option.refinement } : {}),
    ...(option.passiveCompatibility ? { passiveCompatibility: option.passiveCompatibility } : {}),
    ...(option.parameters
      ? {
          parameters: {
            engineId: option.parameters.engineId,
            level: option.parameters.level,
            refinement: option.parameters.refinement,
            ...(option.parameters.ascension === undefined
              ? {}
              : { ascension: option.parameters.ascension }),
          },
        }
      : {}),
  }
}

export function publicDevelopmentWEngineComparison(
  value: DevelopmentWEngineComparisonDto | undefined,
): DevelopmentWEngineComparisonDto | undefined {
  if (!value) return undefined
  return {
    contract: value.contract,
    candidateRank: value.candidateRank,
    inputFingerprint: value.inputFingerprint,
    loadoutFingerprint: value.loadoutFingerprint,
    fingerprint: value.fingerprint,
    currentEngineRecorded: value.currentEngineRecorded,
    entries: value.entries.map((row) => ({
      ...publicDevelopmentWEngineOption(row),
      status: row.status,
      passiveState: row.passiveState,
      partialOrderTier: row.partialOrderTier,
      metric: row.metric,
      value: row.value,
      delta: row.delta,
      percentDelta: row.percentDelta,
      comparableWithCurrent: row.comparableWithCurrent,
      comparisonGroupId: row.comparisonGroupId,
      rankWithinGroup: row.rankWithinGroup,
      reasons: [...row.reasons],
    })),
  }
}
