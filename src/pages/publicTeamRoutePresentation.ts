import type { ReviewedTeamAnalysis } from '../decision/reviewedTeamAnalysis'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'
import type { PlayerConfirmableBangbooOption } from './PlayerConfirmableBangbooSelector'

export const teamRoutePresentationContract = 'soda-team-route-presentation/v1' as const

export type TeamRoutePresentation = {
  contract: typeof teamRoutePresentationContract
  runId: string
  accountId: string
  inputFingerprint: string
  candidateId: string
  team: DecisionTeamViewModel | null
  targetCandidateId: string | null
  /** Private source-qualified exact membership permits a disc-only Candidate solve. */
  discOnlyCandidate?: true
  automaticBangboo: { bangbooId: string; name: string } | null
  playerConfirmableBangbooOptions: PlayerConfirmableBangbooOption[]
  ratingAnalysis: ReviewedTeamAnalysis | null
  recommendationScore: number | null
  teamRatingLabel: string
  alternativeTeams: DecisionTeamViewModel[]
}

export function acceptTeamRoutePresentation(
  value: TeamRoutePresentation | null | undefined,
  identity: Pick<TeamRoutePresentation, 'runId' | 'accountId' | 'inputFingerprint' | 'candidateId'>,
): TeamRoutePresentation | null {
  if (
    value?.contract !== teamRoutePresentationContract ||
    value.runId !== identity.runId ||
    value.accountId !== identity.accountId ||
    value.inputFingerprint !== identity.inputFingerprint ||
    value.candidateId !== identity.candidateId ||
    (value.team !== null && value.team.id !== identity.candidateId) ||
    !Array.isArray(value.playerConfirmableBangbooOptions) ||
    !Array.isArray(value.alternativeTeams)
  )
    return null
  return value
}
