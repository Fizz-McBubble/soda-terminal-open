import { useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { beginUsageOperation } from '../usageStatistics/client'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { playerErrorMessage } from '../application/playerErrorMessage'
import { browserCalculationInputFingerprint } from '../application/browserCalculationInputFingerprint'
import { useF5AccountSummary } from '../components/f5AccountSummaryContext'
import {
  CalculationQueryClientContext,
  useAccountDecisionWorld,
} from '../application/accountDecisionWorldHooks'
import { isTeamDeploymentOrder } from '../application/publicTeamDeploymentOrder'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import { acceptTeamRoutePresentation } from './publicTeamRoutePresentation'
import { acceptTeamOverviewPresentation } from './teamLoadoutPresentationDto'
import { standardReferenceContinuation32 } from './standardReferenceContinuation32'
import {
  currentDecisionWorldForRecovery,
  loadCurrentTeamOverviewFromQuery,
  restoreCurrentTeamAnalysisSession,
} from './teamAnalysisRecovery'

export function useTeamRematch({
  teamKey,
  warehouse,
  decision,
  analysisRunId,
  team,
  currentTargetTeamFit,
  setTargetFitState,
  setAlternativeError,
  readOnly,
}: {
  teamKey: string
  warehouse: CoreWarehouse
  decision?: AccountDecisionSnapshot
  analysisRunId?: string
  team: DecisionTeamViewModel | null
  currentTargetTeamFit: TargetTeamWarehouseFitQueryResult | undefined
  setTargetFitState: (value: {
    runId: string | undefined
    fit: TargetTeamWarehouseFitQueryResult | undefined
  }) => void
  setAlternativeError: (value: string | null) => void
  readOnly: boolean
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const calculationClient = useContext(CalculationQueryClientContext)
  const decisionWorld = useAccountDecisionWorld()
  const accountSummary = useF5AccountSummary()
  const [rematching, setRematching] = useState(false)
  const rematchGeneration = useRef(0)
  const rematchPending = useRef(false)
  const liveWorld = useRef(decisionWorld)
  useEffect(() => {
    liveWorld.current = decisionWorld
  }, [decisionWorld])
  useEffect(
    () => () => {
      rematchGeneration.current += 1
    },
    [teamKey, warehouse.accountId, accountSummary?.appSessionId],
  )
  const rematchTeam = async () => {
    if (!team || !calculationClient || !analysisRunId || !decision || rematchPending.current) return
    let previousSession = currentTeamAnalysisSession
    const previousFit = currentTargetTeamFit
    const generation = ++rematchGeneration.current
    const active = () =>
      generation === rematchGeneration.current && window.location.pathname === pathname
    rematchPending.current = true
    setRematching(true)
    setAlternativeError(null)
    const finishUsage = beginUsageOperation('team_loadout')
    try {
      const world = liveWorld.current
      const sourceId = previousSession?.result.sourceRunId ?? analysisRunId
      const needsRefresh = readOnly || world.status !== 'current' || world.run.runId !== sourceId
      const refreshed = needsRefresh
        ? world.status === 'current'
          ? world.run
          : await decisionWorld.refresh()
        : null
      if (!active()) return
      if (readOnly && !refreshed) throw new Error('当前账户资料暂时无法用于分析。')
      const runId = refreshed?.runId ?? analysisRunId
      const inputFingerprint =
        refreshed?.snapshot.fingerprint.inputHash ?? decision.fingerprint.inputHash
      const accountId = refreshed?.input.warehouse.accountId ?? warehouse.accountId ?? ''
      if (accountId !== warehouse.accountId) throw new Error('当前账户已变化，请重新选择队伍。')
      if (!previousSession) {
        const currentWorld = refreshed
          ? { status: 'current' as const, run: refreshed, liveFingerprint: inputFingerprint }
          : currentDecisionWorldForRecovery(liveWorld.current)
        if (
          !accountSummary ||
          accountSummary.hydrating ||
          !currentWorld ||
          currentWorld.run.runId !== runId
        )
          throw new Error('当前队伍分析暂时无法恢复，请返回队伍配装后重试。')
        const overview = await loadCurrentTeamOverviewFromQuery(currentWorld.run, calculationClient)
        if (!active()) return
        previousSession = restoreCurrentTeamAnalysisSession(
          accountSummary,
          currentWorld,
          teamKey,
          overview,
        )
        if (!previousSession) throw new Error('当前队伍已不在本次建议中，请重新选择队伍。')
        const existing = currentTeamAnalysisSession
        if (
          existing &&
          (existing.result.appSessionId !== previousSession.result.appSessionId ||
            existing.result.warehouse.accountId !== accountId ||
            existing.result.inputFingerprint !== inputFingerprint)
        )
          throw new Error('当前账户资料已变化，请重新选择队伍。')
        setCurrentTeamAnalysisSession(previousSession)
      }
      const projected = await calculationClient.queryTeamRoutePresentation({
        contractVersion: calculationQueryContractVersion,
        kind: 'team_route_presentation',
        runId,
        candidateId: teamKey,
      })
      if (!active()) return
      const entry = acceptTeamRoutePresentation(projected, {
        runId,
        accountId,
        inputFingerprint,
        candidateId: teamKey,
      })
      if (
        !entry?.team ||
        !entry.targetCandidateId ||
        entry.team.agentIds.toSorted().join('|') !== team.agentIds.toSorted().join('|')
      )
        throw new Error('这支队伍暂不能生成配装，请重新选择搭配。')
      const fit = await calculationClient.calculateTargetTeamWarehouseFit({
        contractVersion: calculationQueryContractVersion,
        kind: 'target_team_warehouse_fit',
        runId,
        candidateId: entry.targetCandidateId,
        // Supplying parameters is an explicit player confirmation to the producer.
        // Repeating a default calculation must retain its source-default authority.
        equipmentParameters:
          previousFit?.effectiveEquipmentParameters?.source === 'player_confirmed'
            ? previousFit.effectiveEquipmentParameters
            : undefined,
        scenarioSelection: previousFit?.scenarioSelection,
        eventConditionDeclarationsByAgentId: previousFit?.eventConditionDeclarationsByAgentId,
        standardReference32: standardReferenceContinuation32(previousFit, entry.targetCandidateId, {
          refreshMetadata: Boolean(refreshed),
        }),
      })
      if (!active()) return
      if (
        liveWorld.current.status !== 'current' ||
        liveWorld.current.liveFingerprint !== inputFingerprint ||
        currentTeamAnalysisSession?.result.appSessionId !== previousSession.result.appSessionId ||
        currentTeamAnalysisSession.result.warehouse.accountId !== accountId
      ) {
        finishUsage('cancelled')
        throw new Error('账户资料已更新，请重新搭配后再使用方案。')
      }
      const order = previousFit?.targetExecution.deploymentOrder
      const nextFit = isTeamDeploymentOrder(order, fit.memberIds)
        ? {
            ...fit,
            targetExecution: {
              ...fit.targetExecution,
              deploymentOrder: [...order] as [string, string, string],
            },
          }
        : fit
      const overview = refreshed
        ? (acceptTeamOverviewPresentation(refreshed.teamPresentation, {
            runId,
            accountId,
            inputFingerprint,
            agentId: null,
            planId: null,
            discId: null,
          })?.overviewModel ??
          acceptTeamOverviewPresentation(
            await calculationClient.queryTeamOverviewPresentation({
              contractVersion: calculationQueryContractVersion,
              kind: 'team_overview_presentation',
              runId,
              context: { agentId: null, planId: null, discId: null },
            }),
            {
              runId,
              accountId,
              inputFingerprint,
              agentId: null,
              planId: null,
              discId: null,
            },
          )?.overviewModel)
        : previousSession.result.overviewModel
      if (!overview) throw new Error('队伍展示结果缺失或已过期，请重新搭配。')
      if (!active()) return
      const latest = liveWorld.current
      if (
        latest.status !== 'current' ||
        latest.liveFingerprint !== inputFingerprint ||
        latest.run.runId !== (refreshed?.runId ?? previousSession.result.sourceRunId ?? runId) ||
        currentTeamAnalysisSession?.result.appSessionId !== previousSession.result.appSessionId ||
        currentTeamAnalysisSession.result.warehouse.accountId !== accountId
      )
        throw new Error('账户资料已更新，请重新搭配后再使用方案。')
      finishUsage(fit.status === 'ready' ? 'success' : 'incomplete')
      setCurrentTeamAnalysisSession({
        kind: 'complete',
        result: {
          ...previousSession.result,
          ...(refreshed
            ? {
                sourceRunId: undefined,
                reservations: undefined,
                warehouse: refreshed.input.warehouse,
                decisionSnapshot: refreshed.snapshot,
                capturedAt: new Date(refreshed.capturedAt),
                inputReadFingerprint: browserCalculationInputFingerprint(refreshed.input),
                overviewModel: overview,
                targetTeamFits: {},
                teamRoutePresentations: {},
              }
            : {}),
          analysisRunId: runId,
          inputFingerprint,
          fitOverviewModel: undefined,
          targetTeamFits: {
            ...(refreshed ? {} : previousSession.result.targetTeamFits),
            [entry.team.id]: nextFit,
          },
          teamRoutePresentations: {
            ...(refreshed ? {} : previousSession.result.teamRoutePresentations),
            [teamKey]: entry,
          },
        },
      })
      setTargetFitState({ runId, fit: nextFit })
      navigate(`/loadouts/team/${encodeURIComponent(teamKey)}`, { replace: true })
    } catch (error) {
      const cancelled = error instanceof Error && error.name === 'AbortError'
      finishUsage(active() && !cancelled ? 'failure' : 'cancelled')
      if (active())
        setAlternativeError(
          cancelled ? '本次搭配已取消。' : playerErrorMessage(error, '重新搭配失败，请重试。'),
        )
    } finally {
      if (!active()) finishUsage('cancelled')
      if (active()) {
        rematchPending.current = false
        setRematching(false)
      }
    }
  }
  return { rematching, rematchTeam }
}
