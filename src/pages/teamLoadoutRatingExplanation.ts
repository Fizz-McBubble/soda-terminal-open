import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'

function strengthExplanation(item: TeamLoadoutOverviewItem) {
  if (
    item.teamRatingBand &&
    item.teamRatingBand !== 'Experimental' &&
    item.confidence !== 'experimental'
  )
    return null
  if (item.calibrationStatus === 'calibration_violation')
    return '现有强度比较结果不一致，暂时无法判断这队强弱。'
  if (item.sourceConfirmed && item.historicalReferenceOnly) return '可按所列条件尝试这组成员。'
  if (item.sourceConfirmed)
    return '这组成员可以尝试，目前还不能与其他队伍直接比较；关键条件见下方。'
  if (item.calibrationStatus === 'insufficient')
    return '可参考的强度比较不足，暂时无法判断这队强弱。'
  if (item.teamRatingBand === 'Experimental' || item.confidence === 'experimental')
    return '这套搭配还需要验证，暂时无法判断这队强弱。'
  return '暂时无法判断这队强弱，可以先查看成员与配装建议。'
}

export function ratingExplanation(item: TeamLoadoutOverviewItem) {
  if (item.mechanicValidity === 'invalid') return '搭配条件未满足，建议调整成员。'
  if (
    item.teamRatingBand &&
    item.teamRatingBand !== 'Experimental' &&
    item.confidence !== 'experimental'
  )
    return null
  if (item.mechanicValidity === 'partial') return '部分搭配条件尚未确认。'
  return strengthExplanation(item)
}
