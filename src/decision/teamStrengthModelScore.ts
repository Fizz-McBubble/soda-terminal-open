import type { TeamRatingBand } from './teamDecisionAuthority'

export function constrainTeamStrengthScore(
  prediction: number,
  guardrails: { noPrimaryOutput: boolean; severeFieldCompetition: boolean },
) {
  // A trio without a damage role, or three competing field carries, is not an
  // ordinary high-tier formation just because its individual skills are large.
  // Unknown evidence/optional triggers do not receive a strength penalty.
  const ceiling = guardrails.noPrimaryOutput ? 59 : guardrails.severeFieldCompetition ? 69 : 98
  return Math.round(Math.max(40, Math.min(ceiling, prediction)))
}

export function strengthBandForScore(score: number): TeamRatingBand {
  return score >= 90 ? 'S' : score >= 80 ? 'A+' : score >= 70 ? 'A' : 'B'
}

export function strengthBandOrdinal(score: number) {
  return score >= 90 ? 3 : score >= 80 ? 2 : score >= 70 ? 1 : 0
}
