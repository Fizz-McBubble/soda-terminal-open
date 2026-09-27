import type { SavedTeamPlanSnapshotFreshness } from '../accounts/planningSnapshotFreshness'

/** A stored plan remains readable when its current calculation cannot be replayed. */
export function savedPlanStaleNotice(freshness: SavedTeamPlanSnapshotFreshness) {
  if (!freshness.stale) return undefined
  switch (freshness.reason) {
    case 'legacy-unverifiable':
      return '这份旧方案尚未按当前账户重新匹配，原配装仍可查看。重新匹配后可保存新的配装。'
    case 'unmatched':
      return '账户资料或配装依据已有变化，原方案仍可查看。请重新匹配后再保存当前配装。'
    case 'current-result-unavailable':
      return '当前账户分析尚不可用，无法验证此已保存方案。你仍可查看历史方案；重新匹配当前队伍后才能保存为当前方案。'
    default:
      return '此已保存方案缺少可验证的求解快照。你仍可查看历史方案；重新匹配当前队伍后才能保存为当前方案。'
  }
}
