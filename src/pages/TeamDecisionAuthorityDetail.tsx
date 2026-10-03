import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { benchmarkLabel } from '../features/agentDevelopmentGolden/top10Labels'
import './team-decision-summary.css'

/** Essential result facts belong in the workspace, not a second explanation panel. */
export function TeamDecisionAuthorityDetail({
  targetTeamFit,
  memberIds,
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
  const comparison = targetTeamFit.valueBenchmark
  const baselineModel = comparison?.baseline?.memberModelQualification32
  const candidateModel = comparison?.candidate?.memberModelQualification32
  const sameMembers =
    targetTeamFit.memberIds?.length === memberIds.length &&
    memberIds.every((id) => targetTeamFit.memberIds.includes(id))
  const qualifiedComparison =
    sameMembers &&
    comparison?.status === 'supported' &&
    baselineModel?.status === 'formal' &&
    candidateModel?.status === 'formal' &&
    baselineModel.scope === 'team_prepared_fixed_event_model' &&
    baselineModel.scope === candidateModel.scope &&
    baselineModel.policyId === candidateModel.policyId &&
    baselineModel.sourceHash === candidateModel.sourceHash &&
    baselineModel.bangbooIncluded === false &&
    candidateModel.bangbooIncluded === false &&
    comparison.baseline.planningDps === baselineModel.planningDps &&
    comparison.candidate.planningDps === candidateModel.planningDps
  const comparisonLabel = qualifiedComparison ? benchmarkLabel(comparison, false) : null
  if (!teamGaps.length && !missingEffects && !comparisonLabel) return null
  return (
    <div className="team-decision-summary" aria-label="配装结果摘要">
      {comparisonLabel ? (
        <p>
          <strong>{comparisonLabel}</strong>
          <span>仅比较三人已列动作的固定窗口，不含邦布、准备伤害、异常结算与提前失衡收益。</span>
        </p>
      ) : null}
      {missingEffects && !qualifiedComparison ? (
        <p>有 {missingEffects} 名成员的音擎效果资料未齐，暂不能完整比较收益。</p>
      ) : null}
      {teamGaps.length ? <p role="status">方案说明：{[...new Set(teamGaps)].join('；')}</p> : null}
    </div>
  )
}
