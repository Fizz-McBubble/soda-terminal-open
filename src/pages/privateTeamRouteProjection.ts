import { admittedTeamBangbooOptions } from '../decision/admittedTeamBangbooOptions'
import type { AccountDecisionRun } from '../application/calculationQueryContract'
import { currentBangbooDirectory } from '../assault/catalog'
import { defaultEquipmentRankForRarity } from '../decision/teamEquipmentRecommendations'
import { describeBangbooConditions } from '../decision/bangbooConditionPresentation'
import { playerConfirmableTargetBangbooIds } from '../decision/targetTeamEquipmentParameters'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { displayableLocalAnalysis, localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import { decisionTeamAlternativeVariants, teamRatingSummary } from './teamLoadoutDecisionViewModel'
import { formatGraduatedTeamScore, formatTeamRating } from './teamRatingText'
import { lookupGraduatedScoreForSelection } from '../decision/teamGenericRanking'
import { hasGraduatedTeamScores } from '../decision/graduatedTeamScoreIndex'
import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
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
  const graduated =
    hasGraduatedTeamScores && team && ratingCandidate?.mechanicValidity !== 'invalid'
      ? lookupGraduatedScoreForSelection(team.agentIds, entry.authorityCandidate?.playDirection)
      : null
  const ratedPlay = graduated ? entry.authorityCandidate?.playDirection : null
  const ratingAnalysis = graduated
    ? null
    : (displayableLocalAnalysis(
        ratingCandidate?.metaCalibration?.analysis,
        ratingCandidate?.teamRating.ratingBand,
        ratingCandidate?.teamRating.confidence,
        ratingCandidate?.mechanicValidity,
      ) ?? null)
  const recommendationScore =
    ratingBlocked || graduated
      ? null
      : (ratingCandidate?.metaCalibration?.recommendationScore ?? null)
  const teamRatingLabel = graduated
    ? formatGraduatedTeamScore(graduated)
    : ratingAnalysis
      ? localAnalysisRatingLabel(ratingAnalysis, recommendationScore ?? undefined)
      : !ratingBlocked && ratingCandidate?.teamRating.ratingBand
        ? formatTeamRating(ratingCandidate.teamRating.ratingBand, recommendationScore ?? undefined)
        : teamRatingSummary(undefined)
  const input = entry.playerConfirmableBangbooInput
  const sourceOptions = input ? admittedTeamBangbooOptions(input) : []
  const playerConfirmableBangbooOptions = input
    ? [...new Set(playerConfirmableTargetBangbooIds(input))].map((bangbooId) => {
        const directory = currentBangbooDirectory.find((item) => item.id === bangbooId)
        const sourceOption = sourceOptions.find((option) => option.bangbooId === bangbooId)
        const defaultStars =
          sourceOption?.defaultStars ?? defaultEquipmentRankForRarity(directory?.rarity)
        const activationDetailsByStars = Object.fromEntries(
          ([1, 2, 3, 4, 5] as const).map((stars) => [
            stars,
            describeBangbooConditions({ memberIds: input.memberIds, bangbooId, stars }),
          ]),
        )
        return {
          bangbooId,
          name: directory?.name ?? playerFacingBangbooLabel(bangbooId),
          defaultStars,
          activationStatus: activationDetailsByStars[defaultStars]!.activationStatus,
          activationDetailsByStars,
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
    ...(entry.authorityCandidate?.authorComparisonMembership &&
    !entry.authorityCandidate.authorComparisonMembership.independentDefaultAdmission
      ? { discOnlyCandidate: true as const }
      : {}),
    automaticBangboo: entry.automaticBangboo
      ? { bangbooId: entry.automaticBangboo.bangbooId, name: entry.automaticBangboo.name }
      : null,
    playerConfirmableBangbooOptions,
    ratingAnalysis,
    recommendationScore,
    teamRatingLabel,
    ...(ratedPlay ? { ratedTeamPlayId: canonicalTeamPlayIdentity(ratedPlay) } : {}),
    alternativeTeams: team ? decisionTeamAlternativeVariants(run.snapshot, team.id) : [],
    mechanicDiagnostic: ratingCandidate?.metaCalibration.inference ?? null,
  }
}
