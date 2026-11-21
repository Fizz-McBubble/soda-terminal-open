import {
  lookupGraduatedTeamScore,
  type GraduatedTeamScore,
  type GraduatedScoreKey,
} from './graduatedTeamScoreIndex'
import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
import { genericPlayClassificationBasis } from './teamGenericPlayBinding'
import { projectGenericRankingDecision } from './teamGenericRankingProjection'
import type { CurrentTeamSystemRanking } from './teamSystemRankingContract'
import type { FiniteTeamPlay } from '../domain/finiteTeamPlayContract'

export type CurrentPlayRanking = CurrentTeamSystemRanking & { graduatedScore?: GraduatedTeamScore }

// Downstream of the admission artifact: scored output must not change the hash
// of the very catalog to which it is bound. Only call with lookupForPlay's decision.
export function attachGraduatedPlayScore(
  legacy: CurrentTeamSystemRanking | null,
  memberIds: readonly string[],
  play: FiniteTeamPlay | null | undefined,
  version: string,
  lookup: typeof lookupGraduatedTeamScore = lookupGraduatedTeamScore,
): CurrentPlayRanking | null {
  if (!play || legacy?.genericOrder?.status !== 'recommended') return legacy
  const graduatedScore = lookup({
    catalogHash: legacy.contentHash,
    gameVersion: version,
    memberIds,
    playId: canonicalTeamPlayIdentity(play),
  })
  if (!graduatedScore) return legacy
  return {
    ...projectGenericRankingDecision({
      contentHash: legacy.contentHash,
      system: play.outputSystem,
      classificationBasis: genericPlayClassificationBasis(play.outputSystem),
      decision: {
        key: [...memberIds].sort().join('|'),
        status: 'recommended',
        band: graduatedScore.band,
        confidence: graduatedScore.unconfirmedBuildAgentIds ? 'low' : 'high',
        authority: graduatedScore.unconfirmedBuildAgentIds ? 'verified_fixed_build'
          : graduatedScore.ratingBasis === 'standardized_theory'
          ? 'standardized_theory_graduation'
          : 'independently_calibrated_graduation',
        displayOrder: legacy.genericOrder.displayOrder,
        reason: null,
        referenceInterval: null,
      },
    }),
    graduatedScore,
  }
}

export function lookupUnambiguousGraduatedScore(
  catalog: readonly { playId: string }[],
  selection: Omit<GraduatedScoreKey, 'playId'>,
  lookup = lookupGraduatedTeamScore,
) {
  if (catalog.length !== 1) return null
  return lookup({ ...selection, playId: catalog[0]!.playId })
}
