import type { ReviewedTeamAnalysis } from '../decision/reviewedTeamAnalysis'
import { localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import { genericTeamRatingScopeCopy } from './teamRatingText'

/** Compact player-facing marker. Detailed provenance remains in Decision Authority. */
export function TeamLocalAnalysisEvidence({
  analysis,
  recommendationScore,
}: {
  analysis: ReviewedTeamAnalysis
  recommendationScore?: number | null
}) {
  return (
    <span title={genericTeamRatingScopeCopy.title}>
      {localAnalysisRatingLabel(analysis, recommendationScore)}
    </span>
  )
}
