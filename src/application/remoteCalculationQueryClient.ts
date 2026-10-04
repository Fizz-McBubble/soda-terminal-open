import { acceptReviewedIncrementalEventResult32 } from './publicReviewedIncrementalEvent32'
import { acceptCommonAnomalySettlementQuery32 } from './publicCommonAnomalySettlementQuery32'
import { acceptPlanningBenchmarkResult32 } from './publicPlanningBenchmark32'
import { planningEventDeclarationsInputFingerprint32 } from './publicPlanningEventDeclarations32'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CalculationQueryClient } from './calculationQueryContract'
import type { AccountDecisionQueryInput } from './calculationQueryContract'
import { contentHash } from './contentHash'
import { projectRemoteAccountDecisionInput } from './remoteCalculationInput'
import { unpackPublicWarehouseActions } from './publicWarehouseActionTransport'
import {
  remoteCalculationProtocolVersion,
  type RemoteCalculationRequest,
  type RemoteTaskReceipt,
  type RemoteTaskState,
} from './remoteCalculationProtocol'

type Fetcher = typeof fetch
type PendingHandle = { taskId: string | null; controller: AbortController }

/** The browser tracks only facts it sent; model and rule hashes remain server-owned. */
function browserInputFingerprint(input: AccountDecisionQueryInput) {
  const projected = projectRemoteAccountDecisionInput(input)
  return contentHash({
    ...projected,
    warehouse: {
      ...projected.warehouse,
      roster: {
        ...projected.warehouse.roster,
        updatedAt: undefined,
        agents: projected.warehouse.roster.agents.map((agent) => ({
          ...agent,
          syncedAt: undefined,
        })),
      },
    },
  })
}

