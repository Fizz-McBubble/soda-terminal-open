import { verifyRemainingBoxReservation } from '../application/remainingBox'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'
import type { AccountPlanningDraft } from '../accounts/types'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { TeamAnalysisResult } from './teamAnalysisSession'
import { currentTeamAnalysisSession } from './teamAnalysisSession'
import { getAgentName } from '../application/publicRosterNames'

export function planEditorSaveBlockReason({
  equipmentParametersRequireRefresh,
  readOnly,
  staleNotice,
  accountId,
  duplicateMemberId,
}: {
  equipmentParametersRequireRefresh: boolean | undefined
  readOnly: boolean
  staleNotice: string | null | undefined
  accountId: string | null | undefined
  duplicateMemberId: string | undefined
}): string | null | undefined {
  if (equipmentParametersRequireRefresh) return '正在按新参数重新匹配，完成后才能保存。'
  if (readOnly) return staleNotice ?? '角色或装备已更新，请重新分析后保存。'
  if (!accountId) return null
  if (duplicateMemberId) return `队伍成员重复：${getAgentName(duplicateMemberId)}。请调整后再保存。`
  return undefined
}

export function usesRemainingBoxReservation(restored: boolean, analysisRunId?: string) {
  return (
    !restored &&
    !!currentTeamAnalysisSession?.result.reservations &&
    currentTeamAnalysisSession.result.analysisRunId === analysisRunId
  )
}

export function assertPlanEditorReservation({
  decisionInput,
  liveFingerprint,
  remainingSession,
  targetTeamFit,
}: {
  decisionInput: Parameters<typeof verifyRemainingBoxReservation>[0] | null | undefined
  liveFingerprint: string | null | undefined
  remainingSession: TeamAnalysisResult | undefined
  targetTeamFit: TargetTeamWarehouseFitQueryResult | undefined
}) {
  const reservations = remainingSession?.reservations
  if (!reservations) return
  if (!decisionInput || remainingSession.inputFingerprint !== liveFingerprint)
    throw new Error('账户资料已变化，请返回重新分析剩余队伍。')
  verifyRemainingBoxReservation(decisionInput, reservations)
  const reservedAgents = new Set(reservations.flatMap((item) => item.memberIds))
  const reservedDiscs = new Set(reservations.flatMap((item) => item.discIds))
  const execution = targetTeamFit?.targetExecution
  if (
    !execution ||
    execution.memberIds.some((id) => reservedAgents.has(id)) ||
    execution.physicalDiscIds.some((id) => reservedDiscs.has(id))
  )
    throw new Error('当前配装占用了保留队伍的成员或驱动盘，请重新匹配。')
}

export function projectPlanEditorCandidateWarehouse(
  plan: CandidateWarehousePlan | undefined,
): AccountPlanningDraft['candidateWarehouse'] | undefined {
  if (!plan?.loadouts.length) return undefined
  return {
    scope: plan.scope,
    totalScore: plan.totalScore,
    loadouts: plan.loadouts.map((loadout) => ({
      agentId: loadout.agentId,
      totalScore: loadout.totalScore,
      discIds: loadout.discs.map((choice) => choice.disc.id),
      effectiveRolls: loadout.discs.reduce((total, choice) => total + choice.effectiveRolls, 0),
      setPattern: loadout.setPattern,
      degraded: loadout.degraded,
    })),
    boundary: plan.boundary,
    ...(plan.panelObjectiveNote ? { panelObjectiveNote: plan.panelObjectiveNote } : {}),
  }
}
