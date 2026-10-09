import type {
  DevelopmentCandidateAlternativesQuery,
  DevelopmentCandidateAlternativesQueryResult,
} from '../application/calculationQueryContract'
import type { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'

/** Rebind identical physical plans first. Parameter scenarios may generate a new
 * six-disc plan, so retain an unmatched scenario in an unclaimed rank for a new solve. */
export function rebindComparisonParameters(
  previous: NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>,
  result: DevelopmentCandidateAlternativesQueryResult,
) {
  if (previous.accountId !== result.accountId || previous.agentId !== result.agentId) return {}
  const rebound: {
    -readonly [Rank in keyof NonNullable<
      DevelopmentCandidateAlternativesQuery['candidateParametersByRank']
    >]: NonNullable<DevelopmentCandidateAlternativesQuery['candidateParametersByRank']>[Rank]
  } = {}
  const unmatched: Array<
    [
      number,
      NonNullable<DevelopmentCandidateAlternativesQuery['candidateParametersByRank']>[number],
    ]
  > = []
  for (const [oldRank, selection] of Object.entries(previous.candidateParametersByRank ?? {})) {
    const oldDiscs = previous.candidates[Number(oldRank) - 1]?.loadouts[0]?.discs
    const previousIds = oldDiscs
      ? JSON.stringify(oldDiscs.map((choice) => choice.disc.id).toSorted())
      : null
    if (!previousIds) continue
    const nextRank =
      result.candidates.findIndex(
        (plan, index) =>
          !rebound[index + 1] &&
          JSON.stringify(plan.loadouts[0]?.discs.map((choice) => choice.disc.id).toSorted()) ===
            previousIds,
      ) + 1
    if (nextRank) rebound[nextRank] = selection
    else unmatched.push([Number(oldRank), selection])
  }
  for (const [oldRank, selection] of unmatched) {
    const rank =
      oldRank <= result.candidates.length && !rebound[oldRank]
        ? oldRank
        : result.candidates.findIndex((_, index) => !rebound[index + 1]) + 1
    if (rank) rebound[rank] = selection
  }
  return rebound
}
