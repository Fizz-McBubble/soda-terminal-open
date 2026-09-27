import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import { currentTeamRatingForSavedPlan } from './teamLoadoutSavedPlanProjection'
import { displayableLocalAnalysis, localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import { formatTeamRating } from './teamRatingText'

export function currentSavedTeamRatingLabel(input: {
  plan: AccountPlanningDraft
  decisionAuthority?: AccountDecisionSnapshot['decisionAuthority']
}) {
  const rating = currentTeamRatingForSavedPlan(input.plan, input.decisionAuthority)
  if (!rating || rating.rating.status !== 'rated') return null
  const score = rating.metaCalibration.recommendationScore
  const analysis = displayableLocalAnalysis(
    rating.metaCalibration.analysis,
    rating.rating.ratingBand,
    rating.rating.confidence,
    rating.mechanicValidity,
  )
  if (analysis) return localAnalysisRatingLabel(analysis, score)
  return formatTeamRating(rating.rating.ratingBand!, score)
}
