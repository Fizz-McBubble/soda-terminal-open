import type { SavedTeamPlanSnapshotFreshness } from '../accounts/planningSnapshotFreshness'

/** A stored plan remains readable when its current calculation cannot be replayed. */
export function savedPlanStaleNotice(freshness: SavedTeamPlanSnapshotFreshness) {
  if (!freshness.stale) return undefined
  switch (freshness.reason) {
    case 'disc-rarity-outside-scope':
      return '方案包含非 S 级或品质未确认的驱动盘，请使用 S 级驱动盘重新匹配。'
    case 'luminize-source-stale':
      return '辉映计算依据已更新，重新匹配后可更新结果。'
    case 'luminize-declaration-invalid':
      return '辉映结果与当前方案不一致，请重新匹配。'
    case 'legacy-unverifiable':
      return '这份方案暂不能重新计算；重新匹配后可保存。'
    case 'unmatched':
      return '账户资料或配装依据已有变化，请重新匹配后再保存。'
    case 'current-result-unavailable':
      return '当前分析暂不可用。'
    default:
      return '这份方案暂不能重新计算；重新匹配后可保存。'
  }
}
