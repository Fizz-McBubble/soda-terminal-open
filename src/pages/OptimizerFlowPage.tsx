import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { loadCoreWarehouse } from '../accounts/coreWarehouse'
import { useAccountDecisionWorld } from '../application/accountDecisionWorldHooks'
import { useF5AccountSummary } from '../components/f5AccountSummaryContext'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { AgentPicker, AgentPlan } from './AgentLoadoutRoutes'
import { LegacyOptimizerRouteRedirect, LegacyResultRedirect } from './OptimizerFlowSupport'
import { TeamPlan } from './TeamPlan'
import {
  canRestoreCurrentTeamAnalysisSession,
  currentDecisionWorldForRecovery,
  restoreCurrentTeamAnalysisSession,
} from './teamAnalysisRecovery'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import { SavedPlan } from './optimizer/SavedPlan'
import { TeamPicker } from './optimizer/TeamPicker'

import './team-loadout-analysis-entry.css'
import './team-loadout-journey.css'
import './team-loadout-remaining-box.css'

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
