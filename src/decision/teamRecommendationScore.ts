import type { TeamFeatureBand, TeamFeatureVector, TeamRatingBand } from './teamDecisionAuthority'
import { teamRecommendationScorePolicy } from '../application/publicTeamReferenceScore'

/** Shared ordinal reference scale. A tier without a reviewed within-tier
 * preference deliberately receives the same score as its peers. Confidence,
 * role counts and unclosed cycle assumptions cannot manufacture extra points. */
export { teamRecommendationScorePolicy } from '../application/publicTeamReferenceScore'

/** Retained for existing mechanism diagnostics; never used by the reference
 * score, admission, or ordering. */
export const teamMechanismDiagnosticScorePolicy = Object.freeze({
  version: 'diagnostic-reviewed-tier-and-mechanism-fit/v2',
  use: 'diagnostic_only' as const,
  bases: { 'S+': 90, S: 90, 'A+': 80, A: 70, B: 60 },
  factors: {
    mechanic_synergy: 3,
    cycle_stability: 3,
    team_effect_quality: 2,
    field_time_efficiency: 2,
  },
  resolution: 2,
  boundary:
    '仅用于诊断机制差异的参考指数，不参与默认准入、同档顺序或玩家界面强度；不是伤害百分比或独立强度测量。',
})

const fit: Record<TeamFeatureBand, number> = {
  excellent: 1,
  good: 2 / 3,
  mixed: 1 / 3,
  weak: 0,
  unknown: 0.5,
}

export function teamRecommendationScore(
  band: TeamRatingBand | null,
  vector: Pick<TeamFeatureVector, 'dimensions' | 'hardPrunes'>,
): number | null {
  if (!band || band === 'Experimental' || vector.hardPrunes.length) return null
  return teamRecommendationScorePolicy.anchors[band]
}

export function teamMechanismDiagnosticScore(
  band: TeamRatingBand | null,
  vector: Pick<TeamFeatureVector, 'dimensions' | 'hardPrunes'>,
): number | null {
  if (!band || band === 'Experimental' || vector.hardPrunes.length) return null
  const factors = Object.entries(teamMechanismDiagnosticScorePolicy.factors)
  let weightedFit = 0
  for (const [name, weight] of factors) {
    const dimension = vector.dimensions.find((item) => item.dimension === name)
    weightedFit += weight * fit[dimension?.band ?? 'unknown']
  }
  // Eight points leave space between adjacent coarse tiers. Two-point resolution
  // avoids pretending the input categories distinguish one-point differences.
  return teamMechanismDiagnosticScorePolicy.bases[band] + 2 * Math.round((weightedFit / 10) * 4)
}
