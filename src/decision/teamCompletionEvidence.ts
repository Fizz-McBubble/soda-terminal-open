import type { OfflineTeamDetails } from './current31TeamIntrinsicIndex'

export function isReviewedCompletionEvidence(
  rating: Pick<
    OfflineTeamDetails,
    'rating' | 'mechanicValidity' | 'mainstreamRecognition' | 'metaCalibration'
  > | null,
) {
  return Boolean(
    rating &&
    rating.mechanicValidity !== 'invalid' &&
    rating.rating.status === 'rated' &&
    ['S+', 'S', 'A+'].includes(rating.rating.ratingBand) &&
    rating.metaCalibration.status === 'aligned' &&
    rating.metaCalibration.evidenceStatus !== 'conflict' &&
    rating.metaCalibration.authority !== 'model_inference' &&
    rating.metaCalibration.evidenceRefs.length &&
    rating.mainstreamRecognition.status === 'confirmed' &&
    (!rating.mainstreamRecognition.historicalReferenceOnly ||
      rating.metaCalibration.referenceContinuity),
  )
}
