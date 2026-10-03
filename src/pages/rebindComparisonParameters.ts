import type {
  DevelopmentCandidateAlternativesQuery,
  DevelopmentCandidateAlternativesQueryResult,
} from '../application/calculationQueryContract'
import type { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'

/** Preserve a comparison choice only when reanalysis returns the same six physical discs. */
export function rebindComparisonParameters(
  previous: NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>,
  result: DevelopmentCandidateAlternativesQueryResult,
) {
  const rebound: {
    -readonly [Rank in keyof NonNullable<
      DevelopmentCandidateAlternativesQuery['candidateParametersByRank']
    >]: NonNullable<DevelopmentCandidateAlternativesQuery['candidateParametersByRank']>[Rank]
  } = {}
  for (const [oldRank, selection] of Object.entries(previous.candidateParametersByRank ?? {})) {
    const previousIds = previous.candidates[Number(oldRank) - 1]?.loadouts[0]?.discs
      .map((choice) => choice.disc.id)
      .toSorted()
      .join('|')
    if (!previousIds) continue
    const nextRank =
      result.candidates.findIndex(
        (plan) =>
          plan.loadouts[0]?.discs
            .map((choice) => choice.disc.id)
            .toSorted()
            .join('|') === previousIds,
      ) + 1
    if (nextRank) rebound[nextRank] = selection
  }
  return rebound
}
