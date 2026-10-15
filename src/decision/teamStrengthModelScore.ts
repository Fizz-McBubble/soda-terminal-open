import type { TeamRatingBand } from './teamDecisionAuthority'
import { TeamStrengthNumericError } from './teamStrengthNumericError'

export function constrainTeamStrengthScore(
  prediction: number,
  guardrails: { noPrimaryOutput: boolean; severeFieldCompetition: boolean },
) {
  // A role-based field-time prior remains a diagnostic/learned feature. It does
  // not prove a rotation impossible or justify a hard tier ceiling.
  // Unknown evidence/optional triggers do not receive a strength penalty.
  if (!Number.isFinite(prediction))
    throw new TeamStrengthNumericError('score_nonfinite', 'Nonfinite strength prediction')
  const ceiling = guardrails.noPrimaryOutput ? 59 : 98
  return Math.round(Math.max(40, Math.min(ceiling, prediction)))
}

export function strengthBandForScore(score: number): TeamRatingBand {
  if (!Number.isFinite(score))
    throw new TeamStrengthNumericError('score_nonfinite', 'Nonfinite strength score')
  return score >= 90 ? 'S' : score >= 80 ? 'A+' : score >= 70 ? 'A' : 'B'
}

export function strengthBandOrdinal(score: number) {
  if (!Number.isFinite(score))
    throw new TeamStrengthNumericError('score_nonfinite', 'Nonfinite strength score')
  return score >= 90 ? 3 : score >= 80 ? 2 : score >= 70 ? 1 : 0
}
