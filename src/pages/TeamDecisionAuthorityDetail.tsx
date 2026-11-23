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
  const comparison = targetTeamFit.valueBenchmark
  const baselineModel = comparison?.baseline?.memberModelQualification32
  const candidateModel = comparison?.candidate?.memberModelQualification32
  const sameMembers =
    targetTeamFit.memberIds?.length === memberIds.length &&
    memberIds.every((id) => targetTeamFit.memberIds.includes(id))
  const wEngines = targetTeamFit.accountBoundBenchmark.equipmentModifierProjection?.wEngines
  const qualifiedComparison =
    sameMembers &&
    wEngines?.length === memberIds.length &&
    wEngines.every((item) => item.passiveStatus === 'supported') &&
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
  const comparisonLabel = qualifiedComparison
    ? benchmarkLabel(comparison, false).replace(
        /^(?:同段输出|近似输出|预计输出)/,
        '三人固定动作输出',
      )
    : null
  if (!comparisonLabel) return null
  return (
    <div className="team-decision-summary" aria-label="配装结果摘要">
      <p>
        <strong>{comparisonLabel}</strong>
      </p>
    </div>
  )
}
