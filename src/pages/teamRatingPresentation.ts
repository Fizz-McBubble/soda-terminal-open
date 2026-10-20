import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { displayableLocalAnalysis, localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import { formatTeamRating, genericTeamRatingScopeCopy } from './teamRatingText'

export function referenceSummary(item: TeamLoadoutOverviewItem) {
  if (item.mechanicValidity === 'invalid') return '暂无评级'
  const analysis = displayableLocalAnalysis(
    item.ratingAnalysis,
    item.teamRatingBand,
    item.confidence,
    item.mechanicValidity,
  )
  if (analysis) return localAnalysisRatingLabel(analysis, item.recommendationScore)
  if (item.teamRatingBand === 'Experimental' || item.confidence === 'experimental') {
    return item.sourceConfirmed ? '暂无评级' : '待验证'
  }
  if (!item.teamRatingBand) return '暂无评级'
  return formatTeamRating(item.teamRatingBand, item.recommendationScore)
}

export function ratingLabel(item: TeamLoadoutOverviewItem) {
  const analysis = displayableLocalAnalysis(
    item.ratingAnalysis,
    item.teamRatingBand,
    item.confidence,
    item.mechanicValidity,
  )
  if (analysis) return localAnalysisRatingLabel(analysis, item.recommendationScore)
  const rating = referenceSummary(item)
  return rating
}

export function ratingTitle(item: TeamLoadoutOverviewItem) {
  if (
    item.mechanicValidity === 'invalid' ||
    item.teamRatingBand === 'Experimental' ||
    item.confidence === 'experimental'
  )
    return undefined
  if (
    displayableLocalAnalysis(
      item.ratingAnalysis,
      item.teamRatingBand,
      item.confidence,
      item.mechanicValidity,
    )
  )
    return genericTeamRatingScopeCopy.title
  if (item.inferredStrength) return '泛用体系评级来自当前证据粗档；同档没有已发布关系时不排列强弱'
  if (item.teamRatingBand) return genericTeamRatingScopeCopy.title
  return undefined
}

export function teamRatingLabelTitle() {
  return genericTeamRatingScopeCopy.title
}

export function familyRatingLabel(
  _family: TeamLoadoutOverviewFamily,
  item: TeamLoadoutOverviewItem,
) {
  return ratingLabel(item)
}
