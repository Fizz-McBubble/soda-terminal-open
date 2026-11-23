import {
  referenceRatingBands,
  teamReferenceIntervalSchema,
  type GenericReferenceInterval,
} from '../decision/teamReferenceInterval'
import { graduatedTeamRatingBands } from '../decision/graduatedTeamRatingBands'

/** One player-facing label for a concrete trio, regardless of its evidence route. */
export function formatGraduatedTeamScore(
  value: import('../decision/graduatedTeamScoreIndex').GraduatedTeamScore,
) {
  if (value.unconfirmedBuildAgentIds) {
    return graduatedTeamRatingBands.some((band) => band === value.band)
      ? `评级 ${value.band}`
      : '暂无评级'
  }
  return `评级 ${value.band} · ${value.score} 分`
}

export function formatTeamRating(
  band: string,
  referenceScore?: number | null,
  referenceInterval?: GenericReferenceInterval | null,
) {
  // The retained numeric field is a legacy band anchor, not a second estimate.
  // Old saved/exported values remain readable without implying extra precision.
  void referenceScore
  if (!referenceRatingBands.some((value) => value === band)) return '暂无评级'
  if (referenceInterval != null) {
    const interval = teamReferenceIntervalSchema.safeParse(referenceInterval)
    if (!interval.success || interval.data.lower !== band) return '暂无评级'
    const { lower, upper } = interval.data
    return `评级 ${lower === upper ? lower : `${lower}～${upper}`}`
  }
  return `评级 ${band}`
}

/**
 * The BOX page answers whether a team is worth building under the shared
 * generic reference conditions. Scenario-specific standings are compared in
 * their own mode and cycle, after the player selects that context.
 */
export const genericTeamRatingScopeCopy = Object.freeze({
  title: '泛用体系评级参考',
  listDescription: '按成型队伍的泛用体系评级排列，同核心搭配参考已复核的替代关系；',
})

export const genericTeamRatingBands = Object.freeze([
  ['S+', '版本标杆'],
  ['S', '顶级'],
  ['A+', '优秀'],
  ['A', '强势'],
  ['B+', '实用'],
  ['B', '有差距'],
  ['C', '偏弱'],
] as const)
