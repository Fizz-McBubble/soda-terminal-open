/** One player-facing label for a concrete trio, regardless of its evidence route. */
export function formatTeamRating(band: string, diagnosticScore?: number | null) {
  // The former mechanism-weighted score remains available to diagnostics only.
  void diagnosticScore
  return `评级 ${band}`
}

/**
 * The BOX page answers whether a team is worth building under the shared
 * generic reference conditions. Scenario-specific standings are compared in
 * their own mode and cycle, after the player selects that context.
 */
export const genericTeamRatingScopeCopy = Object.freeze({
  title: '泛用体系评级参考',
  listDescription: '按泛用体系评级与已发布关系排列；',
})
