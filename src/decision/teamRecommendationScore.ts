import type { TeamFeatureBand, TeamFeatureVector, TeamRatingBand } from './teamDecisionAuthority'

/** A bounded recommendation index, not measured damage or a percent improvement.
 * Coarse reviewed tiers remain authoritative; mechanism fit only refines that tier.
 * Missing evidence is neutral, not a claim that the team is weak. */
export const teamRecommendationScorePolicy = Object.freeze({
  version: 'reviewed-tier-and-mechanism-fit/v1',
  bases: { 'S+': 90, S: 90, 'A+': 80, A: 70, B: 60 },
  factors: {
    mechanic_synergy: 3,
    cycle_stability: 3,
    team_effect_quality: 2,
    field_time_efficiency: 2,
  },
  resolution: 2,
  boundary:
    '主观推荐指数；粗档内只按机制配合细分，不是伤害百分比或独立强度测量。证据置信度不算作实力，邦布、仓库和观测均分不参与。',
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
  const factors = Object.entries(teamRecommendationScorePolicy.factors)
  let weightedFit = 0
  for (const [name, weight] of factors) {
    const dimension = vector.dimensions.find((item) => item.dimension === name)
    weightedFit += weight * fit[dimension?.band ?? 'unknown']
  }
  // Eight points leave space between adjacent coarse tiers. Two-point resolution
  // avoids pretending the input categories distinguish one-point differences.
  return teamRecommendationScorePolicy.bases[band] + 2 * Math.round((weightedFit / 10) * 4)
}
