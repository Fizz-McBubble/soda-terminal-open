import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { displayableLocalAnalysis, localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import { formatTeamRating } from './teamRatingText'

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
    return '配队参考评分，不代表实战伤害'
  if (item.inferredStrength)
    return '配队参考评分；相近分数不代表实战强弱，多种玩法仍需结合队伍条件判断'
  if (item.recommendationScore != null) return '队伍强度参考'
  return undefined
}

export function teamRatingLabelTitle() {
  return '队伍强度参考'
}

export function familyRatingLabel(
  _family: TeamLoadoutOverviewFamily,
  item: TeamLoadoutOverviewItem,
) {
  return ratingLabel(item)
}
