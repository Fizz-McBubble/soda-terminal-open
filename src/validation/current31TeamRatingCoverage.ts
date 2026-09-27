import {
  lookupCurrent31TeamIntrinsicSummary,
  current31TeamIntrinsicIndexStatus,
} from '../decision/current31TeamIntrinsicIndex'
import { currentReviewedTeamSourceDirections } from '../gameDataPacks/reviewedTeamSourceDirections'
import { stableContentHash } from '../gameDataPacks/types'

/** Read-only census of the same source identities and indexed results used by BOX. */
export function current31TeamRatingCoverage() {
  const directions = currentReviewedTeamSourceDirections()
  const counts = {
    reviewed: 0,
    ruleDerived: 0,
    modelInferred: 0,
    preliminary: 0,
    unrated: 0,
    hardInvalid: 0,
    blocked: 0,
    unavailable: 0,
  }
  const issues: string[] = []
  const seen = new Set<string>()
  if (!directions.length) issues.push('来源队伍目录为空，不能报告覆盖完整。')
  if (current31TeamIntrinsicIndexStatus.status !== 'ready')
    issues.push(`队伍索引不可用：${current31TeamIntrinsicIndexStatus.reason ?? 'unknown'}`)
  for (const direction of directions) {
    const key = [...direction.memberIds].sort().join('|')
    if (seen.has(key)) {
      issues.push(`来源队伍身份重复：${key}`)
      continue
    }
    seen.add(key)
    const result = lookupCurrent31TeamIntrinsicSummary(direction.memberIds)
    if (!result) {
      counts.unavailable++
      issues.push(`缺少队伍索引结果：${key}`)
    } else if (result.ratingStatus === 'hard_invalid') counts.hardInvalid++
    else if (result.ratingStatus === 'blocked') counts.blocked++
    else if (
      result.ratingBand === 'Experimental' ||
      result.ratingBand === null ||
      result.metaAuthority === 'none'
    )
      counts.unrated++
    else if (
      !Number.isFinite(result.recommendationScore) ||
      result.recommendationScore === null ||
      result.confidence === null
    ) {
      counts.unavailable++
      issues.push(`队伍评级字段不完整：${key}`)
    } else if (result.metaAuthority === 'variant_reality_profile') counts.ruleDerived++
    else if (result.metaAuthority === 'model_inference') counts.modelInferred++
    else if (result.metaAuthority === 'recovered_preliminary') counts.preliminary++
    else counts.reviewed++
  }
  const classified = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (classified !== seen.size) issues.push(`评级分类不守恒：${classified}/${seen.size}`)
  const core = {
    contract: 'soda-current31-team-rating-coverage/v1' as const,
    status: issues.length ? ('incomplete' as const) : ('measured' as const),
    sourceTeams: directions.length,
    uniqueTeams: seen.size,
    classified,
    counts,
    indexContentHash: current31TeamIntrinsicIndexStatus.contentHash,
    issues,
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
