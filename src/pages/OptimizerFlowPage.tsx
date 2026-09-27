import { SavedPortfolioPlan } from './savedPlanPresentation'
import {
  savedTeamTargetFitMatchesSavedDiscs,
  savedTeamDiscAssignmentFingerprint,
} from './savedPlanIdentity'
import { AgentPicker, AgentPlan } from './AgentLoadoutRoutes'
import {
  teamAnalysisStages,
  canRestoreCurrentTeamAnalysisSession,
  currentDecisionWorldForRecovery,
  restoreCurrentTeamAnalysisSession,
  waitForAnalysisStage,
  retainTeamAnalysisAfterSavedPlanDeletion,
  currentTeamOverviewFromQuery,
} from './teamAnalysisRecovery'
import { setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import { savedPlanDisplayName } from '../application/savedPlanDisplayName'
import { preloadVisualEntityImages } from '../assets/visualEntityImageSource'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { loadCoreWarehouse, type CoreWarehouse } from '../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../accounts/types'
import {
  deleteAccountPlanningDraft,
  getAccountPlanningDraft,
  listAccountPlanningDrafts,
} from '../accounts/planningDrafts'
import {
  inspectSavedTeamPortfolioPlanSnapshotFreshness,
  inspectSavedTeamPlanSnapshotFreshness,
} from '../application/publicSavedPlanFreshness'
import {
  buildSavedTeamPlanSolutionFingerprintFromComponents,
  buildSavedTeamPortfolioPlanSolutionFingerprintFromComponents,
  localPrivateNonPlanningComponents,
} from '../application/publicSavedTeamSolutionFingerprint'
import { buildExactTeamVariantKey } from '../accounts/planningSolutionContext'
import { getAgentName } from '../application/publicRosterNames'
import {
  useAccountDecisionWorld,
  useDetachedAccountDecisionCalculation,
  useReleaseAccountDecisionRun,
  useTargetTeamWarehouseFitCalculation,
  CalculationQueryClientContext,
} from '../application/accountDecisionWorldHooks'
import { prepareRemainingBox, remainingBoxPlanReservation } from '../application/remainingBox'
import type {
  AccountDecisionRun,
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { LegacyOptimizerRouteRedirect, LegacyResultRedirect } from './OptimizerFlowSupport'
import { contentHash } from '../application/contentHash'
import { TeamLoadoutOverview } from './TeamLoadoutOverview'
import { TeamConstraintResetPanel, TeamSavedPlanList } from './TeamLoadoutOverviewParts'
import { InvalidPlan } from './InvalidPlan'
import { PlanningDialog } from './TeamSolverWorkspaceParts'
import { decisionTeamViewModel } from './teamLoadoutDecisionViewModel'
import { targetTeamEquipmentParametersFingerprint } from '../application/publicTargetTeamEquipmentFingerprint'
import { useF5AccountSummary } from '../components/f5AccountSummaryContext'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { SavedOverviewDeleteDialog } from './SavedOverviewDeleteDialog'
import { savedPlanStaleNotice } from '../application/publicSavedPlanStaleNotice'
import {
  acceptSavedTeamReplayPresentation,
  savedTeamReplayPlanHash,
  type SavedTeamReplayPresentation,
} from '../application/publicSavedTeamReplay'
import {
  acceptSavedTeamSolutionComponents,
  projectedSavedTeamInputHash,
  type SavedTeamSolutionComponents,
} from '../application/publicSavedTeamSolutionComponents'
import './team-loadout-analysis-entry.css'
import './team-loadout-journey.css'
import './team-loadout-remaining-box.css'
import { TeamPlan } from './TeamPlan'
import { acceptTeamRoutePresentation } from './publicTeamRoutePresentation'
import { PlanningProfileContext } from './planningProfile'
import {
  type TeamAnalysisResult,
  type TeamAnalysisState,
  type TeamAnalysisSnapshot,
  type LastCompleteAnalysis,
  currentTeamAnalysisSession,
} from './teamAnalysisSession'
import { PlanEditor } from './PlanEditor'
import { currentSavedTeamRatingLabel } from './savedTeamRatingPresentation'
import {
  acceptTeamOverviewPresentation,
  type TeamPresentationIdentity,
} from './teamLoadoutPresentationDto'

export function OptimizerFlowPage() {
  const location = useLocation()
  if (location.pathname.startsWith('/optimizer')) return <LegacyOptimizerRouteRedirect />
  if (location.pathname === '/loadouts/team') return <TeamPicker />
  return <OptimizerFlowWorkspace />
}

function OptimizerFlowWorkspace() {
  const location = useLocation()
  const accountSummary = useF5AccountSummary()
  const decisionWorld = useAccountDecisionWorld()
  const liveWarehouse = useLiveQuery(() => loadCoreWarehouse(), [])
  const isTeamDetail =
    location.pathname.startsWith('/loadouts/team/') && !location.pathname.endsWith('/result')
  const isSavedDetail = location.pathname.startsWith('/loadouts/plans/')
  const currentDecisionWorld = currentDecisionWorldForRecovery(decisionWorld)
  const teamKey = isTeamDetail
    ? decodeURIComponent(location.pathname.slice('/loadouts/team/'.length).split('/')[0] ?? '')
    : null
  const sessionFromMemory =
    isTeamDetail &&
    accountSummary &&
    currentTeamAnalysisSession?.result.appSessionId === accountSummary.appSessionId &&
    currentTeamAnalysisSession.result.warehouse.accountId === accountSummary.accountId
      ? currentTeamAnalysisSession
      : null
  const canRestoreCurrentRun = canRestoreCurrentTeamAnalysisSession(
    accountSummary,
    currentDecisionWorld,
  )
  const restoredSession =
    !sessionFromMemory && canRestoreCurrentRun && currentDecisionWorld
      ? restoreCurrentTeamAnalysisSession(accountSummary!, currentDecisionWorld, teamKey)
      : null
  const session = sessionFromMemory ?? restoredSession
  useEffect(() => {
    if (restoredSession) setCurrentTeamAnalysisSession(restoredSession)
  }, [restoredSession])
  if (
    (isTeamDetail || isSavedDetail) &&
    (!accountSummary ||
      accountSummary.hydrating ||
      ((isTeamDetail || isSavedDetail) && decisionWorld.status === 'loading'))
  )
    return (
      <section className="panel result-empty" aria-live="polite">
        <h1>正在读取当前账户</h1>
      </section>
    )
  if (isTeamDetail && !session)
    return (
      <section className="f5v-box-analysis-entry f5v-box-analysis-entry--exception" role="status">
        <h1>{canRestoreCurrentRun ? '当前方案不在本次分析中' : '本次分析已结束'}</h1>
        <p>
          {canRestoreCurrentRun
            ? '当前分析仍可恢复，请返回当前队伍建议选择方案。'
            : '未保存的结果不会保留。请返回队伍配装并重新分析当前队伍。'}
        </p>
        <Link className="f5v-box-analysis-entry__action" to="/loadouts/team">
          {canRestoreCurrentRun ? '返回当前队伍建议' : '返回队伍配装'}
        </Link>
      </section>
    )
  const warehouse = session?.result.warehouse ?? decisionWorld.run?.input.warehouse ?? liveWarehouse
  if (!warehouse)
    return (
      <section className="panel result-empty" aria-live="polite">
        <h1>正在读取当前账户</h1>
      </section>
    )
  if (!warehouse.accountId) return <AccountRequiredState title="先创建或选择账户" />
  if (location.pathname === '/loadouts/agent') return <AgentPicker warehouse={warehouse} />
  if (location.pathname.startsWith('/loadouts/plans/'))
    return (
      <SavedPlan
        key={`${warehouse.accountId}:${location.pathname}`}
        warehouse={warehouse}
        decision={decisionWorld.run?.snapshot}
        readOnly={decisionWorld.status !== 'current'}
      />
    )
  if (location.pathname.includes('/result')) return <LegacyResultRedirect />
  return location.pathname.startsWith('/loadouts/team/') ? (
    <TeamPlan
      warehouse={warehouse}
      decision={session?.result.decisionSnapshot}
      analysisRunId={session?.result.analysisRunId}
      targetTeamFits={session?.result.targetTeamFits}
      readOnly={
        session?.kind === 'stale' ||
        decisionWorld.status === 'stale' ||
        Boolean(
          session?.result.sourceRunId &&
          session.result.inputFingerprint !== decisionWorld.liveFingerprint,
        )
      }
    />
  ) : (
    <AgentPlan warehouse={warehouse} />
  )
}

function TeamPicker() {
  const navigate = useNavigate()
  const accountSummary = useF5AccountSummary()
  const savedPlanWarehouse = useLiveQuery(() => loadCoreWarehouse(), [accountSummary?.accountId])
  const decisionWorld = useAccountDecisionWorld()
  const calculationClient = useContext(CalculationQueryClientContext)
  const calculateDetached = useDetachedAccountDecisionCalculation()
  const calculateTargetTeamWarehouseFit = useTargetTeamWarehouseFitCalculation()
  const releaseRun = useReleaseAccountDecisionRun()
  const identityForRun = (run: AccountDecisionRun): TeamPresentationIdentity => ({
    runId: run.runId,
    accountId: run.input.warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
  })
  const queryTeamOverview = async (
    identity: TeamPresentationIdentity,
    context: { agentId: string | null; planId: string | null; discId: string | null },
    sourceRunId?: string,
    selectedPlanIds?: string[],
    fitCandidateIds?: string[],
  ) => {
    if (!calculationClient) throw new Error('当前分析服务不可用，请重试。')
    const projected = await calculationClient.queryTeamOverviewPresentation({
      contractVersion: calculationQueryContractVersion,
      kind: 'team_overview_presentation',
      runId: identity.runId,
      context,
      sourceRunId,
      reservedPlanIds: selectedPlanIds,
      fitCandidateIds,
    })
    const accepted = acceptTeamOverviewPresentation(projected, {
      ...identity,
      ...context,
    })
    if (!accepted) throw new Error('队伍展示结果缺失或已过期，请重新分析当前队伍。')
    return accepted.overviewModel
  }
  const queryFitOverview = (
    result: TeamAnalysisResult,
    fits: Record<string, TargetTeamWarehouseFitQueryResult>,
  ) =>
    queryTeamOverview(
      {
        runId: result.analysisRunId,
        accountId: result.warehouse.accountId ?? '',
        inputFingerprint: result.decisionSnapshot.fingerprint.inputHash,
      },
      result.presentationContext ?? { agentId: null, planId: null, discId: null },
      result.sourceRunId,
      result.reservations?.map((reservation) => reservation.planId),
      Object.values(fits).map((fit) => fit.candidateId),
    )
  const queryTeamRoute = async (result: TeamAnalysisResult, candidateId: string) => {
    if (!calculationClient) throw new Error('当前分析服务不可用，请重试。')
    const route = await calculationClient.queryTeamRoutePresentation({
      contractVersion: calculationQueryContractVersion,
      kind: 'team_route_presentation',
      runId: result.analysisRunId,
      candidateId,
    })
    const accepted = acceptTeamRoutePresentation(route, {
      runId: result.analysisRunId,
      accountId: result.warehouse.accountId ?? '',
      inputFingerprint: result.decisionSnapshot.fingerprint.inputHash,
      candidateId,
    })
    if (!accepted) throw new Error('队伍详情已变化，请重新分析当前队伍。')
    const session = currentTeamAnalysisSession
    if (
      session?.result.analysisRunId === result.analysisRunId &&
      session.result.inputFingerprint === result.inputFingerprint
    )
      setCurrentTeamAnalysisSession({
        ...session,
        result: {
          ...session.result,
          teamRoutePresentations: {
            ...session.result.teamRoutePresentations,
            [candidateId]: accepted,
          },
        },
      })
    return accepted
  }
  const querySavedReplay = async (result: TeamAnalysisResult, plan: AccountPlanningDraft) => {
    if (!calculationClient) throw new Error('当前分析服务不可用，请重试。')
    const planHash = savedTeamReplayPlanHash(plan)
    const projected = await calculationClient.querySavedTeamPlanReplay({
      contractVersion: calculationQueryContractVersion,
      kind: 'saved_team_plan_replay',
      runId: result.analysisRunId,
      planId: plan.id,
      planHash,
    })
    const accepted = acceptSavedTeamReplayPresentation(projected, {
      runId: result.analysisRunId,
      accountId: result.warehouse.accountId ?? '',
      inputFingerprint: result.decisionSnapshot.fingerprint.inputHash,
      planId: plan.id,
      planHash,
    })
    if (!accepted) throw new Error('已保存方案重放结果缺失或过期。')
    return accepted
  }
  const queueFitOverview = (
    result: TeamAnalysisResult,
    fits: Record<string, TargetTeamWarehouseFitQueryResult>,
  ) => {
    if (result.sourceRunId) return
    void queryFitOverview(result, fits)
      .then((model) => {
        const active = currentTeamAnalysisSession
        if (
          active?.result.analysisRunId !== result.analysisRunId ||
          active.result.inputFingerprint !== result.inputFingerprint ||
          Object.values(active.result.targetTeamFits)
            .map((fit) => fit.candidateId)
            .join('|') !==
            Object.values(fits)
              .map((fit) => fit.candidateId)
              .join('|')
        )
          return
        setCurrentTeamAnalysisSession({
          ...active,
          result: { ...active.result, fitOverviewModel: model },
        })
      })
      .catch(() => undefined)
  }
  const releasePreviousDetached = (nextRunId: string) => {
    const previous = currentTeamAnalysisSession?.result
    if (previous?.sourceRunId && previous.analysisRunId !== nextRunId)
      releaseRun(previous.analysisRunId)
  }
  const [reservedPlanIds, setReservedPlanIds] = useState<string[]>(
    () => currentTeamAnalysisSession?.result.reservations?.map((item) => item.planId) ?? [],
  )
  const [remainingBoxError, setRemainingBoxError] = useState<string | null>(null)
  const [remainingBoxOpen, setRemainingBoxOpen] = useState(false)
  const remainingRequest = useRef(0)
  const analysisRequest = useRef(0)
  const remainingRunning = useRef(false)
  useEffect(() => {
    remainingRequest.current += 1
    remainingRunning.current = false
    return () => {
      remainingRequest.current += 1
      remainingRunning.current = false
    }
  }, [accountSummary?.accountId, accountSummary?.appSessionId])
  // Account switches already remount this subtree through the world's account key.
  // Initial summary hydration must not invalidate a request for that same account.
  useEffect(
    () => () => {
      analysisRequest.current += 1
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
  const [params] = useSearchParams()
  const contextAgentId = params.get('agent')
  const contextPlanId = params.get('plan')
  const contextDiscId = params.get('discId')
  const reanalyzeRequested = params.get('reanalyze') === '1'
  const rematchRequest = useRef<{ planId: string | null; teamId: string | null } | null>(null)
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
  const [pendingDelete, setPendingDelete] = useState<TeamLoadoutOverviewItem | null>(null)
  const [overviewFeedback, setOverviewFeedback] = useState<string | null>(null)
  const [preparingItemId, setPreparingItemId] = useState<string | null>(null)
  const [preparationError, setPreparationError] = useState<{
    runId: string
    itemId: string
    message: string
  } | null>(null)
  const prepareRequest = useRef(0)
  useEffect(
    () => () => {
      prepareRequest.current += 1
    },
    [accountSummary?.accountId, accountSummary?.appSessionId],
  )
  const restoreFitOverview = useEffectEvent(async (result: TeamAnalysisResult) => {
    try {
      const model = await queryFitOverview(result, result.targetTeamFits)
      const active = currentTeamAnalysisSession
      if (
        active?.result.analysisRunId !== result.analysisRunId ||
        active.result.inputFingerprint !== result.inputFingerprint
      )
        return
      const updated = { ...active, result: { ...active.result, fitOverviewModel: model } }
      setCurrentTeamAnalysisSession(updated)
      setAnalysis((previous) =>
        previous.kind === 'complete' &&
        previous.result.analysisRunId === result.analysisRunId &&
        previous.result.inputFingerprint === result.inputFingerprint
          ? { ...previous, result: { ...previous.result, fitOverviewModel: model } }
          : previous,
      )
    } catch {
      setOverviewFeedback('队伍配装结果已变化，请重新分析后查看最新建议。')
    }
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
      if (active) void restoreFitOverview(result)
    })
    return () => {
      active = false
    }
  }, [analysis, decisionWorld.status, decisionWorld.liveFingerprint])
  const exceptionHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousAnalysisKind = useRef(analysis.kind)
  const reanalyzeHandled = useRef(false)
  const continueRematch = async (
    result: TeamAnalysisResult,
    plans: NonNullable<typeof savedTeamPlans>,
  ) => {
    const request = rematchRequest.current
    if (!request) return
    rematchRequest.current = null
    const plan = plans.find((item) => item.id === request.planId)
    const match = plan ? (await querySavedReplay(result, plan).catch(() => null))?.match : undefined
    const candidateId = request.planId
      ? match?.buildIntent?.exactTeam.candidateId
      : request.teamId
        ? result.overviewModel.groups
            .flatMap((group) => group.items.flatMap((family) => family.variants))
            .find((variant) => variant.detailCandidateId === request.teamId)?.detailCandidateId
        : undefined
    if (candidateId) {
      const entry = await queryTeamRoute(result, candidateId).catch(() => null)
      if (!entry) {
        setOverviewFeedback('队伍详情已变化，请重新分析后再配装。')
        return
      }
      if (!entry.team || !entry.targetCandidateId) {
        setOverviewFeedback('这支队伍暂不能生成配装，请重新选择搭配。')
        return
      }
      const destination = `/loadouts/team/${encodeURIComponent(candidateId)}`
      if (!entry.team.bangbooId && !entry.automaticBangboo) {
        navigate(destination, { replace: true })
        return
      }
      const generation = ++prepareRequest.current
      setPreparingItemId(candidateId)
      setPreparationError(null)
      setOverviewFeedback('正在重新搭配装备…')
      try {
        const fit = await calculateTargetTeamWarehouseFit(
          result.analysisRunId,
          entry.targetCandidateId,
        )
        if (generation !== prepareRequest.current) return
        const session = currentTeamAnalysisSession
        if (
          session?.result.appSessionId !== result.appSessionId ||
          session.result.warehouse.accountId !== result.warehouse.accountId ||
          session.result.analysisRunId !== result.analysisRunId ||
          session.result.inputFingerprint !== result.inputFingerprint
        ) {
          setOverviewFeedback('账户资料已更新，请重新分析后再配装。')
          return
        }
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
        queueFitOverview(session.result, nextFits)
      } catch {
        if (generation === prepareRequest.current)
          setOverviewFeedback('这支队伍的配装生成失败，请重新搭配；账户资产没有改变。')
      } finally {
        if (generation === prepareRequest.current) setPreparingItemId(null)
      }
    } else if (request.planId || request.teamId) {
      setOverviewFeedback('原方案的成员暂无法匹配当前队伍建议，请重新选择搭配。原方案仍保留。')
    }
  }
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

  const startAnalysis = async () => {
    const request = ++analysisRequest.current
    const isCurrentRequest = () => request === analysisRequest.current
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
        setAnalysis({ kind: 'unable', reason: 'no_account' })
        return
      }
      // Resolve owned portraits while the solver works, before result rows mount.
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

  const startRequestedAnalysis = useEffectEvent(startAnalysis)
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
        // Keep the complete account projection for the overview and detail route. The detached
        // run owns only the solver/query scope after reserved resources have been removed.
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
  const remainingBoxSelector =
    (savedTeamPlans?.length ?? 0) > 0 ? (
      <details
        className="f5v-remaining-box"
        aria-label="用其他角色配队"
        open={remainingBoxOpen}
        onToggle={(event) => setRemainingBoxOpen(event.currentTarget.open)}
      >
        <summary>再组一队</summary>
        <div className="f5v-remaining-box__content">
          <p>保留勾选队伍的成员与驱动盘，为你推荐另一支队伍。</p>
          <div className="f5v-remaining-box__plans">
            {(savedTeamPlans ?? []).map((plan) => {
              let ready = false
              if (decisionWorld.liveInput) {
                try {
                  remainingBoxPlanReservation(plan, decisionWorld.liveInput)
                  ready = true
                } catch {
                  /* displayed below */
                }
              }
              return (
                <label key={plan.id} className="f5v-remaining-box__plan">
                  <input
                    type="checkbox"
                    checked={reservedPlanIds.includes(plan.id)}
                    onChange={(event) =>
                      setReservedPlanIds((ids) =>
                        event.target.checked
                          ? [...ids, plan.id]
                          : ids.filter((id) => id !== plan.id),
                      )
                    }
                  />
                  <span className="f5v-remaining-box__identity">
                    <strong>{plan.selection.agentIds.map(getAgentName).join(' · ')}</strong>
                  </span>
                  <span className={`f5v-remaining-box__readiness${ready ? '' : ' is-incomplete'}`}>
                    {ready ? '18 张盘齐全' : '需核对配装'}
                  </span>
                </label>
              )
            })}
          </div>
          <button
            className="f5v-box-analysis-entry__action"
            type="button"
            onClick={() => void startRemainingBoxAnalysis()}
            disabled={!reservedPlanIds.length || analysis.kind === 'running'}
          >
            推荐另一队
          </button>
          {remainingBoxError ? <p role="alert">{remainingBoxError}</p> : null}
        </div>
      </details>
    ) : null
  const reuseCurrentAnalysis = useEffectEvent(async () => {
    if (decisionWorld.status !== 'current') return false
    const request = analysisRequest.current
    const { run } = decisionWorld
    const currentOverview = currentTeamOverviewFromQuery(run)
    if (!currentOverview) return false
    const overviewModel =
      contextAgentId || contextPlanId || contextDiscId
        ? await queryTeamOverview(identityForRun(run), {
            agentId: contextAgentId,
            planId: contextPlanId,
            discId: contextDiscId,
          })
        : currentOverview
    if (request !== analysisRequest.current) return true
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
      setLastCompleteAnalysis(nextAnalysis)
      releasePreviousDetached(run.runId)
      setCurrentTeamAnalysisSession(nextAnalysis)
      setAnalysis(nextAnalysis)
      void continueRematch(result, run.input.drafts)
    })
    return true
  })

  useEffect(() => {
    if (!reanalyzeRequested) {
      reanalyzeHandled.current = false
      return
    }
    if (reanalyzeHandled.current || accountHydrating) return
    // The route can mount before the shared initial decision resolves. Wait for
    // that read so a valid result is reused rather than racing it with a refresh.
    if (decisionWorld.status === 'loading') return
    reanalyzeHandled.current = true
    rematchRequest.current = {
      planId: params.get('rematchPlan'),
      teamId: params.get('rematchTeam'),
    }
    // Consume the one-shot route intent first. A current shared decision already
    // contains the complete read-only BOX result; reuse it instead of recalculating.
    navigate('/loadouts/team', { replace: true })
    const request = analysisRequest.current
    queueMicrotask(() => {
      if (request !== analysisRequest.current) return
      void reuseCurrentAnalysis()
        .then((reused) => {
          if (!reused) void startRequestedAnalysis()
        })
        .catch(() => void startRequestedAnalysis())
    })
  }, [accountHydrating, decisionWorld.status, navigate, params, reanalyzeRequested])

  const hardConstraintPanel = decisionWorld.run?.snapshot.hardConstraints.canRestoreDefault ? (
    <TeamConstraintResetPanel
      accountId={accountSummary?.accountId}
      activeCount={decisionWorld.run.snapshot.hardConstraints.active.length}
      teamCount={decisionWorld.run.input.preference.teamCount}
    />
  ) : null
  if (analysis.kind === 'ready') {
    const readyDiscCount = accountSummary?.discCount ?? 0
    if (!accountHydrating && (!accountSummary?.accountId || accountSummary.agentCount === 0))
      return !accountSummary?.accountId ? (
        <AccountRequiredState title="先创建或选择账户" />
      ) : (
        <section className="f5v-box-analysis-entry f5v-box-analysis-entry--exception" role="status">
          <h1>先记录拥有的代理人</h1>
          <p>队伍建议只会使用当前账户中明确标记为已拥有的代理人。</p>
          <Link className="f5v-box-analysis-entry__action" to="/assets/agents">
            前往代理人录入
          </Link>
        </section>
      )
    if (!accountHydrating && readyDiscCount === 0)
      return (
        <section className="f5v-box-analysis-entry f5v-box-analysis-entry--exception" role="status">
          <h1>先导入驱动盘再分析队伍</h1>
          <p>当前账户还没有驱动盘。先完成扫描或导入，才能用仓库中的驱动盘搭配装备。</p>
          <Link className="f5v-box-analysis-entry__action" to="/system/scanner">
            前往扫描与导入
          </Link>
        </section>
      )
    return (
      <>
        {hardConstraintPanel}
        <section className="f5v-box-analysis-entry">
          <div className="f5v-box-analysis-entry__heading">
            <div>
              <h1>分析当前账户的队伍</h1>
            </div>
            {remainingBoxSelector}
          </div>
          <div className="f5v-box-analysis-entry__workspace">
            <div className="f5v-box-analysis-entry__primary">
              <p className="f5v-box-analysis-entry__lead-copy">
                从已拥有的角色中选择队伍，再搭配驱动盘。
              </p>
              <div className="f5v-box-analysis-entry__action-block">
                <button
                  className="f5v-box-analysis-entry__action"
                  type="button"
                  onClick={startAnalysis}
                >
                  分析当前队伍
                </button>
                <p className="f5v-box-analysis-entry__boundary">
                  分析不会修改代理人、邦布、驱动盘或已有方案。
                </p>
              </div>
              <TeamSavedPlanList
                plans={savedTeamPlans ?? []}
                publicItems={currentSavedPlanItems}
                warehouse={savedPlanWarehouse ?? undefined}
                onOpen={(planId) => navigate(`/loadouts/plans/${encodeURIComponent(planId)}`)}
              />
            </div>
          </div>
        </section>
      </>
    )
  }

  if (analysis.kind === 'running') {
    const stageLabel = teamAnalysisStages[analysis.stage - 1]!
    return (
      <section className="f5v-box-analysis-entry" aria-live="polite">
        <div className="f5v-box-analysis-entry__heading">
          <div>
            <h1>分析当前队伍</h1>
            <p>先选队伍，再搭配装备。</p>
          </div>
        </div>
        <div className="f5v-box-analysis-entry__workspace">
          <div className="f5v-box-analysis-entry__primary">
            <h2>正在分析当前队伍</h2>
            <p className="f5v-box-analysis-entry__lead-copy">
              正在按开始分析时的账户资产生成队伍建议。
            </p>
            <p role="status">{stageLabel}，请稍候。</p>
            <p className="f5v-box-analysis-entry__boundary">分析不会更改你的角色或装备。</p>
          </div>
          <aside className="f5v-box-analysis-entry__scope">
            <h2>本次分析</h2>
            <p>正在使用已拥有的角色和驱动盘仓库。</p>
            <dl className="f5v-box-analysis-entry__scope-list">
              <div>
                <dt>当前账户</dt>
                <dd>{analysisSnapshot?.accountName ?? '正在读取'}</dd>
              </div>
              <div>
                <dt>已拥有代理人</dt>
                <dd>{analysisSnapshot ? `${analysisSnapshot.ownedAgentCount} 名` : '正在读取'}</dd>
              </div>
              <div>
                <dt>驱动盘仓库</dt>
                <dd>{analysisSnapshot ? `${analysisSnapshot.discCount} 张` : '正在读取'}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    )
  }

  if (analysis.kind === 'unable') {
    const emptyWarehouse = analysis.reason === 'empty_warehouse'
    return (
      <section
        className="f5v-box-analysis-entry f5v-box-analysis-entry--exception f5v-box-analysis-entry--unable"
        role="status"
      >
        <h1 ref={exceptionHeadingRef} tabIndex={-1}>
          {emptyWarehouse ? '当前账户还没有可用的驱动盘' : '尚未选择账户'}
        </h1>
        <p>
          {emptyWarehouse ? (
            <>
              账户“{analysisSnapshot?.accountName ?? accountSummary?.name ?? '当前账户'}”
              已就绪，但仓库中没有驱动盘。请先完成扫描与导入，再返回分析。
            </>
          ) : (
            '请先在“我的资产 → 账户与备份”选择账户。'
          )}
        </p>
        <div className="f5v-box-analysis-entry__button-row">
          <Link
            className="f5v-box-analysis-entry__action"
            to={emptyWarehouse ? '/system/scanner' : '/assets/account'}
          >
            {emptyWarehouse ? '前往扫描与导入' : '前往账户与备份'}
          </Link>
          {emptyWarehouse ? (
            <button
              className="f5v-box-analysis-entry__secondary-action"
              type="button"
              onClick={() => setAnalysis({ kind: 'ready' })}
            >
              重新核对账户
            </button>
          ) : null}
        </div>
        {emptyWarehouse ? (
          <dl className="f5v-box-analysis-entry__state-meta">
            <div>
              <dt>当前账户</dt>
              <dd>{analysisSnapshot?.accountName ?? accountSummary?.name ?? '当前账户'}</dd>
            </div>
            <div>
              <dt>已拥有代理人</dt>
              <dd>{analysisSnapshot?.ownedAgentCount ?? accountSummary?.agentCount ?? 0} 名</dd>
            </div>
            <div>
              <dt>驱动盘</dt>
              <dd>0 张</dd>
            </div>
          </dl>
        ) : null}
      </section>
    )
  }

  if (analysis.kind === 'error') {
    return (
      <section
        className="f5v-box-analysis-entry f5v-box-analysis-entry--exception f5v-box-analysis-entry--error"
        role="alert"
      >
        <h1 ref={exceptionHeadingRef} tabIndex={-1}>
          本次分析未完成
        </h1>
        <p>
          {analysis.message ?? '暂时无法完成分析，请重试。你的角色、装备和已保存方案都没有改变。'}
        </p>
        <div className="f5v-box-analysis-entry__button-row">
          <button className="f5v-box-analysis-entry__action" type="button" onClick={startAnalysis}>
            重新分析当前队伍
          </button>
          {lastCompleteAnalysis ? (
            <button
              className="f5v-box-analysis-entry__secondary-action"
              type="button"
              onClick={() => setAnalysis(lastCompleteAnalysis)}
            >
              查看上次完整结果
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  const { result } = analysis
  const fitsAreCurrent =
    analysis.kind === 'complete' &&
    decisionWorld.status === 'current' &&
    decisionWorld.run.input.warehouse.accountId === result.warehouse.accountId &&
    decisionWorld.liveFingerprint === result.inputFingerprint &&
    result.decisionSnapshot.fingerprint.inputHash === result.inputFingerprint
  const visibleOverviewModel = fitsAreCurrent
    ? (result.fitOverviewModel ?? result.overviewModel)
    : result.overviewModel
  const visibleGroups = visibleOverviewModel.groups
  const availableIds = new Set(visibleGroups.flatMap((group) => group.items.map((item) => item.id)))
  const selectedId =
    requestedSelectedId && availableIds.has(requestedSelectedId)
      ? requestedSelectedId
      : result.overviewModel.initialSelectedId
  const hasExecutableRecommendation = result.overviewModel.groups.some(
    (group) => group.kind === 'recommended',
  )
  const restrictedByHardConstraints =
    result.decisionSnapshot.hardConstraints.active.length > 0 && !hasExecutableRecommendation
  const resultConstraintPanel = restrictedByHardConstraints ? (
    <TeamConstraintResetPanel
      accountId={accountSummary?.accountId}
      activeCount={result.decisionSnapshot.hardConstraints.active.length}
      teamCount={result.decisionSnapshot.portfolioInput.preference.teamCount}
      blocked
    />
  ) : (
    hardConstraintPanel
  )

  return (
    <>
      {resultConstraintPanel}
      <TeamLoadoutOverview
        scopeActions={
          <div className="f5v-remaining-box-toolbar">
            {remainingBoxSelector}
            {result.reservations ? (
              <div className="f5v-remaining-box__status" role="status">
                <span>已保留 {result.reservations.length} 队 · 使用未选中的角色</span>
                <button
                  className="f5v-box-analysis-entry__secondary-action"
                  type="button"
                  onClick={startAnalysis}
                >
                  使用全部角色
                </button>
              </div>
            ) : null}
          </div>
        }
        key={`${result.appSessionId}:${result.warehouse.accountId}:${result.analysisRunId}:${result.capturedAt.getTime()}`}
        initialUiState={result.overviewUiState}
        onUiStateChange={(overviewUiState) => {
          const session = currentTeamAnalysisSession
          if (
            session?.result.appSessionId !== result.appSessionId ||
            session.result.warehouse.accountId !== result.warehouse.accountId ||
            session.result.analysisRunId !== result.analysisRunId ||
            session.result.capturedAt.getTime() !== result.capturedAt.getTime()
          )
            return
          setCurrentTeamAnalysisSession({
            ...session,
            result: { ...session.result, overviewUiState },
          })
        }}
        answer={result.overviewModel.answer}
        coverage={result.overviewModel.coverage}
        groups={visibleGroups}
        favoriteAgentIds={
          decisionWorld.liveInput?.warehouse.accountId === result.warehouse.accountId
            ? decisionWorld.liveInput.developmentPriorityAgentIds
            : undefined
        }
        selectedId={selectedId}
        preparingItemId={preparingItemId}
        preparationError={
          preparationError?.runId === result.analysisRunId ? preparationError : null
        }
        contextNote={overviewFeedback ?? result.overviewModel.contextNote}
        onSelect={(id) => {
          prepareRequest.current += 1
          setPreparingItemId(null)
          setPreparationError(null)
          setRequestedSelectedId(id)
        }}
        onPrimaryAction={(item) => {
          setPreparationError(null)
          if (!item.detailCandidateId && item.kind !== 'saved') {
            setOverviewFeedback('该记录没有可打开的队伍详情。')
            return
          }
          if (item.kind === 'saved' || !fitsAreCurrent) {
            navigate(item.destination)
            return
          }
          const request = ++prepareRequest.current
          setPreparingItemId(item.id)
          setPreparationError(null)
          setOverviewFeedback(null)
          void queryTeamRoute(result, item.detailCandidateId!)
            .then(async (entry) => {
              if (request !== prepareRequest.current) return
              if (!entry.team || !entry.targetCandidateId) {
                navigate(item.destination)
                return
              }
              const team = entry.team
              if (!team.bangbooId && !entry.automaticBangboo) {
                navigate(item.destination)
                return
              }
              const cached = result.targetTeamFits[team.id]
              if (cached?.candidateId === entry.targetCandidateId) {
                navigate(item.destination)
                return
              }
              const fit = await calculateTargetTeamWarehouseFit(
                result.analysisRunId,
                entry.targetCandidateId,
              )
              if (request !== prepareRequest.current) return
              const session = currentTeamAnalysisSession
              if (
                session?.result.appSessionId !== result.appSessionId ||
                session.result.warehouse.accountId !== result.warehouse.accountId ||
                session.result.analysisRunId !== result.analysisRunId ||
                session.result.inputFingerprint !== result.inputFingerprint
              ) {
                setOverviewFeedback('账户资料已更新，请重新分析后再配装。')
                return
              }
              const nextFits = { ...session.result.targetTeamFits, [team.id]: fit }
              setCurrentTeamAnalysisSession({
                ...session,
                result: {
                  ...session.result,
                  targetTeamFits: nextFits,
                  fitOverviewModel: undefined,
                },
              })
              navigate(item.destination)
              queueFitOverview(session.result, nextFits)
            })
            .catch(() => {
              if (request === prepareRequest.current)
                setPreparationError({
                  runId: result.analysisRunId,
                  itemId: item.id,
                  message: '本次配装生成失败，请重试；账户资产没有改变。',
                })
            })
            .finally(() => {
              if (request === prepareRequest.current) setPreparingItemId(null)
            })
        }}
        onDeleteSaved={setPendingDelete}
        onEmptyAction={() => navigate('/assets/agents')}
        analysisStale={analysis.kind === 'stale'}
        onReanalyze={result.reservations ? startRemainingBoxAnalysis : startAnalysis}
        restrictedByHardConstraints={restrictedByHardConstraints}
      />
      {pendingDelete ? (
        <SavedOverviewDeleteDialog
          accountId={accountSummary?.accountId}
          item={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDeleted={async (title) => {
            const refreshRequest = ++analysisRequest.current
            setOverviewFeedback(`已删除“${title}”；账户资产未改动。`)
            setPendingDelete(null)
            // Keep the current overview mounted while planning facts refresh.
            // Deleting a saved record must not restart the player journey.
            const previous = currentTeamAnalysisSession ?? analysis
            const retained = retainTeamAnalysisAfterSavedPlanDeletion(previous, pendingDelete.id)
            setCurrentTeamAnalysisSession(retained)
            setAnalysis(retained)
            setLastCompleteAnalysis(retained)
            try {
              const refreshed = await decisionWorld.refresh()
              if (!refreshed || !accountSummary) throw new Error('refresh unavailable')
              // A restricted BOX result keeps its scope and remains explicitly stale.
              if (previous.result.reservations) return
              const next = restoreCurrentTeamAnalysisSession(
                accountSummary,
                {
                  status: 'current',
                  run: refreshed,
                  liveFingerprint: refreshed.snapshot.fingerprint.inputHash,
                },
                null,
              )
              if (!next || refreshRequest !== analysisRequest.current) return
              next.result.overviewUiState =
                currentTeamAnalysisSession?.result.overviewUiState ??
                previous.result.overviewUiState
              setCurrentTeamAnalysisSession(next)
              setAnalysis(next)
              setLastCompleteAnalysis(next)
            } catch {
              setOverviewFeedback(`已删除“${title}”；队伍建议暂未更新，可稍后重新分析。`)
            }
          }}
        />
      ) : null}
    </>
  )
}

function SavedPlan({
  warehouse,
  decision,
  readOnly = false,
}: {
  warehouse: CoreWarehouse
  decision?: AccountDecisionSnapshot
  readOnly?: boolean
}) {
  const decisionWorld = useAccountDecisionWorld()
  const calculationClient = useContext(CalculationQueryClientContext)
  const accountSummary = useF5AccountSummary()
  const calculateTargetTeamWarehouseFit = useTargetTeamWarehouseFitCalculation()
  const { planId = '' } = useParams()
  const resolveProfile = useContext(PlanningProfileContext)
  const plan = useLiveQuery(
    () =>
      warehouse.accountId
        ? getAccountPlanningDraft(warehouse.accountId, planId).then((item) => item ?? null)
        : Promise.resolve(null),
    [warehouse.accountId, planId],
  )
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [restoredTargetTeamFitResult, setRestoredTargetTeamFitResult] = useState<
    | {
        identity: string
        status: 'ready' | 'mismatch' | 'error'
        fit?: TargetTeamWarehouseFitQueryResult
      }
    | undefined
  >()
  const [restoredTargetFitRetry, setRestoredTargetFitRetry] = useState(0)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const restoreDeleteFocus = useRef(false)
  useLayoutEffect(() => {
    if (!confirmDelete && restoreDeleteFocus.current) {
      deleteButton.current?.focus()
      restoreDeleteFocus.current = false
    }
  }, [confirmDelete])
  const closeDeleteDialog = () => {
    restoreDeleteFocus.current = true
    setConfirmDelete(false)
  }
  const runForReplay = decisionWorld.run
  const liveInputForFreshness =
    decisionWorld.status === 'current' &&
    decisionWorld.liveInput?.warehouse.accountId === warehouse.accountId
      ? decisionWorld.liveInput
      : null
  const liveInputIdentity = liveInputForFreshness ? contentHash(liveInputForFreshness) : null
  const componentsIdentity =
    runForReplay && liveInputIdentity ? `${runForReplay.runId}:${liveInputIdentity}` : null
  const [savedComponents, setSavedComponents] = useState<
    { identity: string; presentation: SavedTeamSolutionComponents | null } | undefined
  >()
  useEffect(() => {
    if (
      !plan ||
      plan.kind !== 'team' ||
      !runForReplay ||
      !liveInputForFreshness ||
      !componentsIdentity ||
      !calculationClient ||
      savedComponents?.identity === componentsIdentity ||
      runForReplay.input.warehouse.accountId !== warehouse.accountId
    )
      return
    let active = true
    const projectedInputHash = projectedSavedTeamInputHash(liveInputForFreshness)
    void calculationClient
      .querySavedTeamSolutionComponents({
        contractVersion: calculationQueryContractVersion,
        kind: 'saved_team_solution_components',
        runId: runForReplay.runId,
        currentInput: liveInputForFreshness,
      })
      .then((projected) => {
        if (!active) return
        setSavedComponents({
          identity: componentsIdentity,
          presentation: acceptSavedTeamSolutionComponents(projected, {
            runId: runForReplay.runId,
            accountId: warehouse.accountId ?? '',
            capturedInputFingerprint: runForReplay.snapshot.fingerprint.inputHash,
            projectedInputHash,
          }),
        })
      })
      .catch(() => {
        if (active) setSavedComponents({ identity: componentsIdentity, presentation: null })
      })
    return () => {
      active = false
    }
  }, [
    plan,
    runForReplay,
    liveInputForFreshness,
    componentsIdentity,
    calculationClient,
    savedComponents,
    warehouse.accountId,
  ])
  const currentComponents =
    savedComponents?.identity === componentsIdentity ? savedComponents.presentation : null
  const nonPlanningComponents =
    currentComponents && liveInputForFreshness
      ? localPrivateNonPlanningComponents(
          currentComponents.nonPlanningComponents,
          liveInputForFreshness,
        )
      : null
  const replayIdentity =
    plan && runForReplay && decision
      ? `${runForReplay.runId}:${decision.fingerprint.inputHash}:${plan.id}:${savedTeamReplayPlanHash(plan)}`
      : null
  const [savedReplay, setSavedReplay] = useState<
    { identity: string; presentation: SavedTeamReplayPresentation | null } | undefined
  >()
  useEffect(() => {
    if (
      !plan ||
      !runForReplay ||
      !decision ||
      !calculationClient ||
      !replayIdentity ||
      savedReplay?.identity === replayIdentity ||
      runForReplay.input.warehouse.accountId !== warehouse.accountId ||
      runForReplay.snapshot.fingerprint.inputHash !== decision.fingerprint.inputHash
    )
      return
    const planHash = savedTeamReplayPlanHash(plan)
    let active = true
    void calculationClient
      .querySavedTeamPlanReplay({
        contractVersion: calculationQueryContractVersion,
        kind: 'saved_team_plan_replay',
        runId: runForReplay.runId,
        planId: plan.id,
        planHash,
      })
      .then((projected) => {
        if (!active) return
        const accepted = acceptSavedTeamReplayPresentation(projected, {
          runId: runForReplay.runId,
          accountId: warehouse.accountId ?? '',
          inputFingerprint: decision.fingerprint.inputHash,
          planId: plan.id,
          planHash,
        })
        setSavedReplay({ identity: replayIdentity, presentation: accepted })
      })
      .catch(() => {
        if (active) setSavedReplay({ identity: replayIdentity, presentation: null })
      })
    return () => {
      active = false
    }
  }, [
    plan,
    runForReplay,
    decision,
    calculationClient,
    replayIdentity,
    savedReplay,
    warehouse.accountId,
  ])
  const currentSavedTeam =
    savedReplay?.identity === replayIdentity
      ? (savedReplay.presentation?.match ?? undefined)
      : undefined
  const currentBuildIntent = currentSavedTeam?.buildIntent
  const currentCandidateId = currentBuildIntent?.exactTeam.candidateId ?? null
  const [restoredRoute, setRestoredRoute] = useState<
    | {
        candidateId: string
        runId: string
        team: NonNullable<ReturnType<typeof decisionTeamViewModel>>
      }
    | undefined
  >()
  useEffect(() => {
    if (
      !currentCandidateId ||
      !calculationClient ||
      decisionWorld.status !== 'current' ||
      !decision ||
      (restoredRoute?.candidateId === currentCandidateId &&
        restoredRoute.runId === decisionWorld.run.runId) ||
      decision.fingerprint.inputHash !== decisionWorld.run.snapshot.fingerprint.inputHash ||
      decisionWorld.run.input.warehouse.accountId !== warehouse.accountId
    )
      return
    const run = decisionWorld.run
    let active = true
    void calculationClient
      .queryTeamRoutePresentation({
        contractVersion: calculationQueryContractVersion,
        kind: 'team_route_presentation',
        runId: run.runId,
        candidateId: currentCandidateId,
      })
      .then((projected) => {
        if (!active) return
        const accepted = acceptTeamRoutePresentation(projected, {
          runId: run.runId,
          accountId: warehouse.accountId ?? '',
          inputFingerprint: decision.fingerprint.inputHash,
          candidateId: currentCandidateId,
        })
        if (accepted?.team)
          setRestoredRoute({
            candidateId: currentCandidateId,
            runId: run.runId,
            team: accepted.team,
          })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [
    currentCandidateId,
    calculationClient,
    decision,
    decisionWorld,
    restoredRoute,
    warehouse.accountId,
  ])
  const restoredTeam =
    currentBuildIntent && decision
      ? decisionTeamViewModel(
          decision,
          currentBuildIntent.exactTeam.candidateId,
          restoredRoute?.candidateId === currentCandidateId &&
            restoredRoute.runId === decisionWorld.run?.runId
            ? restoredRoute.team
            : null,
        )
      : null
  const currentExactVariantKey = plan
    ? buildExactTeamVariantKey({
        memberIds: plan.selection.agentIds,
        bangbooId: plan.selection.bangbooId,
        scenario: plan.selection.scenario,
      })
    : undefined
  const portfolioSnapshotFreshness = plan?.teamPortfolioSnapshot
    ? inspectSavedTeamPortfolioPlanSnapshotFreshness(
        plan,
        liveInputForFreshness && nonPlanningComponents && plan.teamPortfolioBuildIntent
          ? buildSavedTeamPortfolioPlanSolutionFingerprintFromComponents({
              decisionInput: liveInputForFreshness,
              planId: plan.id,
              buildIntent: plan.teamPortfolioBuildIntent,
              nonPlanningComponents,
            })
          : undefined,
      )
    : undefined
  const snapshotFreshness =
    plan && !plan.teamPortfolioSnapshot
      ? inspectSavedTeamPlanSnapshotFreshness(
          plan,
          decision?.fingerprint.inputHash,
          currentBuildIntent && decision
            ? contentHash([decision.fingerprint.inputHash, currentBuildIntent.fingerprint])
            : undefined,
          currentBuildIntent && liveInputForFreshness && nonPlanningComponents
            ? buildSavedTeamPlanSolutionFingerprintFromComponents({
                decisionInput: liveInputForFreshness,
                planId: plan.id,
                buildIntentFingerprint: contentHash([
                  currentBuildIntent.fingerprint,
                  currentExactVariantKey!,
                  targetTeamEquipmentParametersFingerprint(
                    currentSavedTeam!.effectiveEquipmentParameters,
                  ),
                ]),
                nonPlanningComponents,
              })
            : undefined,
        )
      : undefined
  const restoredPlanStale = portfolioSnapshotFreshness?.stale ?? snapshotFreshness?.stale ?? true
  const staleNotice = snapshotFreshness ? savedPlanStaleNotice(snapshotFreshness) : undefined
  const currentRun = decisionWorld.status === 'current' ? decisionWorld.run : null
  const savedItemFromCurrentRun = (() => {
    if (
      !plan ||
      !currentRun ||
      currentRun.input.warehouse.accountId !== warehouse.accountId ||
      currentRun.snapshot.fingerprint.inputHash !== decision?.fingerprint.inputHash ||
      currentRun.snapshot.fingerprint.inputHash !== decisionWorld.liveFingerprint ||
      !currentRun.input.drafts.some(
        (captured) => captured.id === plan.id && contentHash(captured) === contentHash(plan),
      )
    )
      return null
    const presentation = acceptTeamOverviewPresentation(currentRun.teamPresentation, {
      runId: currentRun.runId,
      accountId: warehouse.accountId ?? '',
      inputFingerprint: currentRun.snapshot.fingerprint.inputHash,
      agentId: null,
      planId: null,
      discId: null,
    })
    return (
      presentation?.overviewModel.groups
        .flatMap((group) => group.items)
        .flatMap((family) => family.variants)
        .find((item) => item.id === `saved:${plan.id}`) ?? null
    )
  })()
  const restoredTeamRatingLabel = plan
    ? currentSavedTeamRatingLabel({
        plan,
        decisionAuthority:
          decisionWorld.status === 'current' ? decision?.decisionAuthority : undefined,
        publicItem: savedItemFromCurrentRun,
      })
    : null
  const savedTargetCandidateId =
    plan &&
    !restoredPlanStale &&
    decisionWorld.status === 'current' &&
    currentSavedTeam?.buildIntent.exactTeam.candidateId
      ? currentSavedTeam.buildIntent.exactTeam.candidateId
      : undefined
  const savedTargetParameters = savedTargetCandidateId
    ? currentSavedTeam?.effectiveEquipmentParameters
    : undefined
  const savedTargetParametersFingerprint = savedTargetParameters
    ? targetTeamEquipmentParametersFingerprint(savedTargetParameters)
    : ''
  const savedTargetDiscFingerprint = plan ? savedTeamDiscAssignmentFingerprint(plan) : ''
  const stableSavedTargetParameters = useMemo(
    () => savedTargetParameters,
    // The parameter fingerprint is the canonical exact-query identity. Keeping the value stable
    // prevents a completed replay from scheduling another identical read-only target query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedTargetCandidateId, savedTargetParametersFingerprint],
  )
  const savedTargetRunId =
    savedTargetCandidateId && decisionWorld.status === 'current'
      ? decisionWorld.run.runId
      : undefined
  const savedTargetIdentity =
    savedTargetRunId && savedTargetCandidateId && savedTargetParameters
      ? `${savedTargetRunId}:${savedTargetCandidateId}:${savedTargetParametersFingerprint}:${savedTargetDiscFingerprint}`
      : ''
  const savedTargetRequestIdentity = savedTargetIdentity
    ? `${savedTargetIdentity}:${restoredTargetFitRetry}`
    : ''
  const restoredTargetTeamFit =
    restoredTargetTeamFitResult?.identity === savedTargetRequestIdentity &&
    restoredTargetTeamFitResult.status === 'ready'
      ? restoredTargetTeamFitResult.fit
      : undefined
  const restoredTargetFitState = savedTargetRequestIdentity
    ? restoredTargetTeamFitResult?.identity === savedTargetRequestIdentity
      ? restoredTargetTeamFitResult.status
      : 'loading'
    : undefined
  useEffect(() => {
    let active = true
    if (!savedTargetRunId || !savedTargetCandidateId || !stableSavedTargetParameters) return
    void calculateTargetTeamWarehouseFit(
      savedTargetRunId,
      savedTargetCandidateId,
      stableSavedTargetParameters,
    )
      .then((fit) => {
        if (!active || fit.candidateId !== savedTargetCandidateId) return
        setRestoredTargetTeamFitResult(
          plan && savedTeamTargetFitMatchesSavedDiscs(plan, fit)
            ? {
                identity: savedTargetRequestIdentity,
                status: 'ready',
                fit: {
                  ...fit,
                  targetExecution: {
                    ...fit.targetExecution,
                    deploymentOrder: plan.teamExecutionSnapshot?.deploymentOrder,
                  },
                },
              }
            : { identity: savedTargetRequestIdentity, status: 'mismatch' },
        )
      })
      .catch(() => {
        // Freshness is a separate persisted-input proof. A failed current query must not invent
        // per-disc scores from a compact saved snapshot or alter the saved plan.
        if (active)
          setRestoredTargetTeamFitResult({ identity: savedTargetRequestIdentity, status: 'error' })
      })
    return () => {
      active = false
    }
  }, [
    calculateTargetTeamWarehouseFit,
    savedTargetCandidateId,
    stableSavedTargetParameters,
    savedTargetParametersFingerprint,
    savedTargetIdentity,
    savedTargetRequestIdentity,
    savedTargetRunId,
    plan,
  ])
  if (deleting)
    return (
      <section className="panel result-empty" role="status">
        正在更新队伍方案…
      </section>
    )
  if (plan === undefined)
    return (
      <section className="panel result-empty" aria-live="polite">
        <h1>正在读取已保存方案</h1>
      </section>
    )
  if (!plan) return <InvalidPlan back="/loadouts/team" label="方案" />
  if (
    plan.kind === 'team' &&
    componentsIdentity &&
    calculationClient &&
    savedComponents?.identity !== componentsIdentity
  )
    return (
      <section className="panel result-empty" role="status">
        <h1>正在核对已保存方案</h1>
      </section>
    )
  if (
    plan.kind === 'team' &&
    replayIdentity &&
    calculationClient &&
    savedReplay?.identity !== replayIdentity
  )
    return (
      <section className="panel result-empty" role="status">
        <h1>正在读取已保存配装</h1>
      </section>
    )
  if (plan.kind === 'team' && !plan.teamExecutionSnapshot && restoredTargetFitState === 'loading')
    return (
      <section className="panel result-empty" role="status">
        <h1>正在读取已保存配装</h1>
      </section>
    )
  if (plan.teamPortfolioSnapshot)
    return (
      <SavedPortfolioPlan
        warehouse={warehouse}
        plan={plan}
        readOnly={readOnly || restoredPlanStale}
      />
    )
  const profiles = plan.selection.agentIds.map(resolveProfile)
  return (
    <>
      <PlanEditor
        key={`${warehouse.accountId}:saved:${plan.id}`}
        warehouse={warehouse}
        kind={plan.kind}
        profiles={profiles}
        team={restoredTeam ?? undefined}
        teamRatingLabel={restoredTeamRatingLabel ?? undefined}
        back={`/loadouts/${plan.kind}`}
        restored={{ ...plan, name: savedPlanDisplayName(plan) }}
        deleteAction={
          <button
            ref={deleteButton}
            type="button"
            className="button button--danger"
            onClick={() => setConfirmDelete(true)}
          >
            删除此方案
          </button>
        }
        decision={decision}
        targetTeamFit={restoredTargetTeamFit}
        readOnly={readOnly || restoredPlanStale}
        restoredExecutionIsFresh={Boolean(savedTargetCandidateId)}
        restoredTargetFitState={restoredTargetFitState}
        onRetryRestoredTargetFit={() => setRestoredTargetFitRetry((current) => current + 1)}
        staleNotice={staleNotice}
        onReanalyze={() =>
          navigate(`/loadouts/team?reanalyze=1&rematchPlan=${encodeURIComponent(plan.id)}`)
        }
      />
      {confirmDelete ? (
        <PlanningDialog
          title="删除已保存方案？"
          description={`将删除 1 个已保存方案“${savedPlanDisplayName(plan)}”。不会影响资产、仓库或游戏数据。`}
          onCancel={closeDeleteDialog}
        >
          {deleteError ? <p role="alert">{deleteError}</p> : null}
          <div className="button-row">
            <button autoFocus onClick={closeDeleteDialog}>
              取消
            </button>
            <button
              type="button"
              className="button--danger"
              onClick={async () => {
                setDeleteError(null)
                setDeleting(true)
                try {
                  if (!warehouse.accountId) throw new Error('account unavailable')
                  await deleteAccountPlanningDraft(warehouse.accountId, plan.id)
                } catch {
                  setDeleting(false)
                  setDeleteError('删除失败，方案仍保留，请重试。')
                  return
                }
                if (plan.kind === 'team') {
                  // Remove the persisted row from any retained overview before refreshing.
                  // A failed refresh must not project the successfully deleted row again.
                  const previous = currentTeamAnalysisSession
                  const retained = previous
                    ? retainTeamAnalysisAfterSavedPlanDeletion(previous, plan.id)
                    : null
                  if (retained) setCurrentTeamAnalysisSession(retained)
                  let refreshUnavailable = !accountSummary
                  if (accountSummary) {
                    try {
                      const refreshed = await decisionWorld.refresh()
                      if (refreshed) {
                        const next = restoreCurrentTeamAnalysisSession(
                          accountSummary,
                          {
                            status: 'current',
                            run: refreshed,
                            liveFingerprint: refreshed.snapshot.fingerprint.inputHash,
                          },
                          null,
                        )
                        if (next) {
                          next.result.overviewUiState = retained?.result.overviewUiState
                          setCurrentTeamAnalysisSession(next)
                        } else {
                          refreshUnavailable = true
                        }
                      } else {
                        refreshUnavailable = true
                      }
                    } catch {
                      refreshUnavailable = true
                    }
                  }
                  if (refreshUnavailable && retained) {
                    setCurrentTeamAnalysisSession(
                      retainTeamAnalysisAfterSavedPlanDeletion(
                        retained,
                        plan.id,
                        `已删除“${savedPlanDisplayName(plan)}”；队伍建议暂未更新，可稍后重新分析。`,
                      ),
                    )
                  }
                }
                navigate(`/loadouts/${plan.kind}`, { replace: true })
              }}
            >
              确认删除
            </button>
          </div>
        </PlanningDialog>
      ) : null}
    </>
  )
}
