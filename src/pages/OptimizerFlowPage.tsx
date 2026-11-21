import { lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { loadCoreWarehouse } from '../accounts/coreWarehouse'
import {
  CalculationQueryClientContext,
  useAccountDecisionWorld,
} from '../application/accountDecisionWorldHooks'
import { useF5AccountSummary } from '../components/f5AccountSummaryContext'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { AppLoadingState } from '../components/AppEntryState'
import { LegacyOptimizerRouteRedirect, LegacyResultRedirect } from './OptimizerFlowSupport'
import {
  canRestoreCurrentTeamAnalysisSession,
  currentDecisionWorldForRecovery,
  currentTeamOverviewFromQuery,
  loadCurrentTeamOverviewFromQuery,
  reconcileEquivalentTeamAnalysis,
  restoreCurrentTeamAnalysisSession,
} from './teamAnalysisRecovery'
import {
  currentTeamAnalysisSession,
  setCurrentTeamAnalysisSession,
  type LastCompleteAnalysis,
} from './teamAnalysisSession'
import { useTeamAnalysisSession } from './useTeamAnalysisSession'

import './team-loadout-analysis-entry.css'
import './team-loadout-journey.css'
import './team-loadout-remaining-box.css'

const AgentPicker = lazy(() =>
  import('./AgentLoadoutRoutes').then((module) => ({ default: module.AgentPicker })),
)
const TeamPicker = lazy(() =>
  import('./optimizer/TeamPicker').then((module) => ({ default: module.TeamPicker })),
)
const AgentPlan = lazy(() =>
  import('./AgentPlanRoute').then((module) => ({ default: module.AgentPlan })),
)
const TeamPlan = lazy(() => import('./TeamPlan').then((module) => ({ default: module.TeamPlan })))
const SavedPlan = lazy(() =>
  import('./optimizer/SavedPlanRoute').then((module) => ({ default: module.SavedPlanRoute })),
)

export function OptimizerFlowPage() {
  const location = useLocation()
  if (location.pathname.startsWith('/optimizer')) return <LegacyOptimizerRouteRedirect />
  if (location.pathname.startsWith('/loadouts/plans/'))
    return (
      <Suspense fallback={<AppLoadingState title="正在读取已保存方案" />}>
        <SavedPlan />
      </Suspense>
    )
  if (location.pathname === '/loadouts/team')
    return (
      <Suspense fallback={<AppLoadingState title="正在打开队伍分析" />}>
        <TeamPicker />
      </Suspense>
    )
  return (
    <Suspense fallback={<AppLoadingState title="正在打开页面" />}>
      <OptimizerFlowWorkspace />
    </Suspense>
  )
}

function OptimizerFlowWorkspace() {
  const location = useLocation()
  const accountSummary = useF5AccountSummary()
  const decisionWorld = useAccountDecisionWorld()
  const calculationClient = useContext(CalculationQueryClientContext)
  const storedSession = useTeamAnalysisSession()
  const liveWarehouse = useLiveQuery(() => loadCoreWarehouse(), [])
  const isTeamDetail =
    location.pathname.startsWith('/loadouts/team/') && !location.pathname.endsWith('/result')
  const currentDecisionWorld = useMemo(
    () => currentDecisionWorldForRecovery(decisionWorld),
    [decisionWorld],
  )
  const teamKey = isTeamDetail
    ? decodeURIComponent(location.pathname.slice('/loadouts/team/'.length).split('/')[0] ?? '')
    : null
  const sessionFromMemory =
    isTeamDetail &&
    accountSummary &&
    storedSession?.result.appSessionId === accountSummary.appSessionId &&
    storedSession.result.warehouse.accountId === accountSummary.accountId
      ? storedSession
      : null
  const canRestoreCurrentRun = canRestoreCurrentTeamAnalysisSession(
    accountSummary,
    currentDecisionWorld,
  )
  const memoryCanRebind = Boolean(
    sessionFromMemory &&
    canRestoreCurrentRun &&
    currentDecisionWorld &&
    accountSummary?.accountId &&
    reconcileEquivalentTeamAnalysis(
      sessionFromMemory,
      { accountId: accountSummary.accountId, appSessionId: accountSummary.appSessionId },
      currentDecisionWorld,
      sessionFromMemory.result.overviewModel,
    ),
  )
  const eagerRestoredSession = useMemo(() => {
    if (!canRestoreCurrentRun || !currentDecisionWorld || !accountSummary?.accountId) return null
    if (!sessionFromMemory)
      return restoreCurrentTeamAnalysisSession(accountSummary, currentDecisionWorld, teamKey)
    if (!memoryCanRebind) return null
    const sourceId = sessionFromMemory.result.sourceRunId ?? sessionFromMemory.result.analysisRunId
    const overview =
      sourceId === currentDecisionWorld.run.runId
        ? sessionFromMemory.result.overviewModel
        : currentTeamOverviewFromQuery(currentDecisionWorld.run)
    return overview
      ? reconcileEquivalentTeamAnalysis(
          sessionFromMemory,
          { accountId: accountSummary.accountId, appSessionId: accountSummary.appSessionId },
          currentDecisionWorld,
          overview,
        )
      : null
  }, [
    accountSummary,
    canRestoreCurrentRun,
    currentDecisionWorld,
    memoryCanRebind,
    sessionFromMemory,
    teamKey,
  ])
  const recoveryKey =
    (!sessionFromMemory || memoryCanRebind) &&
    !eagerRestoredSession &&
    canRestoreCurrentRun &&
    currentDecisionWorld
      ? [
          accountSummary?.accountId,
          accountSummary?.appSessionId,
          currentDecisionWorld.run.runId,
          currentDecisionWorld.liveFingerprint,
          teamKey,
        ].join(':')
      : null
  const [asyncRecovery, setAsyncRecovery] = useState<{
    key: string
    session: LastCompleteAnalysis | null
  }>()
  useEffect(() => {
    if (!recoveryKey || !currentDecisionWorld || !accountSummary) return
    let active = true
    void loadCurrentTeamOverviewFromQuery(currentDecisionWorld.run, calculationClient)
      .then((overviewModel) => {
        if (!active) return
        const restored =
          sessionFromMemory && overviewModel && accountSummary.accountId
            ? reconcileEquivalentTeamAnalysis(
                sessionFromMemory,
                { accountId: accountSummary.accountId, appSessionId: accountSummary.appSessionId },
                currentDecisionWorld,
                overviewModel,
              )
            : restoreCurrentTeamAnalysisSession(
                accountSummary,
                currentDecisionWorld,
                teamKey,
                overviewModel,
              )
        setAsyncRecovery({ key: recoveryKey, session: restored })
      })
      .catch(() => {
        if (active) setAsyncRecovery({ key: recoveryKey, session: null })
      })
    return () => {
      active = false
    }
  }, [
    accountSummary,
    calculationClient,
    currentDecisionWorld,
    recoveryKey,
    sessionFromMemory,
    teamKey,
  ])
  const asyncRestoredSession = asyncRecovery?.key === recoveryKey ? asyncRecovery.session : null
  const session = eagerRestoredSession ?? asyncRestoredSession ?? sessionFromMemory
  const restorationPending = Boolean(recoveryKey) && asyncRecovery?.key !== recoveryKey
  useEffect(() => {
    const restored = eagerRestoredSession ?? asyncRestoredSession
    if (
      restored &&
      (currentTeamAnalysisSession === sessionFromMemory || !currentTeamAnalysisSession)
    )
      setCurrentTeamAnalysisSession(restored)
  }, [asyncRestoredSession, eagerRestoredSession, sessionFromMemory])
  if (
    isTeamDetail &&
    (!accountSummary ||
      accountSummary.hydrating ||
      (!session && decisionWorld.status === 'loading'))
  )
    return (
      <section className="panel result-empty" aria-live="polite">
        <h1>正在读取当前账户</h1>
      </section>
    )
  if (isTeamDetail && restorationPending && !sessionFromMemory)
    return (
      <section className="panel result-empty" aria-live="polite">
        <h1>正在恢复当前队伍建议</h1>
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
  if (location.pathname.includes('/result')) return <LegacyResultRedirect />
  return location.pathname.startsWith('/loadouts/team/') ? (
    <TeamPlan
      warehouse={warehouse}
      decision={session?.result.decisionSnapshot}
      analysisRunId={session?.result.analysisRunId}
      targetTeamFits={session?.result.targetTeamFits}
      readOnly={
        session?.kind === 'stale' ||
        decisionWorld.status !== 'current' ||
        !session ||
        (session.result.sourceRunId ?? session.result.analysisRunId) !== decisionWorld.run?.runId ||
        session.result.inputFingerprint !== decisionWorld.liveFingerprint
      }
    />
  ) : (
    <AgentPlan warehouse={warehouse} />
  )
}
