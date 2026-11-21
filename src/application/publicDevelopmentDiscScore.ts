import type { AccountDiscChoice } from '../optimizer/accountBuildAllocationTypes'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden/types'
import type { ScoringDiscRecordIssue } from '../domain/discScoringInput'

/** A source-bound heuristic for one agent, not damage or a cross-agent quality scale. */
export const developmentDiscScoreVersion = 'development-s-disc-score-r2' as const

export type DevelopmentDiscScore = {
  version: typeof developmentDiscScoreVersion
  basisFingerprint: string
  complete: boolean
  setStatus: 'confirmed' | 'condition_unknown' | 'condition_not_met' | 'unmatched' | 'unavailable'
  totalScore?: number
  setScore?: number
  effectiveLines?: number
  effectiveEnhancements?: number
}

export type DevelopmentDiscEvaluation = DevelopmentDiscScore & {
  choices: AccountDiscChoice[]
  recordIssues: Array<{ id: string; issue: ScoringDiscRecordIssue }>
}

/** One projection for current equipment, candidates and saved physical references. */
export function applyRecordedDevelopmentMetrics(
  status: GoldenWorkbenchData['warehouseAnalysis'],
  evaluation: DevelopmentDiscScore | null | undefined,
) {
  // Never retain metrics from an older candidate payload.
  status.totalScore = undefined
  status.effectiveLines = undefined
  status.effectiveEnhancements = undefined
  if (!isDevelopmentDiscScore(evaluation ?? undefined) || !evaluation?.complete) return
  status.totalScore =
    evaluation.totalScore === undefined ? undefined : Math.round(evaluation.totalScore * 10) / 10
  status.effectiveLines = evaluation.effectiveLines
  status.effectiveEnhancements = evaluation.effectiveEnhancements
}

export function isDevelopmentDiscScore(value: DevelopmentDiscScore | undefined): boolean {
  return Boolean(
    value?.version === developmentDiscScoreVersion &&
    typeof value.basisFingerprint === 'string' &&
    value.basisFingerprint.length > 0 &&
    typeof value.complete === 'boolean' &&
    ['confirmed', 'condition_unknown', 'condition_not_met', 'unmatched', 'unavailable'].includes(
      value.setStatus,
    ) &&
    ['totalScore', 'setScore', 'effectiveLines', 'effectiveEnhancements'].every((key) => {
      const metric = value[key as keyof DevelopmentDiscScore]
      return (
        metric === undefined ||
        (typeof metric === 'number' && Number.isFinite(metric) && metric >= 0)
      )
    }) &&
    (value.setStatus !== 'condition_unknown' ||
      (value.totalScore === undefined && value.setScore === undefined)) &&
    (value.complete
      ? value.setStatus !== 'unavailable' &&
        Number.isInteger(value.effectiveLines) &&
        value.effectiveLines! <= 24 &&
        Number.isInteger(value.effectiveEnhancements) &&
        value.effectiveEnhancements! <= 30 &&
        (value.setStatus === 'condition_unknown' ||
          (value.totalScore !== undefined &&
            value.setScore !== undefined &&
            value.totalScore >= value.setScore &&
            (value.setStatus === 'confirmed' || value.setScore === 0)))
      : value.setStatus === 'unavailable' &&
        value.totalScore === undefined &&
        value.setScore === undefined &&
        value.effectiveLines === undefined &&
        value.effectiveEnhancements === undefined),
  )
}
