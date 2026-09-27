import type { AccountDecisionRun } from '../application/calculationQueryContract'
import { currentBangbooDirectory } from '../assault/catalog'
import { defaultEquipmentRankForRarity } from '../decision/teamEquipmentRecommendations'
import { describeBangbooConditions } from '../decision/bangbooConditionPresentation'
import {
  playerConfirmableTargetBangbooIds,
  targetTeamBangbooOptions,
} from '../decision/targetTeamEquipmentParameters'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { displayableLocalAnalysis, localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import { decisionTeamAlternativeVariants, teamRatingSummary } from './teamLoadoutDecisionViewModel'
import { formatTeamRating } from './teamRatingText'
import { resolveTargetTeamFitEntry } from './teamTargetFitEntry'
import {
  teamRoutePresentationContract,
  type TeamRoutePresentation,
} from './publicTeamRoutePresentation'

export function projectPrivateTeamRoute(
  run: AccountDecisionRun,
  candidateId: string,
): TeamRoutePresentation {
  const entry = resolveTargetTeamFitEntry(run.snapshot, candidateId, run.input.warehouse)
  const team = entry.team
  const ratingCandidate =
    entry.authorityCandidate ??
    (team?.bangbooId === null ? (entry.authorityCandidates[0] ?? null) : null)
  const ratingBlocked =
    ratingCandidate?.mechanicValidity === 'invalid' ||
    ratingCandidate?.teamRating.confidence === 'experimental' ||
    ratingCandidate?.teamRating.ratingBand === 'Experimental'
  const ratingAnalysis =
    displayableLocalAnalysis(
      ratingCandidate?.metaCalibration?.analysis,
      ratingCandidate?.teamRating.ratingBand,
      ratingCandidate?.teamRating.confidence,
      ratingCandidate?.mechanicValidity,
    ) ?? null
  const recommendationScore = ratingBlocked
    ? null
    : (ratingCandidate?.metaCalibration?.recommendationScore ?? null)
  const teamRatingLabel = ratingAnalysis
    ? localAnalysisRatingLabel(ratingAnalysis, recommendationScore ?? undefined)
    : !ratingBlocked && ratingCandidate?.teamRating.ratingBand
      ? formatTeamRating(ratingCandidate.teamRating.ratingBand, recommendationScore ?? undefined)
      : teamRatingSummary(undefined)
  const input = entry.playerConfirmableBangbooInput
  const sourceOptions = input ? targetTeamBangbooOptions(input) : []
  const playerConfirmableBangbooOptions = input
    ? [...new Set(playerConfirmableTargetBangbooIds(input))].map((bangbooId) => {
        const directory = currentBangbooDirectory.find((item) => item.id === bangbooId)
        const sourceOption = sourceOptions.find((option) => option.bangbooId === bangbooId)
        return {
          bangbooId,
          name: directory?.name ?? playerFacingBangbooLabel(bangbooId),
          defaultStars:
            sourceOption?.defaultStars ?? defaultEquipmentRankForRarity(directory?.rarity),
          activationStatus: sourceOption?.activationStatus ?? ('active' as const),
          activationDetailsByStars: Object.fromEntries(
            ([1, 2, 3, 4, 5] as const).map((stars) => [
              stars,
              describeBangbooConditions({
                memberIds: input.memberIds,
                bangbooId,
                stars,
              }),
            ]),
          ),
        }
      })
    : []
  return {
    contract: teamRoutePresentationContract,
    runId: run.runId,
    accountId: run.input.warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    candidateId,
    team,
    targetCandidateId: entry.targetCandidateId,
    automaticBangboo: entry.automaticBangboo
      ? { bangbooId: entry.automaticBangboo.bangbooId, name: entry.automaticBangboo.name }
      : null,
    playerConfirmableBangbooOptions,
    ratingAnalysis,
    recommendationScore,
    teamRatingLabel,
    alternativeTeams: team ? decisionTeamAlternativeVariants(run.snapshot, team.id) : [],
  }
}
