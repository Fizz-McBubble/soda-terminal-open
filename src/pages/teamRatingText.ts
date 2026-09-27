/** One player-facing label for a concrete trio, regardless of its evidence route. */
export function formatTeamRating(band: string, score?: number | null) {
  return `评级 ${band}${score == null ? '' : ` · 评分 ${score}`}`
}
