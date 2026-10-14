import { selectPlayerConfirmableTargetBangbooSelection } from '../decision/targetTeamEquipmentParameters'
import { projectTeamEquipmentRecommendations } from '../decision/teamEquipmentRecommendations'
import { resolveTargetTeamFitEntry } from '../pages/teamTargetFitEntry'
import type { AccountDecisionRun, CalculationQueryClient } from './calculationQueryContract'
import { equipmentParameterSelection } from './equipmentParameterSelection'

export function resolvePlayerConfirmedTargetTeamQuery(
  query: Parameters<CalculationQueryClient['calculateTargetTeamWarehouseFit']>[0],
  run: AccountDecisionRun,
) {
  const choice = query.playerBangbooSelection
  if (!choice) return null
  if (query.equipmentParameters) throw new Error('队伍装备参数不能重复指定。')
  const entry = resolveTargetTeamFitEntry(run.snapshot, choice.teamKey, run.input.warehouse)
  const input = entry.playerConfirmableBangbooInput
  if (!input || entry.targetCandidateId !== query.candidateId)
    throw new Error('当前队伍的邦布确认已失效，请重新选择。')
  const bangbooSelection = selectPlayerConfirmableTargetBangbooSelection({
    ...input,
    bangbooId: choice.bangbooId,
    bangbooStarsById: { [choice.bangbooId]: choice.bangbooStars },
  })
  const recommendations = projectTeamEquipmentRecommendations({
    memberIds: input.memberIds,
    bangbooSelection,
    roster: run.input.warehouse.roster,
  })
  const equipmentParameters = equipmentParameterSelection({
    memberIds: input.memberIds,
    recommendations,
    effectiveParameters: {
      wEngines: [],
      bangbooId: choice.bangbooId,
      bangbooStars: choice.bangbooStars,
    },
  })
  if (equipmentParameters.wEngines.some((engine) => !engine.engineId))
    throw new Error('这支队伍缺少完整音擎参数，暂不能生成配装。')
  return {
    contractVersion: query.contractVersion,
    kind: query.kind,
    runId: query.runId,
    candidateId: query.candidateId,
    equipmentParameters,
    scenarioSelection: query.scenarioSelection,
    eventConditionDeclarationsByAgentId: query.eventConditionDeclarationsByAgentId,
  }
}
