/** One player-facing label for a concrete trio, regardless of its evidence route. */
export function formatTeamRating(band: string, referenceScore?: number | null) {
  // The retained numeric field is a legacy band anchor, not a second estimate.
  // Old saved/exported values remain readable without implying extra precision.
  void referenceScore
  return `评级 ${band}`
}

/**
 * The BOX page answers whether a team is worth building under the shared
 * generic reference conditions. Scenario-specific standings are compared in
 * their own mode and cycle, after the player selects that context.
 */
export const genericTeamRatingScopeCopy = Object.freeze({
  title: '泛用体系评级参考',
  listDescription: '按成型队伍的泛用评级排列，同核心搭配参考已复核的替代关系；',
})

export const genericTeamRatingBands = Object.freeze([
  ['S', '优先参考的强势体系'],
  ['A+', '强势可选'],
  ['A', '成熟实用'],
  ['B', '有明确取舍的替代'],
] as const)
