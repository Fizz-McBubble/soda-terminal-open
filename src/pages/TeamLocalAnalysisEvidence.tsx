import type { ReviewedTeamAnalysis } from '../decision/reviewedTeamAnalysis'
import { localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'

/** Compact player-facing marker. Detailed provenance remains in Decision Authority. */
export function TeamLocalAnalysisEvidence({
  analysis,
  recommendationScore,
}: {
  analysis: ReviewedTeamAnalysis
  recommendationScore?: number | null
}) {
  return <span title="队伍强度参考">{localAnalysisRatingLabel(analysis, recommendationScore)}</span>
}
