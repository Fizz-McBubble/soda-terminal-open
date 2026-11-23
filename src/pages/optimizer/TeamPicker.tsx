import {
  lazy,
  Suspense,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
import type { AccountDecisionRun } from '../../application/calculationQueryContract'
import { browserCalculationInputFingerprint } from '../../application/browserCalculationInputFingerprint'
import { preloadVisualEntityImages } from '../../assets/visualEntityImageSource'
import { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { AppLoadingState } from '../../components/AppEntryState'
import { TeamConstraintResetPanel } from '../TeamLoadoutOverviewParts'
import {
  canRestoreCurrentTeamAnalysisSession,
  currentDecisionWorldForRecovery,
  currentFullTeamOverview,
  reconcileEquivalentTeamAnalysis,
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
import {
  TeamAnalysisError,
  TeamAnalysisReady,
  TeamAnalysisRunning,
  TeamAnalysisUnable,
} from './TeamAnalysisStates'
import { TeamRemainingBoxSelector } from './TeamRemainingBoxSelector'
import { useTeamAnalysisFlow } from './useTeamAnalysisFlow'
import { traceTeamRematch } from './teamRematchTrace'
import { useSavedPlanEditorRefresh } from '../planEditorSessionRefresh'
import { useTeamPickerQueries } from './useTeamPickerQueries'
import { matchingCapturedSavedPlanIds } from './teamSavedPlanIdentity'
import '../team-loadout-analysis-entry.css'
import '../team-loadout-journey.css'
import '../team-loadout-remaining-box.css'

const loadTeamAnalysisOverview = () =>
  import('./TeamAnalysisOverviewView').then(({ TeamAnalysisOverviewView }) => ({
    default: TeamAnalysisOverviewView,
  }))
const TeamAnalysisOverviewView = lazy(loadTeamAnalysisOverview)

export function TeamPicker() {
  const accountSummary = useF5AccountSummary()
  const world = useAccountDecisionWorld()
  const currentKey = JSON.stringify([
    accountSummary?.appSessionId ?? null,
    accountSummary?.accountId ?? null,
  ])
  const [scopeKey, setScopeKey] = useState(currentKey)
  // Temporary account hydration does not throw away same-account browsing state.
  if (accountSummary && !accountSummary.hydrating && currentKey !== scopeKey)
    setScopeKey(currentKey)
  const worldAccountId = world.liveInput?.warehouse.accountId
  const scopeAccountId = (JSON.parse(scopeKey) as [string | null, string | null])[1]
  if (
    worldAccountId &&
    ((scopeAccountId && worldAccountId !== scopeAccountId) ||
      (accountSummary && !accountSummary.hydrating && worldAccountId !== accountSummary.accountId))
  )
    return <AppLoadingState title="正在读取当前账户" />
  return <TeamPickerAccountScope key={scopeKey} />
}

function TeamPickerAccountScope() {
  const navigate = useNavigate()
  const savedReceipt = useLocation().state?.savedPlan
  const accountSummary = useF5AccountSummary()
  const accountHydrating = !accountSummary || accountSummary.hydrating
  const savedPlanWarehouse = useLiveQuery(() => loadCoreWarehouse(), [accountSummary?.accountId])
  const decisionWorld = useAccountDecisionWorld()
  const calculationClient = useContext(CalculationQueryClientContext)
  const calculateDetached = useDetachedAccountDecisionCalculation()
  const calculateTargetTeamWarehouseFit = useTargetTeamWarehouseFitCalculation()
  const releaseRun = useReleaseAccountDecisionRun()

  const [reservedPlanIds, setReservedPlanIds] = useState<string[]>(() => {
    const session = currentTeamAnalysisSession
    return session &&
      accountSummary &&
      !accountSummary.hydrating &&
      session.result.warehouse.accountId === accountSummary.accountId &&
      session.result.appSessionId === accountSummary.appSessionId
      ? (session.result.reservations?.map((item) => item.planId) ?? [])
      : []
  })
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
  useEffect(() => {
    if (analysis.kind !== 'running') return
    // Warm the current result page while the Worker runs. Individual team
    // routes and their solver dependencies load when the player opens a team.
    void loadTeamAnalysisOverview().catch(() => undefined)
  }, [analysis.kind])
  useEffect(() => {
    if (accountHydrating || !accountSummary?.accountId || analysis.kind !== 'ready') return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      const recovered = currentTeamAnalysisSession
      if (
        !recovered ||
        recovered.result.appSessionId !== accountSummary.appSessionId ||
        recovered.result.warehouse.accountId !== accountSummary.accountId
      )
        return
      setAnalysis(recovered)
      setLastCompleteAnalysis(recovered)
      setReservedPlanIds(recovered.result.reservations?.map((item) => item.planId) ?? [])
    })
    return () => {
      active = false
    }
  }, [accountHydrating, accountSummary?.accountId, accountSummary?.appSessionId, analysis.kind])
  useSavedPlanEditorRefresh({
    analysis,
    account: accountSummary,
    world: decisionWorld,
    releaseRun,
    setAnalysis,
    setLastCompleteAnalysis,
    calculationClient,
  })
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

  useLayoutEffect(() => {
    remainingRequest.current += 1
    remainingRunning.current = false
    return () => {
      remainingRequest.current += 1
      remainingRunning.current = false
    }
  }, [accountSummary?.accountId, accountSummary?.appSessionId])

  useLayoutEffect(
    () => () => {
      traceTeamRematch('picker.cleanup', {
        generation: analysisRequest.current,
        handled: reanalyzeHandled.current,
      })
      analysisRequest.current += 1
      prepareRequest.current += 1
      // Effect replay cancels the queued start just like a real unmount. Allow
      // the next setup to resume the still-present URL request instead of
      // retaining a handled marker for work that never started.
      reanalyzeHandled.current = false
    },
    [],
  )

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

  const currentRun = decisionWorld.status === 'current' ? decisionWorld.run : null
  const currentRunOverviewIdentity =
    currentRun &&
    currentRun.input.warehouse.accountId === accountSummary?.accountId &&
    currentRun.snapshot.fingerprint.inputHash === decisionWorld.liveFingerprint
      ? `${currentRun.runId}:${currentRun.snapshot.fingerprint.inputHash}`
      : null
  const [currentRunOverview, setCurrentRunOverview] = useState<
    { identity: string; overviewModel: TeamAnalysisResult['overviewModel'] | null } | undefined
  >()
  const eagerCurrentRunOverview =
    currentRun && currentRunOverviewIdentity
      ? currentFullTeamOverview(currentRun, analysis, accountSummary?.appSessionId)
      : undefined
  const currentRunOverviewModel =
    eagerCurrentRunOverview ??
    (currentRunOverview?.identity === currentRunOverviewIdentity
      ? currentRunOverview.overviewModel
      : null)
  const queryCurrentRunOverview = useEffectEvent((run: AccountDecisionRun) =>
    queryTeamOverview(identityForRun(run), {
      agentId: null,
      planId: null,
      discId: null,
    }),
  )
  useEffect(() => {
    if (
      !currentRun ||
      !currentRunOverviewIdentity ||
      eagerCurrentRunOverview ||
      currentRunOverview?.identity === currentRunOverviewIdentity ||
      !savedTeamPlans?.length
    )
      return
    let active = true
    void queryCurrentRunOverview(currentRun)
      .then((overviewModel) => {
        if (active) setCurrentRunOverview({ identity: currentRunOverviewIdentity, overviewModel })
      })
      .catch(() => {
        if (active)
          setCurrentRunOverview({ identity: currentRunOverviewIdentity, overviewModel: null })
      })
    return () => {
      active = false
    }
  }, [
    currentRunOverview?.identity,
    currentRunOverviewIdentity,
    currentRun,
    eagerCurrentRunOverview,
    savedTeamPlans?.length,
  ])

  const currentSavedPlanIds = useMemo(() => {
    if (
      decisionWorld.status !== 'current' ||
      !accountSummary?.accountId ||
      decisionWorld.run.input.warehouse.accountId !== accountSummary.accountId ||
      decisionWorld.run.snapshot.fingerprint.inputHash !== decisionWorld.liveFingerprint
    )
      return new Set<string>()
    return matchingCapturedSavedPlanIds(savedTeamPlans ?? [], decisionWorld.run.input.drafts)
  }, [
    accountSummary?.accountId,
    decisionWorld.liveFingerprint,
    decisionWorld.run,
    decisionWorld.status,
    savedTeamPlans,
  ])
  const currentSavedPlanItems = useMemo(() => {
    if (!currentRunOverviewModel) return []
    return currentRunOverviewModel.groups
      .flatMap((group) => group.items)
      .flatMap((family) => family.variants)
      .filter(
        (item) =>
          item.id.startsWith('saved:') && currentSavedPlanIds.has(item.id.slice('saved:'.length)),
      )
  }, [currentRunOverviewModel, currentSavedPlanIds])

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

  const { startAnalysis, cancelAnalysis, startRemainingBoxAnalysis } = useTeamAnalysisFlow({
    accountSummary,
    decisionWorld,
    autoStartOnEntry: false,
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
      document
        .querySelector<HTMLElement>('.f5v-box-team-overview h1, .workbench-empty-state h1')
        ?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [analysis.kind])

  useLayoutEffect(() => {
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
    if (analysis.kind !== 'complete') return
    const { result } = analysis
    const liveInput = decisionWorld.liveInput
    const factualInputChanged = Boolean(
      liveInput &&
      liveInput.warehouse.accountId === result.warehouse.accountId &&
      result.inputReadFingerprint &&
      browserCalculationInputFingerprint(liveInput) !== result.inputReadFingerprint,
    )
    const decisionInputChanged =
      (decisionWorld.status === 'current' || decisionWorld.status === 'stale') &&
      decisionWorld.run.input.warehouse.accountId === result.warehouse.accountId &&
      decisionWorld.liveFingerprint !== result.inputFingerprint
    if (!factualInputChanged && !decisionInputChanged) return
    const timer = window.setTimeout(() => {
      const sessionResult = currentTeamAnalysisSession?.result
      const next = {
        kind: 'stale' as const,
        reason: 'world_transition' as const,
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

  // A temporary loading state or an equivalent replacement run is not an
  // account change. Reuse only a current run with the same account and input;
  // new-run projections must be queried again because the old run was released.
  const queryEquivalentOverview = useEffectEvent(
    (run: AccountDecisionRun, result: TeamAnalysisResult) =>
      queryTeamOverview(
        identityForRun(run),
        result.presentationContext ?? { agentId: null, planId: null, discId: null },
      ),
  )
  useEffect(() => {
    if (
      (analysis.kind !== 'complete' && analysis.kind !== 'stale') ||
      (analysis.kind === 'stale' && analysis.reason !== 'world_transition') ||
      accountHydrating ||
      !accountSummary?.accountId ||
      decisionWorld.status !== 'current'
    )
      return
    const { result } = analysis
    const { run, liveFingerprint } = decisionWorld
    if (
      result.appSessionId !== accountSummary.appSessionId ||
      result.warehouse.accountId !== accountSummary.accountId ||
      run.input.warehouse.accountId !== accountSummary.accountId ||
      result.inputFingerprint !== liveFingerprint ||
      run.inputFingerprint !== liveFingerprint ||
      run.snapshot.fingerprint.inputHash !== liveFingerprint
    )
      return

    const previousSourceId = result.sourceRunId ?? result.analysisRunId
    if (run.runId === previousSourceId && analysis.kind === 'complete') return
    // A detached remaining-BOX run depends on its original source run and
    // cannot be rebound as an ordinary full-account recommendation.
    if (run.runId !== previousSourceId && result.sourceRunId) return

    let active = true
    void (async () => {
      const overviewModel =
        run.runId === previousSourceId
          ? result.overviewModel
          : await queryEquivalentOverview(run, result)
      if (!active) return
      const session = currentTeamAnalysisSession
      if (
        session?.result.appSessionId !== result.appSessionId ||
        session.result.warehouse.accountId !== result.warehouse.accountId ||
        session.result.analysisRunId !== result.analysisRunId ||
        session.result.inputFingerprint !== result.inputFingerprint
      )
        return
      const next = reconcileEquivalentTeamAnalysis(
        session,
        { accountId: accountSummary.accountId!, appSessionId: accountSummary.appSessionId },
        { status: 'current', run, liveFingerprint },
        overviewModel,
      )
      if (!next) return
      setCurrentTeamAnalysisSession(next)
      setLastCompleteAnalysis(next)
      setAnalysis(next)
    })().catch(() => undefined)
    return () => {
      active = false
    }
  }, [analysis, accountHydrating, accountSummary, decisionWorld])

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
      void startRequestedAnalysis({ forceRefresh: true })
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

  // A save commits before its replacement analysis finishes. Show the existing
  // live saved-plan list until the full BOX overview includes that record.
  // A detached remaining-BOX overview intentionally omits reserved teams.
  const awaitingSavedOverview =
    (analysis.kind === 'complete' || analysis.kind === 'stale') &&
    !analysis.result.reservations?.length &&
    typeof savedReceipt?.id === 'string' &&
    savedReceipt.accountId === accountSummary?.accountId &&
    (!savedTeamPlans || savedTeamPlans.some((plan) => plan.id === savedReceipt.id)) &&
    (decisionWorld.run?.runId !== analysis.result.analysisRunId ||
      !currentSavedPlanIds.has(savedReceipt.id) ||
      !analysis.result.overviewModel.groups.some(
        (group) =>
          group.kind === 'saved' &&
          group.items.some((family) =>
            family.variants.some((item) => item.id === `saved:${savedReceipt.id}`),
          ),
      ))
  if (analysis.kind === 'ready' || awaitingSavedOverview) {
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
    return (
      <TeamAnalysisRunning
        stage={analysis.stage}
        analysisSnapshot={analysisSnapshot}
        onCancel={cancelAnalysis}
      />
    )
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
    <Suspense fallback={<AppLoadingState title="正在打开队伍建议" />}>
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
    </Suspense>
  )
}
