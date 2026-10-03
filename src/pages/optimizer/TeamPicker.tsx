import { useContext, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { loadCoreWarehouse } from '../../accounts/coreWarehouse'
import { listAccountPlanningDrafts } from '../../accounts/planningDrafts'
import {
  CalculationQueryClientContext,
  useAccountDecisionWorld,
  useDetachedAccountDecisionCalculation,
  useReleaseAccountDecisionRun,
  useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import { contentHash } from '../../application/contentHash'
import { preloadVisualEntityImages } from '../../assets/visualEntityImageSource'
import { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { TeamConstraintResetPanel } from '../TeamLoadoutOverviewParts'
import {
  canRestoreCurrentTeamAnalysisSession,
  currentDecisionWorldForRecovery,
  restoreCurrentTeamAnalysisSession,
} from '../teamAnalysisRecovery'
import {
  currentTeamAnalysisSession,
  setCurrentTeamAnalysisSession,
  type LastCompleteAnalysis,
  type TeamAnalysisResult,
  type TeamAnalysisSnapshot,
  type TeamAnalysisState,
} from '../teamAnalysisSession'
import { acceptTeamOverviewPresentation } from '../teamLoadoutPresentationDto'
import {
  TeamAnalysisError,
  TeamAnalysisReady,
  TeamAnalysisRunning,
  TeamAnalysisUnable,
} from './TeamAnalysisStates'
import { TeamAnalysisOverviewView } from './TeamAnalysisOverviewView'
import { TeamRemainingBoxSelector } from './TeamRemainingBoxSelector'
import { useTeamAnalysisFlow } from './useTeamAnalysisFlow'
import { traceTeamRematch } from './teamRematchTrace'
import { useTeamPickerQueries } from './useTeamPickerQueries'

export function TeamPicker() {
  const navigate = useNavigate()
  const accountSummary = useF5AccountSummary()
  const savedPlanWarehouse = useLiveQuery(() => loadCoreWarehouse(), [accountSummary?.accountId])
  const decisionWorld = useAccountDecisionWorld()
  const calculationClient = useContext(CalculationQueryClientContext)
  const calculateDetached = useDetachedAccountDecisionCalculation()
  const calculateTargetTeamWarehouseFit = useTargetTeamWarehouseFitCalculation()
  const releaseRun = useReleaseAccountDecisionRun()

  const [reservedPlanIds, setReservedPlanIds] = useState<string[]>(
    () => currentTeamAnalysisSession?.result.reservations?.map((item) => item.planId) ?? [],
  )
  const [remainingBoxError, setRemainingBoxError] = useState<string | null>(null)
  const [remainingBoxOpen, setRemainingBoxOpen] = useState(false)
  const remainingRequest = useRef(0)
  const analysisRequest = useRef(0)
  const remainingRunning = useRef(false)

  const [params] = useSearchParams()
  const contextAgentId = params.get('agent')
  const contextPlanId = params.get('plan')
  const contextDiscId = params.get('discId')
  const reanalyzeRequested = params.get('reanalyze') === '1'
  const rematchRequest = useRef<{ planId: string | null; teamId: string | null } | null>(null)
  const reanalyzeHandled = useRef(false)
  const currentDecisionWorld = currentDecisionWorldForRecovery(decisionWorld)
  const matchingSessionFromMemory =
    accountSummary &&
    !accountSummary.hydrating &&
    currentTeamAnalysisSession?.result.appSessionId === accountSummary.appSessionId &&
    currentTeamAnalysisSession?.result.warehouse.accountId === accountSummary.accountId
      ? currentTeamAnalysisSession
      : null
  const matchingSession =
    matchingSessionFromMemory ??
    (canRestoreCurrentTeamAnalysisSession(accountSummary, currentDecisionWorld) &&
    currentDecisionWorld
      ? restoreCurrentTeamAnalysisSession(accountSummary!, currentDecisionWorld, null)
      : null)
  const [analysis, setAnalysis] = useState<TeamAnalysisState>(
    () => matchingSession ?? { kind: 'ready' },
  )
  const [lastCompleteAnalysis, setLastCompleteAnalysis] = useState<LastCompleteAnalysis | null>(
    matchingSession,
  )
  const [analysisSnapshot, setAnalysisSnapshot] = useState<TeamAnalysisSnapshot | null>(null)
  const [requestedSelectedId, setRequestedSelectedId] = useState<string | null>(
    () => matchingSession?.result.overviewUiState?.selectedId ?? null,
  )
  const [overviewFeedback, setOverviewFeedback] = useState<string | null>(null)
  const [preparingItemId, setPreparingItemId] = useState<string | null>(null)
  const [preparationError, setPreparationError] = useState<{
    runId: string
    itemId: string
    message: string
  } | null>(null)
  const prepareRequest = useRef(0)

  const {
    identityForRun,
    queryTeamOverview,
    queryTeamRoute,
    querySavedReplay,
    queueFitOverview,
    releasePreviousDetached,
    restoreFitOverview,
  } = useTeamPickerQueries({
    calculationClient,
    releaseRun,
    setAnalysis,
    setOverviewFeedback,
  })

  useEffect(() => {
    remainingRequest.current += 1
    remainingRunning.current = false
    return () => {
      remainingRequest.current += 1
      remainingRunning.current = false
    }
  }, [accountSummary?.accountId, accountSummary?.appSessionId])

  useEffect(
    () => () => {
      traceTeamRematch('picker.cleanup', {
        generation: analysisRequest.current,
        handled: reanalyzeHandled.current,
      })
      analysisRequest.current += 1
      // Effect replay cancels the queued start just like a real unmount. Allow
      // the next setup to resume the still-present URL request instead of
      // retaining a handled marker for work that never started.
      reanalyzeHandled.current = false
    },
    [],
  )

  const accountHydrating = !accountSummary || accountSummary.hydrating
  const savedTeamPlans = useLiveQuery(async () => {
    if (!accountSummary?.accountId) return []
    const plans = (await listAccountPlanningDrafts(accountSummary.accountId))
      .filter((plan) => plan.kind === 'team')
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const agentIds = new Set(
      plans.flatMap((plan) =>
        plan.teamPortfolioSnapshot
          ? plan.teamPortfolioSnapshot.executions.flatMap((execution) => execution.memberIds)
          : plan.selection.agentIds,
      ),
    )
    void preloadVisualEntityImages(
      [...agentIds].map((entityId) => ({
        entityType: 'agent' as const,
        entityId,
        slotId: 'agent.square-avatar' as const,
        consumer: 'box.team-overview' as const,
      })),
    )
    return plans
  }, [accountSummary?.accountId])

  const currentSavedPlanItems = (() => {
    if (
      decisionWorld.status !== 'current' ||
      !accountSummary?.accountId ||
      decisionWorld.run.input.warehouse.accountId !== accountSummary.accountId ||
      decisionWorld.run.snapshot.fingerprint.inputHash !== decisionWorld.liveFingerprint
    )
      return []
    const run = decisionWorld.run
    const presentation = acceptTeamOverviewPresentation(run.teamPresentation, {
      runId: run.runId,
      accountId: accountSummary.accountId,
      inputFingerprint: run.snapshot.fingerprint.inputHash,
      agentId: null,
      planId: null,
      discId: null,
    })
    if (!presentation) return []
    return presentation.overviewModel.groups
      .flatMap((group) => group.items)
      .flatMap((family) => family.variants)
      .filter((item) =>
        savedTeamPlans?.some(
          (plan) =>
            item.id === `saved:${plan.id}` &&
            run.input.drafts.some(
              (captured) => captured.id === plan.id && contentHash(captured) === contentHash(plan),
            ),
        ),
      )
  })()

  useEffect(
    () => () => {
      prepareRequest.current += 1
    },
    [accountSummary?.accountId, accountSummary?.appSessionId],
  )

  const restoreFitOverviewEvent = useEffectEvent(async (result: TeamAnalysisResult) => {
    await restoreFitOverview(result)
  })

  useEffect(() => {
    if (
      analysis.kind !== 'complete' ||
      analysis.result.sourceRunId ||
      analysis.result.fitOverviewModel ||
      !Object.keys(analysis.result.targetTeamFits).length ||
      decisionWorld.status !== 'current' ||
      decisionWorld.liveFingerprint !== analysis.result.inputFingerprint
    )
      return
    const result = analysis.result
    let active = true
    queueMicrotask(() => {
      if (active) void restoreFitOverviewEvent(result)
    })
    return () => {
      active = false
    }
  }, [analysis, decisionWorld.status, decisionWorld.liveFingerprint])

  const exceptionHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousAnalysisKind = useRef(analysis.kind)

  const { startAnalysis, startRemainingBoxAnalysis, reuseCurrentAnalysis } = useTeamAnalysisFlow({
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
  })

  const startRequestedAnalysis = useEffectEvent(startAnalysis)
  const reuseCurrentAnalysisEvent = useEffectEvent(reuseCurrentAnalysis)

  useEffect(() => {
    if (matchingSession && !matchingSessionFromMemory)
      setCurrentTeamAnalysisSession(matchingSession)
  }, [matchingSession, matchingSessionFromMemory])

  useEffect(() => {
    if (analysis.kind === 'unable' || analysis.kind === 'error')
      exceptionHeadingRef.current?.focus()
  }, [analysis.kind])

  useLayoutEffect(() => {
    const previousKind = previousAnalysisKind.current
    previousAnalysisKind.current = analysis.kind
    if (analysis.kind !== 'complete' && analysis.kind !== 'stale') return
    if (previousKind === 'complete' || previousKind === 'stale') return
    const scrollOwner = document.querySelector<HTMLElement>('[data-f5-scroll-owner]')
    scrollOwner?.scrollTo?.({ top: 0, left: 0 })
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>('.f5v-box-team-overview h1')?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [analysis.kind])

  useEffect(() => {
    if (!accountSummary || accountSummary.hydrating) return
    const sessionAccountId = currentTeamAnalysisSession?.result.warehouse.accountId ?? null
    const sessionAppId = currentTeamAnalysisSession?.result.appSessionId ?? null
    if (
      (sessionAppId && sessionAppId !== accountSummary.appSessionId) ||
      (sessionAccountId && sessionAccountId !== accountSummary.accountId)
    ) {
      setCurrentTeamAnalysisSession(null)
      return
    }
  }, [accountSummary])

  useEffect(() => {
    if (
      analysis.kind !== 'complete' ||
      (decisionWorld.status === 'current' &&
        decisionWorld.run.runId === (analysis.result.sourceRunId ?? analysis.result.analysisRunId))
    )
      return
    const timer = window.setTimeout(() => {
      const sessionResult = currentTeamAnalysisSession?.result
      const next = {
        kind: 'stale' as const,
        result: {
          ...analysis.result,
          overviewUiState:
            sessionResult?.analysisRunId === analysis.result.analysisRunId &&
            sessionResult.appSessionId === analysis.result.appSessionId &&
            sessionResult.warehouse.accountId === analysis.result.warehouse.accountId
              ? sessionResult.overviewUiState
              : analysis.result.overviewUiState,
        },
      }
      setCurrentTeamAnalysisSession(next)
      setLastCompleteAnalysis(next)
      setAnalysis(next)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [analysis, decisionWorld])

  useEffect(() => {
    if (!reanalyzeRequested) {
      traceTeamRematch('picker.reanalyze.reject.no_url_request', {
        generation: analysisRequest.current,
      })
      reanalyzeHandled.current = false
      return
    }
    traceTeamRematch('picker.reanalyze.effect', {
      handled: reanalyzeHandled.current,
      hydrating: accountHydrating,
      worldStatus: decisionWorld.status,
      generation: analysisRequest.current,
      hasTeamId: Boolean(params.get('rematchTeam')),
      hasPlanId: Boolean(params.get('rematchPlan')),
    })
    if (reanalyzeHandled.current || accountHydrating) return
    if (decisionWorld.status === 'loading') return
    reanalyzeHandled.current = true
    rematchRequest.current = {
      planId: params.get('rematchPlan'),
      teamId: params.get('rematchTeam'),
    }
    navigate('/loadouts/team', { replace: true })
    const request = analysisRequest.current
    traceTeamRematch('picker.start.queued', {
      generation: request,
      hasRequest: Boolean(rematchRequest.current),
    })
    queueMicrotask(() => {
      traceTeamRematch('picker.start.microtask', {
        expected: request,
        actual: analysisRequest.current,
        current: request === analysisRequest.current,
      })
      if (request !== analysisRequest.current) return
      void reuseCurrentAnalysisEvent()
        .then((reused) => {
          traceTeamRematch('picker.reuse.return', {
            reused,
            current: request === analysisRequest.current,
          })
          if (request !== analysisRequest.current) return
          if (!reused) void startRequestedAnalysis()
        })
        .catch(() => {
          traceTeamRematch('picker.reuse.error', { current: request === analysisRequest.current })
          if (request === analysisRequest.current) void startRequestedAnalysis()
        })
    })
  }, [accountHydrating, decisionWorld.status, navigate, params, reanalyzeRequested])

  const hardConstraintPanel = decisionWorld.run?.snapshot.hardConstraints.canRestoreDefault ? (
    <TeamConstraintResetPanel
      accountId={accountSummary?.accountId}
      activeCount={decisionWorld.run.snapshot.hardConstraints.active.length}
      teamCount={decisionWorld.run.input.preference.teamCount}
    />
  ) : null

  const remainingBoxSelector = (
    <TeamRemainingBoxSelector
      savedTeamPlans={savedTeamPlans}
      decisionWorld={decisionWorld}
      reservedPlanIds={reservedPlanIds}
      setReservedPlanIds={setReservedPlanIds}
      remainingBoxOpen={remainingBoxOpen}
      setRemainingBoxOpen={setRemainingBoxOpen}
      onStartRemainingBoxAnalysis={() => void startRemainingBoxAnalysis()}
      analysisRunning={analysis.kind === 'running'}
      remainingBoxError={remainingBoxError}
    />
  )

  if (analysis.kind === 'ready') {
    return (
      <TeamAnalysisReady
        accountHydrating={accountHydrating}
        accountSummary={accountSummary}
        hardConstraintPanel={hardConstraintPanel}
        remainingBoxSelector={remainingBoxSelector}
        onStartAnalysis={startAnalysis}
        savedTeamPlans={savedTeamPlans}
        currentSavedPlanItems={currentSavedPlanItems}
        savedPlanWarehouse={savedPlanWarehouse ?? undefined}
        onOpenPlan={(planId) => navigate(`/loadouts/plans/${encodeURIComponent(planId)}`)}
      />
    )
  }

  if (analysis.kind === 'running') {
    return <TeamAnalysisRunning stage={analysis.stage} analysisSnapshot={analysisSnapshot} />
  }

  if (analysis.kind === 'unable') {
    return (
      <TeamAnalysisUnable
        reason={analysis.reason}
        analysisSnapshot={analysisSnapshot}
        accountSummary={accountSummary}
        exceptionHeadingRef={exceptionHeadingRef}
        onResetReady={() => setAnalysis({ kind: 'ready' })}
      />
    )
  }

  if (analysis.kind === 'error') {
    return (
      <TeamAnalysisError
        message={analysis.message}
        exceptionHeadingRef={exceptionHeadingRef}
        onStartAnalysis={startAnalysis}
        lastCompleteAnalysis={lastCompleteAnalysis}
        onRestoreLastComplete={() => {
          if (lastCompleteAnalysis) setAnalysis(lastCompleteAnalysis)
        }}
      />
    )
  }

  return (
    <TeamAnalysisOverviewView
      analysis={analysis}
      decisionWorld={decisionWorld}
      accountSummary={accountSummary}
      hardConstraintPanel={hardConstraintPanel}
      remainingBoxSelector={remainingBoxSelector}
      requestedSelectedId={requestedSelectedId}
      setRequestedSelectedId={setRequestedSelectedId}
      overviewFeedback={overviewFeedback}
      setOverviewFeedback={setOverviewFeedback}
      preparingItemId={preparingItemId}
      setPreparingItemId={setPreparingItemId}
      preparationError={preparationError}
      setPreparationError={setPreparationError}
      prepareRequest={prepareRequest}
      analysisRequest={analysisRequest}
      queryTeamRoute={queryTeamRoute}
      calculateTargetTeamWarehouseFit={calculateTargetTeamWarehouseFit}
      queueFitOverview={queueFitOverview}
      startAnalysis={startAnalysis}
      startRemainingBoxAnalysis={startRemainingBoxAnalysis}
      setAnalysis={setAnalysis}
      setLastCompleteAnalysis={setLastCompleteAnalysis}
    />
  )
}
