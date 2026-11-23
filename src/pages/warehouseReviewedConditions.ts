import { getCandidateSetLabels, getPublicStatLabel } from '../application/publicCandidateLabels'
import { reviewedTeamDiscDirections } from '../gameDataPacks/reviewedTeamDiscConditions'
import { readableAgentName } from './warehouseFactLabels'

// Only these branches have been checked for this player-facing projection.
const reviewedBranches = new Set([
  'miyoushe-77017654-miyabi-remielle-anomaly',
  'miyoushe-77017654-miyabi-remielle-anomaly-m2plus',
  'miyoushe-77017654-miyabi-remielle-yanagi-experimental',
  'miyoushe-77017654-yanagi-remielle-velina-disorder',
])

export function reviewedWarehouseCondition(profileId: string | undefined, detail: string) {
  const direction = reviewedTeamDiscDirections.find(
    (row) =>
      reviewedBranches.has(row.id) &&
      profileId === `${row.agentId}:reviewed-${row.id}` &&
      detail === row.source.locator.text,
  )
  if (!direction || direction.exactMemberSets.length !== 1) return null
  const names = direction.exactMemberSets[0]!.map(readableAgentName)
  const primary = getCandidateSetLabels(direction.setPlan.primarySetIds)
  const secondary = getCandidateSetLabels(direction.setPlan.secondarySetIds)
  const main = Object.entries(direction.mainStats ?? {}).map(([slot, stats]) => {
    const labels = stats.map(getPublicStatLabel)
    return labels.every(Boolean) ? `${slot}号位${labels.join('或')}` : null
  })
  const sub = (direction.subStatCandidates ?? []).map(getPublicStatLabel)
  if (
    names.some((name) => !name || /待确认|agent-/i.test(name)) ||
    [...primary, ...secondary].some((name) => name.includes('待补齐')) ||
    main.some((value) => !value) ||
    sub.some((value) => !value)
  )
    return null
  const range = direction.mindscapeRangeByAgentId?.[direction.agentId]
  const rangeText =
    range && range.maximum < 6
      ? `；适用于${readableAgentName(direction.agentId)}${range.minimum}至${range.maximum}影`
      : range && range.minimum > 0
        ? `；适用于${readableAgentName(direction.agentId)}${range.minimum}影及以上`
        : ''
  const selection = direction.requiresExplicitSelection
    ? '；这是需主动选择的实验方向，高配条件尚未明确'
    : ''
  const retained = direction.retainBasePlans ? '原套装方向仍可保留。' : ''
  return `适用队伍：${names.join('、')}${rangeText}${selection}。候选套装：${primary.join('或')}四件、${secondary.join('或')}两件；${main.join('，')}${sub.length ? `；副词条可选${sub.join('、')}` : ''}。${retained}`
}
