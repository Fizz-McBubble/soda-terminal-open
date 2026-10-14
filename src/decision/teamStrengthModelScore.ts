import type { TeamRatingBand } from './teamDecisionAuthority'

export function constrainTeamStrengthScore(
  prediction: number,
  guardrails: { noPrimaryOutput: boolean; severeFieldCompetition: boolean },
) {
  // A role-based field-time prior remains a diagnostic/learned feature. It does
  // not prove a rotation impossible or justify a hard tier ceiling.
  // Unknown evidence/optional triggers do not receive a strength penalty.
  const ceiling = guardrails.noPrimaryOutput ? 59 : 98
  return Math.round(Math.max(40, Math.min(ceiling, prediction)))
}

export function strengthBandForScore(score: number): TeamRatingBand {
  return score >= 90 ? 'S' : score >= 80 ? 'A+' : score >= 70 ? 'A' : 'B'
}

export function strengthBandOrdinal(score: number) {
  return score >= 90 ? 3 : score >= 80 ? 2 : score >= 70 ? 1 : 0
}
