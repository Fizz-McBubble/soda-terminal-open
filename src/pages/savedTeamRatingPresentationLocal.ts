import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import {
  currentAuthorityForSavedPlan,
  currentPlayForSavedPlan,
  currentTeamRatingForSavedPlan,
} from './teamLoadoutSavedPlanProjection'
import { lookupGraduatedScoreForSelection } from '../decision/teamGenericRanking'
import { hasGraduatedTeamScores } from '../decision/graduatedTeamScoreIndex'
import { displayableLocalAnalysis, localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import { formatGraduatedTeamScore, formatTeamRating } from './teamRatingText'

export function currentSavedTeamRatingLabel(input: {
  plan: AccountPlanningDraft
  decisionAuthority?: AccountDecisionSnapshot['decisionAuthority']
}) {
  const members = input.plan.selection.agentIds
  if (
    hasGraduatedTeamScores &&
    members.length === 3 &&
    new Set(members).size === 3 &&
    !input.plan.teamPortfolioSnapshot
  ) {
    const authority =
      input.decisionAuthority && currentAuthorityForSavedPlan(input.plan, input.decisionAuthority)
    if (authority?.mechanicValidity === 'invalid') return null
    const play = currentPlayForSavedPlan(input.plan, authority?.playDirection)
    if (!play && input.plan.solutionContext?.ratedTeamPlayId !== undefined) return null
    const graduated = lookupGraduatedScoreForSelection(members, play)
    if (graduated) return formatGraduatedTeamScore(graduated)
  }
  const rating = currentTeamRatingForSavedPlan(input.plan, input.decisionAuthority)
  if (!rating || rating.rating.status !== 'rated') return null
  const score = rating.metaCalibration.recommendationScore
  if (rating.rating.referenceInterval)
    return formatTeamRating(rating.rating.ratingBand, score, rating.rating.referenceInterval)
  const analysis = displayableLocalAnalysis(
    rating.metaCalibration.analysis,
    rating.rating.ratingBand,
    rating.rating.confidence,
    rating.mechanicValidity,
  )
  if (analysis) return localAnalysisRatingLabel(analysis, score)
  return formatTeamRating(rating.rating.ratingBand!, score)
}