export function createRemoteCalculationQueryClient(options: {
  fetcher?: Fetcher
  readRuntimeSelection: () => Promise<CurrentGameDataRuntimeSelection>
  pollIntervalMs?: number
}): CalculationQueryClient {
  const fetcher = options.fetcher ?? fetch
  const readRuntimeSelection = options.readRuntimeSelection
  const pollIntervalMs = options.pollIntervalMs ?? 250
  const maxPollIntervalMs = Math.max(pollIntervalMs, 2_000)
  const pending = new Map<string, Set<PendingHandle>>()
  let currentFingerprint: { runId: string; browser: string; server: string } | null = null
  let session: Promise<void> | null = null

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response
    try {
      response = await fetcher(`/api/calculation/${path}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...init,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      throw new Error('无法连接在线计算服务，请检查网络后重试。', { cause: error })
    }
    const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null
    if (response.status === 401) {
      // The server owns the cookie and run handles. A stale browser handle must
      // not keep a previous server fingerprint after that session disappears.
      session = null
      currentFingerprint = null
      throw new Error('在线计算会话已结束，请重新分析。')
    }
    if (!response.ok)
      throw new Error(body?.error ?? `计算服务返回 ${response.status}，请稍后重试。`)
    if (!body) throw new Error('在线计算服务返回了无效结果，请稍后重试。')
    return body
  }

  async function ensureSession() {
    session ??= request('session', { method: 'POST' })
      .then(() => undefined)
      .catch((error: unknown) => {
        session = null
        throw error
      })
    return session
  }

  async function submit<T>(
    runId: string,
    payload: RemoteCalculationRequest,
    signal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) controller.abort()
    const handle: PendingHandle = { taskId: null, controller }
    const handles = pending.get(runId) ?? new Set<PendingHandle>()
    handles.add(handle)
    pending.set(runId, handles)
    try {
      await ensureSession()
      controller.signal.throwIfAborted()
      const receipt = await request<RemoteTaskReceipt>('tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      handle.taskId = receipt.taskId
      if (controller.signal.aborted) {
        void request(`tasks/${receipt.taskId}`, { method: 'DELETE' }).catch(() => undefined)
        controller.signal.throwIfAborted()
      }
      let nextPollIntervalMs = pollIntervalMs
      let lastStatus: RemoteTaskState['status'] | null = null
      while (true) {
        controller.signal.throwIfAborted()
        const state = await request<RemoteTaskState>(`tasks/${receipt.taskId}`, {
          signal: controller.signal,
        })
        if (state.status === 'succeeded') return state.result as T
        if (state.status === 'failed' || state.status === 'cancelled') throw new Error(state.error)
        if (lastStatus === 'queued' && state.status === 'running')
          nextPollIntervalMs = pollIntervalMs
        lastStatus = state.status
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer)
            reject(new DOMException('已取消本次计算。', 'AbortError'))
          }
          const timer = setTimeout(
            () => {
              controller.signal.removeEventListener('abort', onAbort)
              resolve()
            },
            Math.min(
              maxPollIntervalMs,
              Math.round(nextPollIntervalMs * (0.8 + Math.random() * 0.4)),
            ),
          )
          controller.signal.addEventListener('abort', onAbort, { once: true })
        })
        nextPollIntervalMs = Math.min(nextPollIntervalMs * 2, maxPollIntervalMs)
      }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      if (controller.signal.aborted && handle.taskId)
        void request(`tasks/${handle.taskId}`, { method: 'DELETE' }).catch(() => undefined)
      handles.delete(handle)
      if (handles.size === 0) pending.delete(runId)
    }
  }

  return {
    releaseAccountDecisionRun(runId) {
      if (currentFingerprint?.runId === runId) currentFingerprint = null
      const tasks = pending.get(runId)
      if (tasks) {
        for (const task of tasks) {
          task.controller.abort()
          if (task.taskId)
            void request(`tasks/${task.taskId}`, { method: 'DELETE' }).catch(() => undefined)
        }
        pending.delete(runId)
      }
      void request(`runs/${encodeURIComponent(runId)}`, { method: 'DELETE' }).catch(() => undefined)
    },
    fingerprintAccountDecisionInput(input, currentRunId) {
      const browser = browserInputFingerprint(input)
      const matched = currentFingerprint
      return matched && matched.runId === currentRunId && matched.browser === browser
        ? matched.server
        : browser
    },
    async calculateAccountDecision(query) {
      const runtime = await readRuntimeSelection()
      if (runtime.status !== 'compiled_current') throw new Error(runtime.message)
      const run = await submit<
        Awaited<ReturnType<CalculationQueryClient['calculateAccountDecision']>>
      >(query.runId, {
        protocolVersion: remoteCalculationProtocolVersion,
        runtime: {
          packageId: runtime.packageId,
          packageVersion: runtime.packageVersion,
          gameVersion: runtime.gameVersion,
        },
        query: { ...query, input: projectRemoteAccountDecisionInput(query.input) },
      })
      currentFingerprint = {
        runId: query.runId,
        browser: browserInputFingerprint(query.input),
        server: run.inputFingerprint,
      }
      return {
        ...run,
        input: query.input,
        warehouseActions: run.warehouseActions
          ? unpackPublicWarehouseActions(run.warehouseActions)
          : undefined,
      }
    },
    calculateTargetTeamWarehouseFit(query) {
      return submit(query.runId, { protocolVersion: remoteCalculationProtocolVersion, query })
    },
    queryTeamOverviewPresentation(query) {
      return submit(query.runId, { protocolVersion: remoteCalculationProtocolVersion, query })
    },
    queryTeamRoutePresentation(query) {
      return submit(query.runId, { protocolVersion: remoteCalculationProtocolVersion, query })
    },
    querySavedTeamPlanReplay(query) {
      return submit(query.runId, { protocolVersion: remoteCalculationProtocolVersion, query })
    },
    querySavedTeamSolutionComponents(query) {
      return submit(query.runId, {
        protocolVersion: remoteCalculationProtocolVersion,
        query: { ...query, currentInput: projectRemoteAccountDecisionInput(query.currentInput) },
      })
    },
    async queryDecisionPortfolio() {
      throw new Error('在线版暂不支持多队查询。')
    },
    queryDevelopmentCandidateAlternatives(query) {
      return submit(query.runId, { protocolVersion: remoteCalculationProtocolVersion, query })
    },
    async queryCommonAnomalySettlement32(request) {
      const query = structuredClone(request)
      const result = await submit(query.runId, {
        protocolVersion: remoteCalculationProtocolVersion,
        query,
      })
      return acceptCommonAnomalySettlementQuery32(result, query)
    },
    async queryReviewedIncrementalEvent32(query) {
      const result = await submit(query.runId, {
        protocolVersion: remoteCalculationProtocolVersion,
        query,
      })
      return acceptReviewedIncrementalEventResult32(result, query.runId, query.input)
    },
    async queryPlanningBenchmark32(request) {
      const query = structuredClone(request)
      if (query.declarations && !query.sourceBindingFingerprint)
        throw new Error('请先获取当前配装的事件声明来源，再提交计算。')
      const result = await submit(query.runId, {
        protocolVersion: remoteCalculationProtocolVersion,
        query,
      })
      return acceptPlanningBenchmarkResult32(result, {
        runId: query.runId,
        candidateId: query.candidateId,
        fitFingerprint: query.fitFingerprint,
        accountFingerprint: query.accountFingerprint,
        inputFingerprint: query.declarations
          ? planningEventDeclarationsInputFingerprint32(query.declarations)
          : null,
        sourceBindingFingerprint: query.sourceBindingFingerprint,
      })
    },
    queryDevelopmentWorkbenchRoute(query) {
      return submit(query.runId, { protocolVersion: remoteCalculationProtocolVersion, query })
    },
    queryWarehouseDiscTransitionUses(query, options) {
      return submit(
        query.runId,
        { protocolVersion: remoteCalculationProtocolVersion, query },
        options?.signal,
      )
    },
  }
}
