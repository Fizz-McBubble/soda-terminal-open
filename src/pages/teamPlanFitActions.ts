import type { RefObject } from 'react'
import {
  calculationQueryContractVersion,
  type CalculationQueryClient,
  type TargetTeamEquipmentParameterSelection,
  type TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import type { useTargetTeamWarehouseFitCalculation } from '../application/accountDecisionWorldHooks'
import type { TargetTeamStandardReferenceRequest32 } from '../application/targetTeamStandardReference32'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import { formatDevelopmentEntityText } from '../application/publicRosterNames'
import { standardReferenceContinuation32 } from './standardReferenceContinuation32'
import { beginUsageOperation } from '../usageStatistics/client'

type TeamPlanFitActionOptions = {
  analysisRunId: string | undefined
  targetCandidateId: string | null
  calculationClient: CalculationQueryClient | null
  currentTargetTeamFit: TargetTeamWarehouseFitQueryResult | undefined
  readOnly: boolean
  explicitFitPending: RefObject<boolean>
  targetFitRequestGeneration: RefObject<number>
  capturePageScope: () => () => boolean
  scenarioSelection: CurrentPlanningScenarioSelection32
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
  setFitStatus: (status: 'idle' | 'running' | 'error') => void
  setEquipmentParametersRequireRefresh: (value: boolean) => void
  setTargetTeamFit: (result: TargetTeamWarehouseFitQueryResult, keepDeployment?: boolean) => void
  setAlternativeError: (value: string | null) => void
}

export function createTeamPlanFitActions(getOptions: () => TeamPlanFitActionOptions) {
  const updateStandardReference = async (request: TargetTeamStandardReferenceRequest32) => {
    const {
      analysisRunId,
      targetCandidateId,
      calculationClient,
      currentTargetTeamFit,
      readOnly,
      explicitFitPending,
      targetFitRequestGeneration,
      capturePageScope,
      setFitStatus,
      setEquipmentParametersRequireRefresh,
      setTargetTeamFit,
      setAlternativeError,
    } = getOptions()
    if (
      !analysisRunId ||
      !targetCandidateId ||
      !calculationClient ||
      !currentTargetTeamFit ||
      readOnly
    )
      throw new Error('队伍资料已变化，请重新分析。')
    if (explicitFitPending.current) throw new Error('正在计算，请稍后重试。')
    const isCurrentPage = capturePageScope()
    const generation = ++targetFitRequestGeneration.current
    explicitFitPending.current = true
    setFitStatus('running')
    setEquipmentParametersRequireRefresh(true)
    try {
      const fit = await calculationClient.calculateTargetTeamWarehouseFit({
        contractVersion: calculationQueryContractVersion,
        kind: 'target_team_warehouse_fit',
        runId: analysisRunId,
        candidateId: targetCandidateId,
        standardReference32: request,
        standardReferenceFitFingerprint32: currentTargetTeamFit.fingerprint,
      })
      if (!isCurrentPage() || generation !== targetFitRequestGeneration.current) return
      if (
        fit.standardReferenceUpdate32?.fitFingerprint !== currentTargetTeamFit.fingerprint ||
        fit.standardReferenceUpdate32.accountEquipmentPreserved !== true
      )
        throw new Error('当前计算服务尚未确认独立标准参考，请更新配套服务后重试。')
      if (
        fit.fingerprint !== currentTargetTeamFit.fingerprint ||
        fit.candidateId !== targetCandidateId
      )
        throw new Error('参考计算改变了账户配装身份，请重新分析。')
      if (request.stage === 'select' && fit.standardReference32?.status !== 'selected')
        throw new Error(
          formatDevelopmentEntityText(
            fit.standardReference32?.gaps.join('；') ||
              '当前动作条件暂不能生成参考，请调整后重试。',
          ),
        )
      setTargetTeamFit(fit)
      setAlternativeError(null)
      setFitStatus('idle')
    } catch (error) {
      if (isCurrentPage() && generation === targetFitRequestGeneration.current)
        setFitStatus('error')
      throw error
    } finally {
      explicitFitPending.current = false
      if (isCurrentPage() && generation === targetFitRequestGeneration.current)
        setEquipmentParametersRequireRefresh(false)
    }
  }
  const confirmEquipmentParameters = async (selection: TargetTeamEquipmentParameterSelection) => {
    const {
      analysisRunId,
      targetCandidateId,
      currentTargetTeamFit,
      readOnly,
      explicitFitPending,
      targetFitRequestGeneration,
      capturePageScope,
      scenarioSelection,
      calculateTargetTeamWarehouseFit,
      setFitStatus,
      setEquipmentParametersRequireRefresh,
      setTargetTeamFit,
    } = getOptions()
    if (!analysisRunId || !targetCandidateId || readOnly)
      throw new Error('当前队伍资料已变更，请重新分析后再确认配装。')
    if (explicitFitPending.current) return
    explicitFitPending.current = true
    const finishUsage = beginUsageOperation('team_loadout')
    const requestGeneration = ++targetFitRequestGeneration.current
    const isCurrentPage = capturePageScope()
    setEquipmentParametersRequireRefresh(true)
    setFitStatus('running')
    try {
      const fit = await calculateTargetTeamWarehouseFit(
        analysisRunId,
        targetCandidateId,
        selection,
        scenarioSelection,
        currentTargetTeamFit?.eventConditionDeclarationsByAgentId,
        undefined,
        standardReferenceContinuation32(currentTargetTeamFit, targetCandidateId, {
          equipmentParameters: selection,
        }),
      )
      if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) {
        finishUsage('cancelled')
        return
      }
      finishUsage(fit.status === 'ready' ? 'success' : 'incomplete')
      setTargetTeamFit(fit)
      setEquipmentParametersRequireRefresh(false)
      setFitStatus('idle')
    } catch (error) {
      if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) {
        finishUsage('cancelled')
        return
      }
      finishUsage('failure')
      // Inline controls roll back to the previous effective parameters on
      // failure; keep that unchanged result available for a fresh retry.
      setEquipmentParametersRequireRefresh(false)
      setFitStatus('error')
      throw error
    } finally {
      explicitFitPending.current = false
    }
  }
  return { updateStandardReference, confirmEquipmentParameters }
}
