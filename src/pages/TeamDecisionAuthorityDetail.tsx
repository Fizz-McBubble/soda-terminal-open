import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import './team-decision-summary.css'

/** Essential result facts belong in the workspace, not a second explanation panel. */
export function TeamDecisionAuthorityDetail({
  targetTeamFit,
}: {
  decision: AccountDecisionSnapshot
  memberIds: readonly string[]
  targetTeamFit?: TargetTeamWarehouseFitQueryResult
}) {
  if (!targetTeamFit) return null
  const plan = targetTeamFit.warehousePlan
  // Member-specific notes are shown beside that member's equipment, not applied to every tab.
  const teamGaps = plan.gaps.filter(
    (gap) => !plan.loadouts?.some((loadout) => loadout.degradeReasons.includes(gap)),
  )
  const benchmark = targetTeamFit.accountBoundBenchmark
  const missingEffects =
    benchmark.equipmentModifierProjection?.wEngines.filter(
      (item) => item.passiveStatus !== 'supported',
    ).length ?? 0
  if (!teamGaps.length && !missingEffects) return null
  return (
    <div className="team-decision-summary" aria-label="配装结果摘要">
      {missingEffects ? (
        <p>有 {missingEffects} 名成员的音擎效果资料未齐，暂不能完整比较收益。</p>
      ) : null}
      {teamGaps.length ? <p role="status">方案说明：{[...new Set(teamGaps)].join('；')}</p> : null}
    </div>
  )
}
