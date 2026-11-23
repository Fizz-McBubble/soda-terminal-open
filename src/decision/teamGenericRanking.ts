import raw from '../gameDataPacks/generated/generic-team-ranking.v1.json'
import { createGenericTeamRankingReader } from './teamGenericRankingReader'
import {
  attachGraduatedPlayScore,
  lookupUnambiguousGraduatedScore,
  type CurrentPlayRanking,
} from './teamGraduatedRankingProjection'
import { hasGraduatedTeamScores } from './graduatedTeamScoreIndex'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import type { GenericRankingIntrinsicBinding } from './teamGenericPlayBinding'
import { readTeamStartupIndex } from './teamStartupIndexEnvelope'
export { createGenericTeamRankingReader } from './teamGenericRankingReader'
let reader = createGenericTeamRankingReader(raw)
export const currentGenericTeamRankingStatus = reader.status
export const lookupCurrentGenericTeamRanking: typeof reader.lookup = (...args) =>
  reader.lookup(...args)
export const lookupCurrentGenericTeamRankingEvidence: typeof reader.lookupEvidence = (...args) =>
  reader.lookupEvidence(...args)
export const lookupCurrentTeamMechanismCatalog: typeof reader.lookupCatalog = (...args) =>
  reader.lookupCatalog(...args)

export function replaceGenericRankingIndex(
  input: unknown,
  intrinsic: GenericRankingIntrinsicBinding,
) {
  if (readTeamStartupIndex(input).keys)
    throw new Error('Expected the complete generic ranking index.')
  const next = createGenericTeamRankingReader(input, intrinsic)
  if (
    next.status.status !== 'ready' ||
    next.status.contentHash !== currentGenericTeamRankingStatus.contentHash
  )
    throw new Error(
      next.status.reason ?? 'Full generic index does not match the BOX startup version.',
    )
  return () => {
    reader = next
  }
}

export function lookupCurrentGenericTeamRankingForPlay(
  ...args: Parameters<typeof reader.lookupForPlay>
): CurrentPlayRanking | null {
  const ranking = reader.lookupForPlay(...args)
  return hasGraduatedTeamScores
    ? attachGraduatedPlayScore(ranking, args[0], args[1], currentVersionProjection.gameVersion)
    : ranking
}

// Legacy saved teams can omit their play. An exact trio identifies it only
// when the current catalog admits a single variant.
export function lookupGraduatedScoreForSelection(
  memberIds: readonly string[],
  play: Parameters<typeof reader.lookupForPlay>[1],
) {
  if (!hasGraduatedTeamScores || !reader.status.contentHash) return null
  if (play) return lookupCurrentGenericTeamRankingForPlay(memberIds, play)?.graduatedScore ?? null
  return lookupUnambiguousGraduatedScore(reader.lookupCatalog(memberIds), {
    catalogHash: reader.status.contentHash,
    gameVersion: currentVersionProjection.gameVersion,
    memberIds,
  })
}
