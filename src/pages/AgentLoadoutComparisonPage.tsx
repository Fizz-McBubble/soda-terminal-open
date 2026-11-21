import { projectDevelopmentComparisonView } from './projectDevelopmentComparisonView'
import {
  createComparisonPlanSave,
  createPersonalComparisonPlanSave,
} from './agentComparisonPlanSave'

import { playerErrorMessage } from '../application/playerErrorMessage'

import { recalculateDevelopmentComparison } from './recalculateDevelopmentComparison'
import { usePersonalDevelopmentComparison } from './usePersonalDevelopmentComparison'
import { recalculatePersonalComparison } from './personalDevelopmentComparisonActions'
import { readPersonalDevelopmentCapture } from './personalDevelopmentSessionStore'

import type { ReviewedEventConditionDeclarations32 } from '../calculation/reviewedEventConditionDeclarations32'
import { AppLoadingState } from '../components/AppEntryState'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackNavigation } from '../components/BackNavigation'
import type { AccountPlanningDraft } from '../accounts/types'

import {
  useAccountDecisionWorld,
  useDevelopmentCandidateAlternativesCalculation,
} from '../application/accountDecisionWorld'

import { AgentDevelopmentGolden } from '../features/agentDevelopmentGolden'

import {
  cacheDevelopmentCandidateSnapshot,
  isDevelopmentCandidateSnapshotStale,
  readDevelopmentCandidateSnapshot,
} from './agentDevelopmentCandidateSession'
import { usePageOperationScope } from '../components/usePageOperationScope'
import {
  defaultPlanningScenarioSelection32,
  type CurrentPlanningScenarioSelection32,
} from '../application/publicPlanningScenarioContract'

