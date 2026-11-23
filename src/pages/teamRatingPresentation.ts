import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { displayableLocalAnalysis, localAnalysisRatingLabel } from './teamLocalAnalysisPresentation'
import {
  formatGraduatedTeamScore,
  formatTeamRating,
  genericTeamRatingScopeCopy,
} from './teamRatingText'

export function visibleGraduatedScore(item: TeamLoadoutOverviewItem) {
  const ranking = item.teamSystemRanking
  const score = ranking?.graduatedScore
  return score &&
    ranking.status === 'ranked' &&
    !item.historicalReferenceOnly &&
    item.mechanicValidity !== 'invalid' &&
    ranking.genericOrder?.sourceAuthority === (score.unconfirmedBuildAgentIds ? 'verified_fixed_build' : score.ratingBasis === 'standardized_theory'
      ? 'standardized_theory_graduation'
      : 'independently_calibrated_graduation') &&
    ranking.genericOrder.band === score.band &&
    item.teamRatingBand === score.band &&
    Number.isSafeInteger(score.score) &&
    score.score >= 0
    ? score
    : null
}

export function referenceSummary(item: TeamLoadoutOverviewItem) {
  if (item.mechanicValidity === 'invalid' || item.historicalReferenceOnly) return '暂无评级'
  const graduated = visibleGraduatedScore(item)
  if (graduated) return formatGraduatedTeamScore(graduated)
  if (item.teamRatingBand === 'Experimental' || item.confidence === 'experimental') {
    return item.sourceConfirmed ? '暂无评级' : '待验证'
  }
  if (!item.teamRatingBand) return '暂无评级'
  const generic = item.teamSystemRanking?.genericOrder
  if (generic) {
    if (
      item.teamSystemRanking?.status !== 'ranked' ||
      generic.status !== 'recommended' ||
      !generic.band ||
      !generic.confidence ||
      generic.band !== item.teamRatingBand ||
      generic.confidence !== item.confidence
    )
      return '暂无评级'
    if (generic.referenceInterval)
      return formatTeamRating(
        item.teamRatingBand,
        item.recommendationScore,
        generic.referenceInterval,
      )
  }
  const analysis = displayableLocalAnalysis(
    item.ratingAnalysis,
    item.teamRatingBand,
    item.confidence,
    item.mechanicValidity,
  )
  if (analysis) return localAnalysisRatingLabel(analysis, item.recommendationScore)
  return formatTeamRating(item.teamRatingBand, item.recommendationScore)
}

export function ratingLabel(item: TeamLoadoutOverviewItem) {
  return referenceSummary(item)
}

export function ratingTitle(item: TeamLoadoutOverviewItem) {
  const score = visibleGraduatedScore(item)
  if (score) return score.unconfirmedBuildAgentIds ? genericTeamRatingScopeCopy.title : '当前玩法的毕业配置评级'
  if (
    item.mechanicValidity === 'invalid' ||
    item.historicalReferenceOnly ||
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
  if (item.inferredStrength)
    return '泛用体系评级只表达目前能确认的层级；同档没有已发布关系时不排列强弱'
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
