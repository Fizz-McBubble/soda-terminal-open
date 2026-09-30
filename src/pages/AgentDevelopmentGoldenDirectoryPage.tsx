import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppLoadingState } from '../components/AppEntryState'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import { saveDevelopmentPriorityAgentIds } from '../accounts/developmentPlanning'
import { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import { AgentDevelopmentGolden, type AgentSummary } from '../features/agentDevelopmentGolden'
import { AgentDevelopmentReadError } from './AgentDevelopmentReadError'
import { SavedOverviewDeleteDialog } from './SavedOverviewDeleteDialog'
import { projectAgentDevelopmentCatalogJoin } from './agentDevelopmentCatalogJoin'

export function AgentDevelopmentGoldenDirectoryPage() {
  const navigate = useNavigate()
  const decisionWorld = useAccountDecisionWorld()
  const refresh = decisionWorld.refresh
  const staleAccountId = decisionWorld.liveInput?.warehouse.accountId
  const staleRefreshKey =
    decisionWorld.status === 'stale' && staleAccountId && decisionWorld.liveFingerprint
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
  const currentInput = decisionWorld.liveInput ?? decisionWorld.run?.input
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
    : decisionWorld.status === 'loading'
      ? undefined
      : null

  if (decisionWorld.status === 'error')
    return <AgentDevelopmentReadError message={decisionWorld.message} />
  if (data === undefined) return <AppLoadingState title="正在读取当前账户…" compact />
  if (!data) {
    return <AccountRequiredState title="先创建或选择账户" />
  }
  const advicePending = decisionWorld.status === 'loading'
  const projectionRun =
    decisionWorld.status === 'current' || decisionWorld.status === 'stale'
      ? decisionWorld.run
      : null
  if (!advicePending && !projectionRun)
    return <p role="status">暂时无法整理养成建议，请刷新页面重试。</p>
  const directoryProjection = projectionRun?.developmentDirectory
  if (
    projectionRun &&
    (directoryProjection?.contract !== 'soda-development-directory/v1' ||
      directoryProjection.runId !== projectionRun.runId ||
      directoryProjection.accountId !== data.accountId ||
      directoryProjection.inputFingerprint !== projectionRun.inputFingerprint)
  )
    return <p role="status">养成建议需要重新分析，请刷新页面后重试。</p>

  const priorityAgentIds =
    priorityOverride?.accountId === data.accountId ? priorityOverride.ids : data.priorityAgentIds
  const priorityOrder = new Map(priorityAgentIds.map((id, index) => [id, index]))
  const catalogOrder = new Map<string, number>(
    publicDevelopmentDirectoryCatalog.map((entry, index) => [entry.stableId, index] as const),
  )
  const catalogJoin = projectAgentDevelopmentCatalogJoin(
    data.roster.agents,
    publicDevelopmentDirectoryCatalog,
  )
  const eligibleOwnedAgentIds = new Set(catalogJoin.eligibleOwnedAgentIds)
  const decisions = new Map(
    (directoryProjection?.decisions ?? []).map((entry) => [entry.agentId, entry]),
  )
  const directoryAgents = publicDevelopmentDirectoryCatalog
    .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
    .flatMap<AgentSummary>((entry) => {
      const agentId = entry.stableId
      if (!eligibleOwnedAgentIds.has(agentId)) return []
      const name = entry.playerName
      const specialty = entry.specialty
      const attribute = entry.attribute
      const record = data.roster.agents.find((agent) => agent.agentId === agentId)
      if (!record?.owned) return []
      const activePlan = data.planningDrafts.find((plan) => plan.id === data.activePlans[agentId])
      const decision = decisions.get(agentId)
      const decisionStatus =
        decisionWorld.status === 'stale' ? 'stale' : (decision?.current.status ?? 'unsupported')
      const hasReliableTarget = decisionStatus !== 'unsupported' && decisionStatus !== 'stale'
      const skillTargets =
        advicePending || decisionWorld.status === 'stale' ? [] : (decision?.skills ?? [])
      const nextTrainingSteps = skillTargets
        .filter(
          (skill) =>
            skill.targetLevel !== null &&
            record.skillLevels[skill.key] !== null &&
            record.skillLevels[skill.key]! < skill.targetLevel,
        )
        .sort((left, right) => Number(right.priority) - Number(left.priority))
        .map((skill) => `${skill.label} ${record.skillLevels[skill.key]} → ${skill.targetLevel}级`)
      return [
        {
          agentId,
          name,
          rarity: entry.rarity === 'A' ? 'A' : 'S',
          attribute,
          specialty,
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
              : decisionWorld.status === 'stale'
                ? (decision?.staleSummary ?? '账户资料已变化，请重新分析养成建议。')
                : (decision?.current.summary ?? '当前还没有包含该代理人的完整三人队伍建议。'),
          plan: activePlan && isPlayerFacingPlanName(activePlan.name) ? activePlan.name : undefined,
          reliableTarget: hasReliableTarget,
          decisionAuthorityState:
            decisionStatus === 'stale' ? 'stale' : decision?.authority ? 'ready' : 'unsupported',
          teamRating: decision?.authority?.teamRating,
          cultivationPriority: decision?.authority?.cultivationPriority,
          confidence: decision?.authority?.confidence,
          nextTrainingSteps,
          trainingContext: {
            hasPrioritySkillGap: skillTargets.some(
              (skill) =>
                skill.priority &&
                skill.targetLevel !== null &&
                record.skillLevels[skill.key] !== null &&
                record.skillLevels[skill.key]! < skill.targetLevel,
            ),
            inSavedTeam: data.planningDrafts.some(
              (plan) =>
                plan.kind === 'team' &&
                plan.state === 'saved' &&
                plan.selection.agentIds.includes(agentId),
            ),
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

  if (!directoryAgents.length && !catalogJoin.unmappedOwnedAgentIds.length) {
    if (advicePending) return <AppLoadingState title="正在整理养成建议…" compact />
    return (
      <section className="panel">
        <h1>还没有已拥有代理人</h1>
        <p>请先在资产维护中记录代理人资产。</p>
        <Link className="button button--primary" to="/assets/agents">
          前往代理人资产
        </Link>
      </section>
    )
  }

  return (
    <>
      {advicePending ? (
        <p className="panel" role="status" aria-live="polite">
          正在核对养成建议；代理人资料与已保存方案可先查看。
        </p>
      ) : null}
      {staleRefreshKey && refreshFailureKey === staleRefreshKey ? (
        <section className="panel" role="alert">
          <p>养成资料暂未更新，已保存的数据仍保留。</p>
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
      {deleteTarget?.accountId === data.accountId ? (
        <SavedOverviewDeleteDialog
          accountId={deleteTarget.accountId}
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => setDeleteTarget(null)}
        />
      ) : null}
      {directoryAgents.length ? (
        <AgentDevelopmentGolden
          key={data.accountId}
          initialView="overview"
          directoryAgents={directoryAgents}
          onDeleteAgentPlan={(agentId) => {
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
                title: `${directoryAgents.find((agent) => agent.agentId === agentId)?.name ?? '代理人'} · 已保存配装`,
              })
          }}
          onOpenAgent={(agentId) => navigate(`/development/${agentId}`)}
          onOpenSavedAgent={(agentId) => {
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
          }}
          onToggleFavorite={async (agentId) => {
            const next = priorityAgentIds.includes(agentId)
              ? priorityAgentIds.filter((id) => id !== agentId)
              : [...priorityAgentIds, agentId]
            await saveDevelopmentPriorityAgentIds(data.accountId, next)
            if (currentAccountId.current === data.accountId)
              setPriorityOverride({ accountId: data.accountId, ids: next })
          }}
        />
      ) : null}
      {catalogJoin.unmappedOwnedAgentIds.length ? (
        <section className="panel" aria-labelledby="unmapped-agent-records-title">
          <h1 id="unmapped-agent-records-title">部分代理人资料暂不可用</h1>
          <p>
            已记录 {catalogJoin.unmappedOwnedAgentIds.length}{' '}
            名已拥有代理人的资料暂时无法识别，可前往资产维护核对。
          </p>
          <details>
            <summary>查看记录编号</summary>
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
    </>
  )
}

function isPlayerFacingPlanName(name: string) {
  return !/AGENT-DEVELOPMENT|WORKBENCH|^[A-Z0-9_-]{12,}$/i.test(name)
}