export function AgentLoadoutComparisonPage() {
  const { agentId = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [snapshotVersion, setSnapshotVersion] = useState(0)
  const [justSaved, setJustSaved] = useState<AccountPlanningDraft | null>(null)
  const [comparisonPending, setComparisonPending] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)
  const comparisonGeneration = useRef(0)
  const [saveRefreshScope, setSaveRefreshScope] = useState<{
    next: string
    previous: string
  } | null>(null)
  const candidateQueryAbort = useRef<AbortController | null>(null)
  const decisionWorld = useAccountDecisionWorld()
  const queryDevelopmentCandidateAlternatives = useDevelopmentCandidateAlternativesCalculation()
  const personal = usePersonalDevelopmentComparison(agentId, snapshotVersion)
  useEffect(
    () => () => {
      candidateQueryAbort.current?.abort()
      candidateQueryAbort.current = null
    },
    [],
  )
  const pageAccountId = personal.enabled
    ? personal.input?.warehouse.accountId
    : decisionWorld.status === 'stale'
      ? decisionWorld.liveInput?.warehouse.accountId
      : decisionWorld.run?.input.warehouse.accountId
  const capturePageScope = usePageOperationScope(JSON.stringify([pageAccountId, agentId]))
  if (personal.enabled ? personal.loading : decisionWorld.status === 'loading')
    return <AppLoadingState title="正在读取账户配装…" compact />
  if (
    personal.enabled
      ? !!personal.error
      : decisionWorld.status !== 'current' && decisionWorld.status !== 'stale'
  ) {
    const errorMessage = playerErrorMessage(
      personal.enabled
        ? personal.error
        : decisionWorld.status === 'error'
          ? decisionWorld.message
          : undefined,
      '当前账户资料暂未读取完整，请重试或返回养成页。',
    )
    return (
      <section className="panel" role="alert">
        <h1>无法打开方案比较</h1>
        <p>{errorMessage}</p>
        <div className="app-recovery-actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              if (personal.enabled) personal.retryRead()
              else void decisionWorld.refresh()
            }}
          >
            重试读取
          </button>
          <BackNavigation to="/development" />
        </div>
      </section>
    )
  }
  // The retained run is historical while the account decision world is stale.
  // Read the live warehouse before resolving the account/session key so a
  // comparison from a previously selected account cannot be presented as this
  // account's current match.
  const warehouse = personal.enabled
    ? personal.input?.warehouse
    : decisionWorld.status === 'stale'
      ? decisionWorld.liveInput?.warehouse
      : decisionWorld.run?.input.warehouse
  if (!warehouse) return <AppLoadingState title="正在读取当前账户配装…" compact />
  const agent = warehouse.roster.agents.find((item) => item.agentId === agentId)
  if (!warehouse.accountId || !agent?.owned)
    return (
      <section className="panel">
        <h1>无法打开方案比较</h1>
        <p>
          {!warehouse.accountId
            ? '请先创建或选择本机账户后再比较方案。'
            : '只能比较当前账户中已拥有代理人的驱动盘方案。'}
        </p>
        <BackNavigation to="/development" />
      </section>
    )
  const accountId = warehouse.accountId
  const candidateSnapshot = personal.enabled
    ? personal.capture?.result
    : readDevelopmentCandidateSnapshot(accountId, agentId)
  if (!candidateSnapshot || candidateSnapshot.status !== 'ready' || !candidateSnapshot.presentation)
    return (
      <section className="panel">
        <h1>本次匹配记录不可用</h1>
        <p>请回到养成页重新搭配驱动盘，再比较搭配。</p>
        <Link className="button button--primary" to={`/development/${agentId}`}>
          返回养成，重新搭配
        </Link>
      </section>
    )
  const snapshotStale =
    'sessionId' in candidateSnapshot
      ? personal.stale
      : decisionWorld.status === 'stale' ||
        isDevelopmentCandidateSnapshotStale(candidateSnapshot, decisionWorld.liveFingerprint)
  const currentInput = personal.enabled
    ? personal.input
    : (decisionWorld.liveInput ?? decisionWorld.run?.input)
  if (!currentInput) return <AppLoadingState title="正在读取当前账户配装…" compact />
  const {
    top10,
    alternatives,
    displayedSaveScope,
    selectedCandidateRank,
    baselineComplete,
    currentPlan,
  } = projectDevelopmentComparisonView({
    accountId,
    agentId,
    currentInput,
    justSaved,
    candidateSnapshot,
    params,
    saveRefreshScope,
    snapshotStale,
    ...('sessionId' in candidateSnapshot ? { staleReason: personal.staleReason } : {}),
  })
  const persist = (rank: number) => {
    const common = {
      capturePageScope,
      comparisonPending,
      snapshotStale,
      startComparisonGeneration: () => {
        const generation = ++comparisonGeneration.current
        return () => generation === comparisonGeneration.current
      },
      setJustSaved,
      setSaveRefreshScope,
      displayedSaveScope,
      setSnapshotVersion,
      params,
      setParams,
    }
    if ('sessionId' in candidateSnapshot) {
      if (!personal.client || !personal.capture) throw new Error('个人搭配记录不可用，请重新搭配。')
      return createPersonalComparisonPlanSave({
        ...common,
        client: personal.client,
        capture: personal.capture,
      })(rank)
    }
    return createComparisonPlanSave({
      ...common,
      decisionWorld,
      alternatives,
      accountId,
      agentId,
      candidateSnapshot,
      queryDevelopmentCandidateAlternatives,
    })(rank)
  }
  const recalculateComparison = async (
    selection: CurrentPlanningScenarioSelection32,
    requestedDeclarations?: ReviewedEventConditionDeclarations32,
  ) => {
    const isCurrentPage = capturePageScope()
    const generation = ++comparisonGeneration.current
    const active = () => isCurrentPage() && generation === comparisonGeneration.current
    candidateQueryAbort.current?.abort()
    const controller = new AbortController()
    candidateQueryAbort.current = controller
    setComparisonPending(true)
    setComparisonError(null)
    try {
      if ('sessionId' in candidateSnapshot) {
        if (!personal.client || !personal.capture)
          throw new Error('个人搭配记录不可用，请重新搭配。')
        const next = await recalculatePersonalComparison({
          client: personal.client,
          capture: personal.capture,
          scenarioSelection: selection,
          declarations: requestedDeclarations,
          stale: snapshotStale,
          signal: controller.signal,
          isCurrent: active,
          readCurrentFingerprint: () =>
            readPersonalDevelopmentCapture(accountId, agentId)?.result.comparisonFingerprint,
        })
        if (!next || !active()) return
        setSnapshotVersion((value) => value + 1)
        return
      }
      const currentRun =
        decisionWorld.status === 'stale' ? await decisionWorld.refresh() : decisionWorld.run
      if (!active()) return
      if (!currentRun) throw new Error('当前账户无法重新分析；请稍后重试。')
      const result = await recalculateDevelopmentComparison({
        snapshot: candidateSnapshot,
        run: currentRun,
        accountId,
        agentId,
        selection,
        requestedDeclarations,
        snapshotStale,
        readCurrentFingerprint: () =>
          readDevelopmentCandidateSnapshot(accountId, agentId)?.comparisonFingerprint,
        query: queryDevelopmentCandidateAlternatives,
        signal: controller.signal,
        isCurrent: active,
      })
      if (!result || !active()) return
      if (!cacheDevelopmentCandidateSnapshot(result))
        throw new Error(result.gaps[0] ?? '当前账户无法生成完整的六张候选盘。')
      setSnapshotVersion((version) => version + 1)
    } catch (error) {
      if (!active()) return
      setComparisonError(playerErrorMessage(error, '场景计算失败，请重试。'))
      throw error
    } finally {
      if (active()) setComparisonPending(false)
      if (candidateQueryAbort.current === controller) candidateQueryAbort.current = null
    }
  }
  return (
    <>
      {comparisonError && (
        <p role="alert" className="planning-scenario-error">
          {comparisonError}
        </p>
      )}
      <AgentDevelopmentGolden
        initialView="top10"
        top10={top10}
        onNavigate={(view) => {
          if (view === 'overview') {
            navigate('/development')
            return
          }
          navigate(
            (selectedCandidateRank === -1 || (selectedCandidateRank === 0 && !baselineComplete)) &&
              currentPlan
              ? `/development/${agentId}?plan=${encodeURIComponent(currentPlan.id)}`
              : selectedCandidateRank === undefined
                ? `/development/${agentId}`
                : `/development/${agentId}?candidate=${selectedCandidateRank}`,
          )
        }}
        onSavePlan={
          personal.enabled && personal.capture?.result.mode !== 'compare' ? undefined : persist
        }
        comparisonScenarioControl={
          personal.comparing ? (
            <>
              <span role="status">正在补充属性与收益对比…</span>
              <button
                type="button"
                className="button button--quiet"
                onClick={personal.cancelComparison}
              >
                取消比较
              </button>
            </>
          ) : personal.comparisonError || personal.comparisonCancelled ? (
            <>
              <span role={personal.comparisonError ? 'alert' : 'status'}>
                {personal.comparisonError ? '比较未完成，已生成方案保留。' : '已取消比较。'}
              </span>
              <button
                type="button"
                className="button button--quiet"
                onClick={personal.retryComparison}
              >
                {personal.comparisonError ? '重试比较' : '继续比较'}
              </button>
            </>
          ) : null
        }
        onSelectCandidatePlan={(rank) => {
          candidateQueryAbort.current?.abort()
          candidateQueryAbort.current = null
          ++comparisonGeneration.current
          setComparisonPending(false)
          setComparisonError(null)
          const next = new URLSearchParams(params)
          next.set('candidate', String(rank))
          setParams(next, { replace: true })
        }}
        onReanalyzeWarehouse={
          personal.comparing
            ? undefined
            : () => recalculateComparison(defaultPlanningScenarioSelection32)
        }
      />
    </>
  )
}
