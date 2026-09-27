import type { ReviewedTeamAnalysis } from '../decision/reviewedTeamAnalysis'
import { formatTeamRating } from './teamRatingText'

export function localAnalysisRatingLabel(
  analysis: ReviewedTeamAnalysis,
  recommendationScore?: number | null,
) {
  return formatTeamRating(analysis.band, recommendationScore)
}

export function displayableLocalAnalysis(
  analysis: ReviewedTeamAnalysis | null | undefined,
  ratingBand: string | null | undefined,
  confidence: string | null | undefined,
  mechanicValidity: string | null | undefined,
) {
  return analysis &&
    ratingBand === analysis.band &&
    confidence !== 'experimental' &&
    mechanicValidity !== 'invalid'
    ? analysis
    : null
}
