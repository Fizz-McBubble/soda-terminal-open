import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { beginUsageOperation } from '../../usageStatistics/client'
import type { NavigateFunction } from 'react-router-dom'
import { loadCoreWarehouse } from '../../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import type {
  useAccountDecisionWorld,
  useDetachedAccountDecisionCalculation,
  useReleaseAccountDecisionRun,
  useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import type { TargetTeamWarehouseFitQueryResult } from '../../application/calculationQueryContract'
import { prepareRemainingBox } from '../../application/remainingBox'
import { preloadVisualEntityImages } from '../../assets/visualEntityImageSource'
import type { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { currentTeamOverviewFromQuery, waitForAnalysisStage } from '../teamAnalysisRecovery'
import {
  currentTeamAnalysisSession,
  setCurrentTeamAnalysisSession,
  type LastCompleteAnalysis,
  type TeamAnalysisResult,
  type TeamAnalysisSnapshot,
  type TeamAnalysisState,
} from '../teamAnalysisSession'
import type { useTeamPickerQueries } from './useTeamPickerQueries'
import { traceTeamRematch } from './teamRematchTrace'

export function useTeamAnalysisFlow({
  accountSummary,
  decisionWorld,
  reservedPlanIds,
  contextAgentId,
  contextPlanId,
  contextDiscId,
  rematchRequest,
  analysis,
  setAnalysis,
  lastCompleteAnalysis,
  setLastCompleteAnalysis,
  setAnalysisSnapshot,
  setRequestedSelectedId,
  setRemainingBoxError,
  setRemainingBoxOpen,
  setOverviewFeedback,
  setPreparingItemId,
  setPreparationError,
  analysisRequest,
  remainingRequest,
  remainingRunning,
  prepareRequest,
  identityForRun,
  queryTeamOverview,
  queryTeamRoute,
  querySavedReplay,
  queueFitOverview,
  releasePreviousDetached,
  calculateDetached,
  calculateTargetTeamWarehouseFit,
  releaseRun,
  navigate,
}: {
  accountSummary: ReturnType<typeof useF5AccountSummary>
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  reservedPlanIds: string[]
  contextAgentId: string | null
  contextPlanId: string | null
  contextDiscId: string | null
  rematchRequest: MutableRefObject<{ planId: string | null; teamId: string | null } | null>
  analysis: TeamAnalysisState
  setAnalysis: Dispatch<SetStateAction<TeamAnalysisState>>
  lastCompleteAnalysis: LastCompleteAnalysis | null
  setLastCompleteAnalysis: Dispatch<SetStateAction<LastCompleteAnalysis | null>>
  setAnalysisSnapshot: Dispatch<SetStateAction<TeamAnalysisSnapshot | null>>
  setRequestedSelectedId: Dispatch<SetStateAction<string | null>>
  setRemainingBoxError: Dispatch<SetStateAction<string | null>>
  setRemainingBoxOpen: Dispatch<SetStateAction<boolean>>
  setOverviewFeedback: Dispatch<SetStateAction<string | null>>
  setPreparingItemId: Dispatch<SetStateAction<string | null>>
  setPreparationError: Dispatch<
    SetStateAction<{ runId: string; itemId: string; message: string } | null>
  >
  analysisRequest: MutableRefObject<number>
  remainingRequest: MutableRefObject<number>
  remainingRunning: MutableRefObject<boolean>
  prepareRequest: MutableRefObject<number>
  identityForRun: ReturnType<typeof useTeamPickerQueries>['identityForRun']
  queryTeamOverview: ReturnType<typeof useTeamPickerQueries>['queryTeamOverview']
  queryTeamRoute: ReturnType<typeof useTeamPickerQueries>['queryTeamRoute']
  querySavedReplay: ReturnType<typeof useTeamPickerQueries>['querySavedReplay']
  queueFitOverview: (
    result: TeamAnalysisResult,
    fits: Record<string, TargetTeamWarehouseFitQueryResult>,
  ) => void
  releasePreviousDetached: (nextRunId: string) => void
  calculateDetached: ReturnType<typeof useDetachedAccountDecisionCalculation>
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
  releaseRun: ReturnType<typeof useReleaseAccountDecisionRun>
  navigate: NavigateFunction
}) {
  const continueRematch = async (result: TeamAnalysisResult, plans: AccountPlanningDraft[]) => {
    const request = rematchRequest.current
    traceTeamRematch('continue.enter', {
      hasRequest: Boolean(request),
      generation: analysisRequest.current,
    })
    if (!request) return
    rematchRequest.current = null
    const analysisGeneration = analysisRequest.current
    const generation = ++prepareRequest.current
    const isCurrentRequest = () => {
      const checks = {
        analysisCurrent: analysisGeneration === analysisRequest.current,
        prepareCurrent: generation === prepareRequest.current,
      }
      if (!checks.analysisCurrent || !checks.prepareCurrent)
        traceTeamRematch('continue.reject.generation', checks)
      return checks.analysisCurrent && checks.prepareCurrent
    }
    const hasCurrentSession = () => {
      const session = currentTeamAnalysisSession
      traceTeamRematch('continue.session', {
        complete: session?.kind === 'complete',
        appMatches: session?.result.appSessionId === result.appSessionId,
        accountMatches: session?.result.warehouse.accountId === result.warehouse.accountId,
        runMatches: session?.result.analysisRunId === result.analysisRunId,
        fingerprintMatches: session?.result.inputFingerprint === result.inputFingerprint,
      })
      return (
        session?.kind === 'complete' &&
        session.result.appSessionId === result.appSessionId &&
        session.result.warehouse.accountId === result.warehouse.accountId &&
        session.result.analysisRunId === result.analysisRunId &&
        session.result.inputFingerprint === result.inputFingerprint
      )
    }
    const plan = plans.find((item) => item.id === request.planId)
    const match = plan ? (await querySavedReplay(result, plan).catch(() => null))?.match : undefined
    if (!isCurrentRequest()) return
    const candidateId = request.planId ? match?.buildIntent?.exactTeam.candidateId : request.teamId
    traceTeamRematch('continue.identity', {
      hasPlan: Boolean(plan),
      hasReplay: Boolean(match),
      hasCandidate: Boolean(candidateId),
    })
    // Recommendations are a presentation subset and can omit a current team.
    // The private route Query validates the exact requested
    // identity against this run's complete producer facts.
    if (candidateId) {
      traceTeamRematch('route.dispatch', { generation, analysisGeneration })
      const entry = await queryTeamRoute(result, candidateId).catch(() => null)
      traceTeamRematch('route.received', {
        accepted: Boolean(entry),
        hasTeam: Boolean(entry?.team),
        hasTarget: Boolean(entry?.targetCandidateId),
      })
      if (!isCurrentRequest()) return
      if (!hasCurrentSession()) {
        setOverviewFeedback('账户资料已更新，请重新分析后再配装。')
        return
      }
      if (!entry) {
        setOverviewFeedback('队伍详情已变化，请重新分析后再配装。')
        return
      }
      if (!entry.team || !entry.targetCandidateId) {
        setOverviewFeedback('这支队伍暂不能生成配装，请重新选择搭配。')
        return
      }
      const destination = `/loadouts/team/${encodeURIComponent(candidateId)}`
      if (!entry.discOnlyCandidate && !entry.team.bangbooId && !entry.automaticBangboo) {
        traceTeamRematch('continue.navigate.choice', { discOnly: Boolean(entry.discOnlyCandidate) })
        navigate(destination, { replace: true })
        return
      }
      setPreparingItemId(candidateId)
      setPreparationError(null)
      setOverviewFeedback('正在重新搭配装备…')
      const finishUsage = beginUsageOperation('team_loadout')
      try {
        traceTeamRematch('fit.dispatch', { generation, analysisGeneration })
        const fit = await calculateTargetTeamWarehouseFit(
          result.analysisRunId,
          entry.targetCandidateId,
          match?.effectiveEquipmentParameters,
        )
        traceTeamRematch('fit.received', { generation, analysisGeneration })
        if (!isCurrentRequest()) {
          finishUsage('cancelled')
          return
        }
        const session = currentTeamAnalysisSession
        if (!session || !hasCurrentSession()) {
          finishUsage('cancelled')
          setOverviewFeedback('账户资料已更新，请重新分析后再配装。')
          return
        }
        finishUsage(fit.status === 'ready' ? 'success' : 'incomplete')
        const nextFits = { ...session.result.targetTeamFits, [entry.team.id]: fit }
        setCurrentTeamAnalysisSession({
          ...session,
          result: {
            ...session.result,
            targetTeamFits: nextFits,
            fitOverviewModel: undefined,
          },
        })
        navigate(destination, { replace: true })
        traceTeamRematch('continue.navigate.fit', { generation })
        queueFitOverview(session.result, nextFits)
      } catch {
        finishUsage(isCurrentRequest() ? 'failure' : 'cancelled')
        traceTeamRematch('fit.reject.query', { current: isCurrentRequest() })
        if (isCurrentRequest())
          setOverviewFeedback('这支队伍的配装生成失败，请重新搭配；账户资产没有改变。')
      } finally {
        if (isCurrentRequest()) setPreparingItemId(null)
      }
    } else if (request.planId || request.teamId) {
      setOverviewFeedback('原方案的成员暂无法匹配当前队伍建议，请重新选择搭配。原方案仍保留。')
    }
  }

  const startAnalysis = async () => {
    const request = ++analysisRequest.current
    traceTeamRematch('analysis.start', { generation: request })
    const isCurrentRequest = () => {
      const current = request === analysisRequest.current
      if (!current)
        traceTeamRematch('analysis.reject.generation', {
          expected: request,
          actual: analysisRequest.current,
        })
      return current
    }
    remainingRequest.current += 1
    remainingRunning.current = false
    let currentStage = 1
    if (analysis.kind === 'complete' || analysis.kind === 'stale') setLastCompleteAnalysis(analysis)
    setRequestedSelectedId(null)
    setAnalysisSnapshot(null)
    setAnalysis({ kind: 'running', stage: currentStage })
    try {
      await waitForAnalysisStage()
      if (!isCurrentRequest()) return
      const initialWarehouse = await loadCoreWarehouse()
      if (!isCurrentRequest()) return
      if (!initialWarehouse.accountId) {
        traceTeamRematch('analysis.reject.no_account', {})
        setAnalysis({ kind: 'unable', reason: 'no_account' })
        return
      }
      void preloadVisualEntityImages([
        ...initialWarehouse.roster.agents
          .filter((agent) => agent.owned)
          .map((agent) => ({
            entityType: 'agent' as const,
            entityId: agent.agentId,
            slotId: 'agent.square-avatar' as const,
            consumer: 'box.team-overview' as const,
          })),
        ...initialWarehouse.roster.bangboos
          .filter((bangboo) => bangboo.owned)
          .map((bangboo) => ({
            entityType: 'bangboo' as const,
            entityId: bangboo.bangbooId,
            slotId: 'bangboo.team-icon' as const,
            consumer: 'box.team-overview' as const,
          })),
      ])
      const snapshot = {
        accountName: initialWarehouse.account?.displayName ?? '当前账户',
        ownedAgentCount: initialWarehouse.roster.agents.filter((agent) => agent.owned).length,
        discCount: initialWarehouse.discs.length,
        capturedAt: new Date(),
      }
      setAnalysisSnapshot(snapshot)
      if (!initialWarehouse.discs.length) {
        traceTeamRematch('analysis.reject.empty_warehouse', {})
        setAnalysis({ kind: 'unable', reason: 'empty_warehouse' })
        return
      }

      currentStage = 2
      setAnalysis({ kind: 'running', stage: currentStage })
      await waitForAnalysisStage()
      if (!isCurrentRequest()) return
      currentStage = 3
      setAnalysis({ kind: 'running', stage: currentStage })
      await waitForAnalysisStage()
      if (!isCurrentRequest()) return
      const sharedRun = await decisionWorld.refresh()
      traceTeamRematch('analysis.refresh.received', {
        hasRun: Boolean(sharedRun),
        current: isCurrentRequest(),
      })
      if (!isCurrentRequest()) return
      if (!sharedRun) throw new Error('当前账户资料暂时无法用于分析。')
      const { snapshot: decisionSnapshot, input } = sharedRun
      const warehouse = input.warehouse
      const savedPlans = input.drafts
      const initialFingerprint = decisionSnapshot.fingerprint.inputHash

      currentStage = 4
      setAnalysis({ kind: 'running', stage: currentStage })
      await waitForAnalysisStage()
      if (!isCurrentRequest()) return
      const currentOverview = currentTeamOverviewFromQuery(sharedRun)
      if (!currentOverview) throw new Error('队伍展示结果缺失或已过期，请重新分析当前队伍。')
      const overviewModel =
        contextAgentId || contextPlanId || contextDiscId
          ? await queryTeamOverview(identityForRun(sharedRun), {
              agentId: contextAgentId,
              planId: contextPlanId,
              discId: contextDiscId,
            })
          : currentOverview
      if (!isCurrentRequest()) return

      currentStage = 5
      setAnalysis({ kind: 'running', stage: currentStage })
      await waitForAnalysisStage()
      if (!isCurrentRequest()) return
      const result = {
        appSessionId: accountSummary?.appSessionId ?? crypto.randomUUID(),
        analysisRunId: sharedRun.runId,
        warehouse,
        overviewModel,
        presentationContext: {
          agentId: contextAgentId,
          planId: contextPlanId,
          discId: contextDiscId,
        },
        decisionSnapshot,
        capturedAt: new Date(sharedRun.capturedAt),
        inputFingerprint: initialFingerprint,
        targetTeamFits: {},
      }
      const nextAnalysis = { kind: 'complete' as const, result }
      setLastCompleteAnalysis(nextAnalysis)
      releasePreviousDetached(sharedRun.runId)
      setCurrentTeamAnalysisSession(nextAnalysis)
      setAnalysis(nextAnalysis)
      void continueRematch(result, savedPlans)
    } catch (error) {
      traceTeamRematch('analysis.reject.error', { current: isCurrentRequest() })
      if (isCurrentRequest())
        setAnalysis({
          kind: 'error',
          stage: currentStage,
          message: !navigator.onLine
            ? '当前处于离线状态。已保存的资产和方案仍可查看、导出；新分析需要联网。'
            : error instanceof Error && error.message.startsWith('队伍展示结果')
              ? error.message
              : undefined,
        })
    }
  }

  const startRemainingBoxAnalysis = async () => {
    if (remainingRunning.current || !accountSummary?.accountId) return
    analysisRequest.current += 1
    remainingRunning.current = true
    const requestId = ++remainingRequest.current
    const accountId = accountSummary.accountId
    const isCurrentRequest = () => remainingRequest.current === requestId
    setRemainingBoxError(null)
    setAnalysis({ kind: 'running', stage: 1 })
    let uncommittedRunId: string | null = null
    try {
      const source = await decisionWorld.refresh()
      if (!isCurrentRequest()) return
      if (!source) throw new Error('账户资料尚未就绪，请重试。')
      if (source.input.warehouse.accountId !== accountId)
        throw new Error('当前账户已切换，请重新分析。')
      const prepared = prepareRemainingBox(source.input, reservedPlanIds)
      setAnalysis({ kind: 'running', stage: 3 })
      const run = await calculateDetached(prepared.input)
      uncommittedRunId = run.runId
      if (!isCurrentRequest()) {
        releaseRun(run.runId)
        return
      }
      const result: TeamAnalysisResult = {
        appSessionId: accountSummary!.appSessionId,
        analysisRunId: run.runId,
        sourceRunId: source.runId,
        reservations: prepared.reservations,
        warehouse: source.input.warehouse,
        overviewModel: await queryTeamOverview(
          identityForRun(run),
          { agentId: null, planId: null, discId: null },
          source.runId,
          reservedPlanIds,
        ),
        presentationContext: { agentId: null, planId: null, discId: null },
        decisionSnapshot: run.snapshot,
        capturedAt: new Date(run.capturedAt),
        inputFingerprint: source.snapshot.fingerprint.inputHash,
        targetTeamFits: {},
      }
      if (!isCurrentRequest()) {
        releaseRun(run.runId)
        uncommittedRunId = null
        return
      }
      const next = { kind: 'complete' as const, result }
      releasePreviousDetached(run.runId)
      setCurrentTeamAnalysisSession(next)
      uncommittedRunId = null
      setLastCompleteAnalysis(next)
      setAnalysis(next)
      setRemainingBoxOpen(false)
    } catch (error) {
      if (uncommittedRunId) releaseRun(uncommittedRunId)
      if (!isCurrentRequest()) return
      setRemainingBoxError(error instanceof Error ? error.message : '剩余队伍分析失败，请重试。')
      setRemainingBoxOpen(true)
      setAnalysis(lastCompleteAnalysis ?? { kind: 'ready' })
    } finally {
      if (isCurrentRequest()) remainingRunning.current = false
    }
  }

  const reuseCurrentAnalysis = async () => {
    traceTeamRematch('reuse.enter', {
      worldStatus: decisionWorld.status,
      hasRequest: Boolean(rematchRequest.current),
      generation: analysisRequest.current,
    })
    if (decisionWorld.status !== 'current') return false
    const request = analysisRequest.current
    const { run } = decisionWorld
    const currentOverview = currentTeamOverviewFromQuery(run)
    traceTeamRematch('reuse.overview', {
      accepted: Boolean(currentOverview),
      hasProjection: Boolean(run.teamPresentation),
      runMatches: run.teamPresentation?.runId === run.runId,
      accountMatches: run.teamPresentation?.accountId === run.input.warehouse.accountId,
      fingerprintMatches:
        run.teamPresentation?.inputFingerprint === run.snapshot.fingerprint.inputHash,
      liveFingerprintMatches: decisionWorld.liveFingerprint === run.snapshot.fingerprint.inputHash,
      summaryAccountMatches: run.input.warehouse.accountId === accountSummary?.accountId,
    })
    if (!currentOverview) return false
    const overviewModel =
      contextAgentId || contextPlanId || contextDiscId
        ? await queryTeamOverview(identityForRun(run), {
            agentId: contextAgentId,
            planId: contextPlanId,
            discId: contextDiscId,
          })
        : currentOverview
    if (request !== analysisRequest.current) {
      traceTeamRematch('reuse.reject.generation', {
        expected: request,
        actual: analysisRequest.current,
      })
      return true
    }
    const result = {
      appSessionId: accountSummary?.appSessionId ?? crypto.randomUUID(),
      analysisRunId: run.runId,
      warehouse: run.input.warehouse,
      overviewModel,
      presentationContext: {
        agentId: contextAgentId,
        planId: contextPlanId,
        discId: contextDiscId,
      },
      decisionSnapshot: run.snapshot,
      capturedAt: new Date(run.capturedAt),
      inputFingerprint: run.snapshot.fingerprint.inputHash,
      targetTeamFits: {},
    }
    const nextAnalysis = { kind: 'complete' as const, result }
    queueMicrotask(() => {
      traceTeamRematch('reuse.commit.microtask', {
        current: request === analysisRequest.current,
        hasRequest: Boolean(rematchRequest.current),
      })
      if (request !== analysisRequest.current) return
      setLastCompleteAnalysis(nextAnalysis)
      releasePreviousDetached(run.runId)
      setCurrentTeamAnalysisSession(nextAnalysis)
      setAnalysis(nextAnalysis)
      void continueRematch(result, run.input.drafts)
    })
    return true
  }

  return {
    startAnalysis,
    startRemainingBoxAnalysis,
    reuseCurrentAnalysis,
  }
}
