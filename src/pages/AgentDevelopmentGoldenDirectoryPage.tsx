import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppLoadingState, WorkbenchEmptyState } from '../components/AppEntryState'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import { saveDevelopmentPriorityAgentIds } from '../accounts/developmentPlanning'
import {
  useAccountDecisionWorld,
  useDevelopmentDirectoryScaffold,
} from '../application/accountDecisionWorld'
import { AgentDevelopmentDirectoryShell } from '../features/agentDevelopmentGolden/AgentDevelopmentDirectoryShell'
import type { AgentSummary } from '../features/agentDevelopmentGolden/types'
import { AgentDevelopmentReadError } from './AgentDevelopmentReadError'
import { useDevelopmentDirectoryFacts } from './useDevelopmentDirectoryFacts'
import { SavedOverviewDeleteDialog } from './SavedOverviewDeleteDialog'
import { projectAgentDevelopmentCatalogJoin } from './agentDevelopmentCatalogJoin'
import { projectDirectoryScaffold } from './directoryScaffoldProjection'
import { projectDirectorySkillTraining } from './directorySkillTraining'
import {
  createDevelopmentDirectoryDiscIndex,
  projectDevelopmentDirectoryEquipmentProgress,
} from './directoryEquipmentProgress'

export function AgentDevelopmentGoldenDirectoryPage() {
  const navigate = useNavigate()
  const decisionWorld = useAccountDecisionWorld()
  const directoryScaffold = useDevelopmentDirectoryScaffold()
  const facts = useDevelopmentDirectoryFacts()
  const projectionRun =
    decisionWorld.status === 'current' || (decisionWorld.status === 'stale' && !facts.enabled)
      ? decisionWorld.run
      : null
  const staleDirectory = decisionWorld.status === 'stale' && !facts.enabled
  const refresh = decisionWorld.refresh
  const staleAccountId = decisionWorld.liveInput?.warehouse.accountId
  const staleRefreshKey =
    !facts.enabled &&
    decisionWorld.status === 'stale' &&
    staleAccountId &&
    decisionWorld.liveFingerprint
      ? `${staleAccountId}\0${decisionWorld.liveFingerprint}\0${decisionWorld.run.runId}`
      : null
  const [refreshFailureKey, setRefreshFailureKey] = useState<string | null>(null)
  const attemptedRefresh = useRef<string | null>(null)
  const latestStaleKey = useRef(staleRefreshKey)
  const mounted = useRef(false)
  useLayoutEffect(() => {
    latestStaleKey.current = staleRefreshKey
  }, [staleRefreshKey])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const recordRefreshFailure = useCallback((key: string, succeeded: boolean) => {
    if (mounted.current && latestStaleKey.current === key)
      setRefreshFailureKey(succeeded ? null : key)
  }, [])
  useEffect(() => {
    if (!staleRefreshKey || attemptedRefresh.current === staleRefreshKey) return
    attemptedRefresh.current = staleRefreshKey
    const accountId = staleAccountId
    void refresh()
      .then((run) =>
        recordRefreshFailure(staleRefreshKey, run?.input.warehouse.accountId === accountId),
      )
      .catch(() => recordRefreshFailure(staleRefreshKey, false))
  }, [staleRefreshKey, staleAccountId, refresh, recordRefreshFailure])
  const [deleteTarget, setDeleteTarget] = useState<{
    accountId: string
    id: string
    title: string
  } | null>(null)
  const [priorityOverride, setPriorityOverride] = useState<{
    accountId: string
    ids: string[]
  } | null>(null)
  const currentInput = facts.enabled
    ? projectionRun
      ? (decisionWorld.liveInput ?? facts.input ?? undefined)
      : (facts.input ?? undefined)
    : (decisionWorld.liveInput ?? decisionWorld.run?.input)
  const currentAccountId = useRef(currentInput?.warehouse.accountId)
  const accountId = currentInput?.warehouse.accountId
  useLayoutEffect(() => {
    currentAccountId.current = accountId
    return () => {
      currentAccountId.current = undefined
    }
  }, [accountId])
  const data = currentInput
    ? {
        accountId: currentInput.warehouse.accountId!,
        roster: currentInput.warehouse.roster,
        priorityAgentIds: currentInput.developmentPriorityAgentIds,
        activePlans: currentInput.activePlanIds,
        planningDrafts: currentInput.drafts,
      }
    : decisionWorld.status === 'loading' || (facts.enabled && facts.loading)
      ? undefined
      : null
  const advicePending =
    facts.enabled && !projectionRun
      ? !facts.value && !facts.noOwnedAgents
      : decisionWorld.status === 'loading'
  const directoryProjection = projectionRun?.developmentDirectory
  const scaffold = directoryScaffold?.status === 'ready' ? directoryScaffold : null
  const scaffoldRosterAgents = scaffold?.roster.agents
  const rosterAgents = data?.roster.agents
  const planningDrafts = data?.planningDrafts
  const activePlans = data?.activePlans
  const priorityAgentIds = useMemo(
    () =>
      accountId && priorityOverride?.accountId === accountId
        ? priorityOverride.ids
        : (data?.priorityAgentIds ?? scaffold?.priorityAgentIds ?? []),
    [accountId, data?.priorityAgentIds, priorityOverride, scaffold?.priorityAgentIds],
  )
  const priorityOrder = useMemo(
    () => new Map(priorityAgentIds.map((id, index) => [id, index])),
    [priorityAgentIds],
  )
  const catalogOrder = useMemo(
    () =>
      new Map<string, number>(
        publicDevelopmentDirectoryCatalog.map((entry, index) => [entry.stableId, index] as const),
      ),
    [],
  )
  const catalogJoin = useMemo(
    () => projectAgentDevelopmentCatalogJoin(rosterAgents ?? [], publicDevelopmentDirectoryCatalog),
    [rosterAgents],
  )
  const eligibleOwnedAgentIds = useMemo(
    () => new Set(catalogJoin.eligibleOwnedAgentIds),
    [catalogJoin.eligibleOwnedAgentIds],
  )
  const decisions = useMemo(
    () =>
      new Map(
        (directoryProjection?.decisions ?? []).map((entry) => [entry.agentId, entry] as const),
      ),
    [directoryProjection],
  )
  const sourceDecisions = useMemo(
    () => new Map((facts.value?.decisions ?? []).map((entry) => [entry.agentId, entry] as const)),
    [facts.value],
  )
  const rosterById = useMemo(
    () => new Map((rosterAgents ?? []).map((agent) => [agent.agentId, agent] as const)),
    [rosterAgents],
  )
  const draftById = useMemo(
    () => new Map((planningDrafts ?? []).map((plan) => [plan.id, plan] as const)),
    [planningDrafts],
  )
  const savedTeamAgentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const plan of planningDrafts ?? [])
      if (plan.kind === 'team' && plan.state === 'saved')
        plan.selection.agentIds.forEach((agentId) => ids.add(agentId))
    return ids
  }, [planningDrafts])
  const discIndex = useMemo(
    () => createDevelopmentDirectoryDiscIndex(currentInput?.warehouse.discs),
    [currentInput?.warehouse.discs],
  )
  const directoryAgents = useMemo<AgentSummary[]>(() => {
    if (!rosterAgents || !planningDrafts || !activePlans) return []
    return publicDevelopmentDirectoryCatalog
      .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
      .flatMap<AgentSummary>((entry) => {
        const agentId = entry.stableId
        if (!eligibleOwnedAgentIds.has(agentId)) return []
        const record = rosterById.get(agentId)
        if (!record?.owned) return []
        const activePlanId = activePlans[agentId]
        const activePlan = activePlanId ? draftById.get(activePlanId) : undefined
        const decision = decisions.get(agentId)
        const sourceDecision = projectionRun ? undefined : sourceDecisions.get(agentId)
        const decisionStatus = staleDirectory
          ? 'stale'
          : (decision?.current.status ?? 'unsupported')
        const hasReliableTarget = decisionStatus !== 'unsupported' && decisionStatus !== 'stale'
        // The training projector reads only source skills and priority groups; no authority is synthesized.
        const training = projectDirectorySkillTraining({
          agent: record,
          decision: (decision ?? sourceDecision) as Parameters<
            typeof projectDirectorySkillTraining
          >[0]['decision'],
        })
        let skillStatus: import('../features/agentDevelopmentGolden/types').AgentSkillTrainingStatus
        if (advicePending) {
          skillStatus = 'pending'
        } else if (staleDirectory || decisionStatus === 'stale') {
          skillStatus = 'stale'
        } else skillStatus = training.status
        return [
          {
            agentId,
            name: entry.playerName,
            rarity: entry.rarity === 'A' ? 'A' : 'S',
            attribute: entry.attribute,
            specialty: entry.specialty,
            favorite: priorityOrder.has(agentId),
            visual: { kind: 'avatar', src: '', fallback: 'initials' },
            level: record.level,
            mindscape: record.mindscape,
            status: activePlan
              ? '已有方案'
              : advicePending
                ? '待确认'
                : priorityOrder.has(agentId)
                  ? '培养中'
                  : decisionStatus === 'stale'
                    ? '待确认'
                    : hasReliableTarget
                      ? '可继续'
                      : '待确认',
            guideNote: activePlan
              ? `${isPlayerFacingPlanName(activePlan.name) ? activePlan.name : '培养方案'} 已保存`
              : advicePending
                ? '正在核对养成建议；角色资料可先浏览。'
                : staleDirectory
                  ? (decision?.staleSummary ?? '账户资料已变化，请重新分析养成建议。')
                  : (decision?.current.summary ??
                    (sourceDecision
                      ? '查看技能升级顺序、音擎选择和驱动盘搭配。'
                      : '当前还没有包含该代理人的完整三人队伍建议。')),
            plan:
              activePlan && isPlayerFacingPlanName(activePlan.name) ? activePlan.name : undefined,
            reliableTarget: hasReliableTarget,
            decisionAuthorityState:
              decisionStatus === 'stale'
                ? 'stale'
                : decision?.authority
                  ? 'ready'
                  : sourceDecision
                    ? undefined
                    : 'unsupported',
            teamRating: decision?.authority?.teamRating,
            cultivationPriority: decision?.authority?.cultivationPriority,
            confidence: decision?.authority?.confidence,
            nextTrainingSteps: training.nextTrainingSteps,
            cinemaLevels: projectionRun
              ? decision?.cinemaLevels
              : (sourceDecision?.cinemaLevels ?? null),
            equipmentProgress: projectDevelopmentDirectoryEquipmentProgress(record, discIndex),
            skillStatus,
            trainingContext: {
              hasPrioritySkillGap:
                skillStatus === 'has-gaps' &&
                Boolean(
                  (decision ?? sourceDecision)?.skills.some(
                    (skill) =>
                      skill.priority &&
                      skill.targetLevel !== null &&
                      record.skillLevels[skill.key] !== null &&
                      record.skillLevels[skill.key]! < skill.targetLevel!,
                  ),
                ),
              inSavedTeam: savedTeamAgentIds.has(agentId),
            },
          },
        ]
      })
      .sort(
        (left, right) =>
          (priorityOrder.get(left.agentId) ?? Number.MAX_SAFE_INTEGER) -
            (priorityOrder.get(right.agentId) ?? Number.MAX_SAFE_INTEGER) ||
          (catalogOrder.get(left.agentId) ?? Number.MAX_SAFE_INTEGER) -
            (catalogOrder.get(right.agentId) ?? Number.MAX_SAFE_INTEGER),
      )
  }, [
    activePlans,
    advicePending,
    catalogOrder,
    decisions,
    discIndex,
    draftById,
    eligibleOwnedAgentIds,
    priorityOrder,
    planningDrafts,
    rosterById,
    rosterAgents,
    savedTeamAgentIds,
    sourceDecisions,
    projectionRun,
    staleDirectory,
  ])
  const scaffoldDirectoryAgents = useMemo(
    () => projectDirectoryScaffold(scaffoldRosterAgents, priorityOrder, catalogOrder),
    [catalogOrder, priorityOrder, scaffoldRosterAgents],
  )
  const usingScaffold =
    data === undefined &&
    directoryScaffold?.status === 'ready' &&
    scaffoldDirectoryAgents.length > 0
  const displayAccountId = data?.accountId ?? (usingScaffold ? scaffold?.accountId : undefined)
  const directoryAgentsForDisplay = data ? directoryAgents : scaffoldDirectoryAgents

  if (decisionWorld.status === 'error' && !facts.enabled)
    return <AgentDevelopmentReadError message={decisionWorld.message} />
  if (facts.enabled && facts.error && !projectionRun)
    return <AgentDevelopmentReadError message="当前养成资料暂未读取完整。" onRetry={facts.retry} />
  if (facts.enabled && facts.noAccount && !currentInput)
    return <AccountRequiredState title="先创建或选择账户" />
  if (data === undefined && directoryScaffold?.status === 'failed')
    return (
      <section className="panel" role="alert">
        <h1>暂时无法读取代理人基础资料</h1>
        <button className="button" type="button" onClick={directoryScaffold.retry}>
          重试
        </button>
      </section>
    )
  if (data === undefined && !usingScaffold)
    return <AppLoadingState heading="代理人养成" title="正在读取当前账户…" compact />
  if (data === null) {
    return <AccountRequiredState title="先创建或选择账户" />
  }
  if (!advicePending && !projectionRun && !facts.value && !facts.noOwnedAgents)
    return <p role="status">养成建议暂不可用。</p>
  if (
    projectionRun &&
    (directoryProjection?.contract !== 'soda-development-directory/v1' ||
      directoryProjection.runId !== projectionRun.runId ||
      directoryProjection.accountId !== data?.accountId ||
      directoryProjection.inputFingerprint !== projectionRun.inputFingerprint)
  )
    return <p role="status">养成建议需要重新分析，请刷新页面后重试。</p>

  if (!directoryAgentsForDisplay.length && (!data || !catalogJoin.unmappedOwnedAgentIds.length)) {
    if (advicePending)
      return <AppLoadingState heading="代理人养成" title="正在整理养成建议…" compact />
    return (
      <WorkbenchEmptyState
        title="还没有已拥有代理人"
        description="请先在资产维护中记录代理人资产。"
        action={
          <Link className="button button--primary" to="/assets/agents">
            前往代理人资产
          </Link>
        }
      />
    )
  }

  return (
    <div className="agent-development-directory">
      {staleRefreshKey && refreshFailureKey === staleRefreshKey ? (
        <section className="panel" role="alert">
          <p>养成建议更新失败。</p>
          <button
            className="button"
            type="button"
            onClick={() => {
              const key = staleRefreshKey
              const accountId = staleAccountId
              setRefreshFailureKey(null)
              void refresh()
                .then((run) =>
                  recordRefreshFailure(key, run?.input.warehouse.accountId === accountId),
                )
                .catch(() => recordRefreshFailure(key, false))
            }}
          >
            重试
          </button>
        </section>
      ) : null}
      {data && deleteTarget?.accountId === data.accountId ? (
        <SavedOverviewDeleteDialog
          accountId={deleteTarget.accountId}
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => setDeleteTarget(null)}
        />
      ) : null}
      {directoryAgentsForDisplay.length && displayAccountId ? (
        <AgentDevelopmentDirectoryShell
          key={displayAccountId}
          browseAccountId={displayAccountId}
          directoryAgents={directoryAgentsForDisplay}
          onDeleteAgentPlan={
            data
              ? (agentId) => {
                  const plan = data.planningDrafts.find(
                    (item) =>
                      item.id === data.activePlans[agentId] &&
                      item.kind === 'agent' &&
                      item.selection.agentIds.length === 1 &&
                      item.selection.agentIds[0] === agentId,
                  )
                  if (plan)
                    setDeleteTarget({
                      accountId: data.accountId,
                      id: plan.id,
                      title: `${directoryAgentsForDisplay.find((agent) => agent.agentId === agentId)?.name ?? '代理人'} · 已保存配装`,
                    })
                }
              : undefined
          }
          openAgent={(agentId) => navigate(`/development/${agentId}`)}
          openSavedAgent={
            data
              ? (agentId) => {
                  const savedPlan = data.planningDrafts.find(
                    (plan) => plan.id === data.activePlans[agentId] && plan.kind === 'agent',
                  )
                  // A saved plan belongs in the established single-agent workbench. Keep its
                  // identity in the route so the workbench cannot substitute the current plan
                  // or a candidate solve while the player is inspecting history.
                  navigate(
                    savedPlan
                      ? `/development/${agentId}?plan=${encodeURIComponent(savedPlan.id)}`
                      : `/development/${agentId}`,
                  )
                }
              : undefined
          }
          onToggleFavorite={
            data
              ? async (agentId) => {
                  const next = priorityAgentIds.includes(agentId)
                    ? priorityAgentIds.filter((id) => id !== agentId)
                    : [...priorityAgentIds, agentId]
                  await saveDevelopmentPriorityAgentIds(data.accountId, next)
                  if (currentAccountId.current === data.accountId)
                    setPriorityOverride({ accountId: data.accountId, ids: next })
                }
              : undefined
          }
        />
      ) : null}
      {data && catalogJoin.unmappedOwnedAgentIds.length ? (
        <section className="panel" aria-labelledby="unmapped-agent-records-title">
          <h1 id="unmapped-agent-records-title">部分代理人资料暂不可用</h1>
          <p>
            已记录 {catalogJoin.unmappedOwnedAgentIds.length}{' '}
            名已拥有代理人的资料暂时无法识别，可前往资产维护核对。
          </p>
          <details>
            <summary>打开代理人识别诊断</summary>
            <ul aria-label="暂未识别的代理人记录">
              {catalogJoin.unmappedOwnedAgentIds.map((agentId) => (
                <li key={agentId}>
                  <code>{agentId}</code>
                </li>
              ))}
            </ul>
          </details>
          <Link className="button button--primary" to="/assets/agents">
            前往资产维护核对
          </Link>
        </section>
      ) : null}
    </div>
  )
}

function isPlayerFacingPlanName(name: string) {
  return !/AGENT-DEVELOPMENT|WORKBENCH|^[A-Z0-9_-]{12,}$/i.test(name)
}
