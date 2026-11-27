import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CalculationQueryClient } from './calculationQueryContract'
import { unpackPublicWarehouseActions } from './publicWarehouseActionTransport'
import { warehouseAnalysisStopReason } from './warehouseActionContract'
import * as factsTransport from './browserDevelopmentFactsClient'
import { createBrowserPlanningQueries } from './browserPlanningQueries'
import {
  createBrowserAccountDecisionCalculation,
  createBrowserPersonalDevelopmentClient,
} from './browserPersonalDevelopmentClient'
import { browserCalculationInputFingerprint } from './browserCalculationInputFingerprint'
import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQuery,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'

type WorkerPort = Pick<Worker, 'postMessage' | 'terminate'> & {
  onmessage: ((event: MessageEvent<BrowserCalculationQueryResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null
}

type PendingRequest = {
  ownerKey: string
  query: BrowserCalculationQuery
  resolve(value: never): void
  reject(error: Error): void
  runtime?: Extract<CurrentGameDataRuntimeSelection, { status: 'compiled_current' }>
  deadlineAt: number
  timeout: ReturnType<typeof setTimeout>
  removeAbortListener(): void
}

function queryError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function defaultModuleWorker(): WorkerPort {
  return new Worker(new URL('./browserCalculationQuery.worker.ts', import.meta.url), {
    type: 'module',
  })
}

type BrowserQueryClientOptions = {
  readRuntimeSelection: () => Promise<CurrentGameDataRuntimeSelection>
  createWorker?: () => WorkerPort
  createFactsWorker?: () => WorkerPort
  createPersonalWorker?: () => WorkerPort
  resultProjection?: 'local' | 'public-development'
}

type BrowserQueryClient = CalculationQueryClient & { prepareAccountDecision(): void }

/** Independent channels share the same queue implementation, without sharing run state. */
export function createBrowserCalculationQueryClient(
  options: BrowserQueryClientOptions,
): BrowserQueryClient {
  return createBrowserCalculationQueryChannel(options, false)
}

function createBrowserCalculationQueryChannel(
  options: BrowserQueryClientOptions,
  factsLane: boolean,
  personalLane = false,
): BrowserQueryClient {
  const pending = new Map<number, PendingRequest>()
  const queue: number[] = []
  const liveRuns = new Set<string>()
  const livePersonalSessions = new Set<string>()
  const runListeners = new Set<() => void>()
  const fingerprints = new Map<string, { browser: string; core: string }>()
  let worker: WorkerPort | null = null
  let workerReady = false
  let prepareOnReady = false
  let preparationSent = false
  let workerReadyTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  let active: { id: number; request: PendingRequest } | null = null
  let watchingDeadlines = false
  let nextRequestId = 1
  let factsClient: CalculationQueryClient | undefined
  let personalClient: CalculationQueryClient | undefined

  function notifyRunChange() {
    for (const listener of runListeners) listener()
  }

  function invalidate(error: Error) {
    generation += 1
    if (workerReadyTimer) clearTimeout(workerReadyTimer)
    workerReadyTimer = null
    if (worker) {
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
      worker = null
    }
    workerReady = false
    prepareOnReady = false
    preparationSent = false
    if (active) clearTimeout(active.request.timeout)
    for (const request of pending.values()) {
      clearTimeout(request.timeout)
      request.removeAbortListener()
      request.reject(error)
    }
    pending.clear()
    queue.length = 0
    active = null
    stopWatchingIdleDeadlines()
    const hadRuns = liveRuns.size > 0
    liveRuns.clear()
    livePersonalSessions.clear()
    fingerprints.clear()
    if (hadRuns) notifyRunChange()
  }

  function expireRequest(requestId: number) {
    const current = active?.id === requestId ? active : null
    const request = current?.request ?? pending.get(requestId)
    if (!request || Date.now() < request.deadlineAt) return
    if (current) {
      invalidate(
        queryError('BrowserCalculationTimeoutError', '本机计算超时，可在当前页面重新分析。'),
      )
      return
    }
    forgetRequest(requestId, request)
    request.reject(
      queryError('BrowserCalculationQueueTimeoutError', '本机计算排队超时，请稍后重试。'),
    )
    stopWatchingIdleDeadlines()
  }

  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    if (active) expireRequest(active.id)
    for (const requestId of pending.keys()) expireRequest(requestId)
  }

  function watchDeadlines() {
    if (watchingDeadlines || typeof document === 'undefined') return
    document.addEventListener('visibilitychange', onVisibilityChange)
    watchingDeadlines = true
  }

  function stopWatchingIdleDeadlines() {
    if (!watchingDeadlines || active || pending.size) return
    document.removeEventListener('visibilitychange', onVisibilityChange)
    watchingDeadlines = false
  }

  function forgetRequest(id: number, request: PendingRequest) {
    request.removeAbortListener()
    pending.delete(id)
    if (active?.id === id) return
    clearTimeout(request.timeout)
    const queueIndex = queue.indexOf(id)
    if (queueIndex !== -1) queue.splice(queueIndex, 1)
  }

  function finishActive() {
    if (!active) return
    const { id, request } = active
    clearTimeout(request.timeout)
    if (pending.has(id)) forgetRequest(id, request)
    active = null
    stopWatchingIdleDeadlines()
    dispatchNext()
  }

  function cancelRequest(id: number, request: PendingRequest, error: Error) {
    forgetRequest(id, request)
    request.reject(error)
    // A directory read holds no run state. Let its module imports finish in
    // the facts Worker so the workbench can reuse them after navigation.
    const detachedDirectory = factsLane && request.query.kind === 'development_directory_facts'
    // Other sent requests keep the serial slot and hard deadline until they reply.
    if (active?.id === id && (!request.runtime || detachedDirectory)) finishActive()
    stopWatchingIdleDeadlines()
  }

  function cancelOwnedRequests(ownerKey: string, error: Error, releaseOwner = false) {
    // Remove owned queued requests before an unsent active request advances the queue.
    for (const id of queue.slice()) {
      const request = pending.get(id)
      if (request?.ownerKey === ownerKey) cancelRequest(id, request, error)
    }
    if (!active || active.request.ownerKey !== ownerKey || !pending.has(active.id)) return
    if (releaseOwner && pending.size === 1 && !liveRuns.size && !livePersonalSessions.size) {
      invalidate(error)
      return
    }
    cancelRequest(active.id, active.request, error)
  }

  function ensureWorker() {
    if (worker) return worker
    const created = (options.createWorker ?? defaultModuleWorker)()
    const workerGeneration = generation
    created.onmessage = (event) => {
      if (workerGeneration !== generation) return
      const response = event.data
      if (response.protocolVersion !== browserCalculationQueryProtocolVersion) {
        invalidate(
          queryError('BrowserCalculationProtocolError', '计算版本不匹配，请刷新页面后重试。'),
        )
        return
      }
      if (response.status === 'ready') {
        if (workerReadyTimer) clearTimeout(workerReadyTimer)
        workerReadyTimer = null
        workerReady = true
        if (prepareOnReady) prepareAccountDecision()
        dispatchNext()
        return
      }
      const current = active
      if (!current || response.requestId !== current.id || !current.request.runtime) return
      const { request } = current
      if (Date.now() >= request.deadlineAt) {
        expireRequest(response.requestId)
        return
      }
      void (async () => {
        try {
          const runtime = await options.readRuntimeSelection()
          if (workerGeneration !== generation || active !== current) return
          if (Date.now() >= request.deadlineAt) {
            expireRequest(response.requestId)
            return
          }
          if (
            runtime.status !== 'compiled_current' ||
            !request.runtime ||
            runtime.packageId !== request.runtime.packageId ||
            runtime.packageVersion !== request.runtime.packageVersion ||
            runtime.gameVersion !== request.runtime.gameVersion ||
            (response.status === 'failed' &&
              response.error === '游戏资料版本不匹配，请刷新页面后重试。')
          )
            throw new Error('游戏资料已变化，请重新分析。')
          if (!pending.has(current.id)) return
          if (response.status === 'succeeded') request.resolve(response.result as never)
          else request.reject(new Error(response.error ?? '计算失败。'))
        } catch {
          if (workerGeneration !== generation || active !== current) return
          if (Date.now() >= request.deadlineAt) {
            expireRequest(response.requestId)
            return
          }
          invalidate(queryError('BrowserCalculationRuntimeError', '游戏资料已变化，请重新分析。'))
        } finally {
          if (workerGeneration === generation && active === current) finishActive()
        }
      })()
    }
    created.onerror = (event) => {
      if (workerGeneration !== generation) return
      invalidate(
        queryError(
          'BrowserCalculationWorkerError',
          event.message ? `本机计算异常：${event.message}` : '本机计算异常，请重新分析。',
        ),
      )
    }
    created.onmessageerror = () => {
      if (workerGeneration !== generation) return
      invalidate(queryError('BrowserCalculationMessageError', '计算结果无法读取，请重新分析。'))
    }
    worker = created
    workerReadyTimer = setTimeout(() => {
      if (workerGeneration === generation && !workerReady)
        invalidate(
          queryError(
            'BrowserCalculationWorkerStartupError',
            '本机计算程序未能启动，请刷新页面后重试。',
          ),
        )
    }, 30_000)
    return created
  }

  function prepareAccountDecision() {
    if (preparationSent) return
    try {
      const currentWorker = ensureWorker()
      if (!workerReady) {
        prepareOnReady = true
        return
      }
      prepareOnReady = false
      currentWorker.postMessage({
        protocolVersion: browserCalculationQueryProtocolVersion,
        kind: 'prepare_account_decision',
      } satisfies BrowserCalculationQueryRequest)
      preparationSent = true
    } catch {
      // The actual calculation still uses the normal startup and error handling path.
    }
  }

  function dispatchNext() {
    if (active) return
    if (!queue.length) return
    try {
      ensureWorker()
    } catch {
      invalidate(
        queryError(
          'BrowserCalculationWorkerStartupError',
          '本机计算程序未能启动，请刷新页面后重试。',
        ),
      )
      return
    }
    if (!workerReady) return
    let requestId = queue.shift()
    while (requestId !== undefined && !pending.has(requestId)) requestId = queue.shift()
    if (requestId === undefined) return
    const request = pending.get(requestId)!
    if (Date.now() >= request.deadlineAt) {
      expireRequest(requestId)
      dispatchNext()
      return
    }
    const current = { id: requestId, request }
    active = current
    const dispatchGeneration = generation
    void (async () => {
      try {
        const runtime = await options.readRuntimeSelection()
        if (dispatchGeneration !== generation || active !== current) return
        if (Date.now() >= request.deadlineAt) {
          expireRequest(requestId)
          return
        }
        if (runtime.status !== 'compiled_current') throw new Error(runtime.message)
        request.runtime = runtime
        const currentWorker = ensureWorker()
        currentWorker.postMessage({
          protocolVersion: browserCalculationQueryProtocolVersion,
          kind: 'query',
          requestId,
          runtime,
          query: request.query,
          ...(options.resultProjection ? { resultProjection: options.resultProjection } : {}),
        } satisfies BrowserCalculationQueryRequest)
      } catch (error) {
        if (dispatchGeneration !== generation || active !== current) return
        if (Date.now() >= request.deadlineAt) {
          expireRequest(requestId)
          return
        }
        // Keep the active request in pending so invalidation settles it together with
        // every queued request and discards the Worker after a failed dispatch.
        invalidate(error instanceof Error ? error : new Error('无法启动本机计算。'))
      }
    })()
  }

  function submit<T>(query: BrowserCalculationQuery, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(queryError('AbortError', '已取消本次计算。'))
    return new Promise<T>((resolve, reject) => {
      const requestId = nextRequestId++
      const abort = () => {
        const request = pending.get(requestId)
        if (!request) return
        if (
          active?.id === requestId &&
          request.runtime &&
          query.kind === 'warehouse_actions' &&
          signal?.reason === warehouseAnalysisStopReason
        ) {
          // A sent warehouse calculation cannot process a cancel message while it is working.
          invalidate(queryError('AbortError', '仓库分析已取消，可重新分析。'))
          return
        }
        const canStopPersonalSolve =
          (query.kind === 'personal_development_open' ||
            query.kind === 'personal_development_candidates') &&
          (livePersonalSessions.size === 0 ||
            (livePersonalSessions.size === 1 && livePersonalSessions.has(query.sessionId)))
        if (
          active?.id === requestId &&
          request.runtime &&
          pending.size === 1 &&
          !liveRuns.size &&
          ((factsLane && query.kind !== 'development_directory_facts') || canStopPersonalSolve)
        ) {
          invalidate(queryError('AbortError', '本机计算已取消，请重新分析。'))
          return
        }
        cancelRequest(requestId, request, queryError('AbortError', '已取消本次计算。'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      const deadlineAt = Date.now() + 120_000
      const timeout = setTimeout(() => expireRequest(requestId), 120_000)
      pending.set(requestId, {
        ownerKey:
          'runId' in query
            ? `run:${query.runId}`
            : 'sessionId' in query
              ? `personal:${query.sessionId}`
              : `facts:${query.operationId}`,
        query,
        resolve: resolve as (value: never) => void,
        reject,
        deadlineAt,
        timeout,
        removeAbortListener: () => signal?.removeEventListener('abort', abort),
      })
      queue.push(requestId)
      watchDeadlines()
      dispatchNext()
    })
  }

  function release(runId: string) {
    const hadRun = liveRuns.delete(runId)
    fingerprints.delete(runId)
    if (hadRun) notifyRunChange()
    cancelOwnedRequests(`run:${runId}`, queryError('AbortError', '本次分析已释放。'), true)
    postRelease({
      protocolVersion: browserCalculationQueryProtocolVersion,
      kind: 'release',
      runId,
    } satisfies BrowserCalculationQueryRequest)
  }

  function postRelease(request: Exclude<BrowserCalculationQueryRequest, { kind: 'query' }>) {
    try {
      worker?.postMessage(request)
    } catch {
      invalidate(queryError('BrowserCalculationWorkerError', '本机计算异常，请重新分析。'))
    }
  }

  function releasePersonal(sessionId: string) {
    livePersonalSessions.delete(sessionId)
    cancelOwnedRequests(`personal:${sessionId}`, queryError('AbortError', '个人搭配已释放。'), true)
    postRelease({
      protocolVersion: browserCalculationQueryProtocolVersion,
      kind: 'release_personal',
      sessionId,
    })
  }

  function getFactsClient() {
    factsClient ??= createBrowserCalculationQueryChannel(
      {
        readRuntimeSelection: options.readRuntimeSelection,
        createWorker:
          options.createFactsWorker ?? options.createWorker ?? factsTransport.createWorker,
        resultProjection: options.resultProjection ?? 'local',
      },
      true,
    )
    return factsClient
  }

  function getPersonalClient() {
    personalClient ??= createBrowserCalculationQueryChannel(
      {
        readRuntimeSelection: options.readRuntimeSelection,
        createWorker: options.createPersonalWorker ?? options.createWorker,
        resultProjection: options.resultProjection ?? 'local',
      },
      false,
      true,
    )
    return personalClient
  }

  return {
    prepareAccountDecision,
    releaseAccountDecisionRun: release,
    hasAccountDecisionRun: (runId) => liveRuns.has(runId),
    subscribeAccountDecisionRuns(listener) {
      runListeners.add(listener)
      return () => runListeners.delete(listener)
    },
    cancelActiveQuery: (runId) =>
      cancelOwnedRequests(`run:${runId}`, queryError('AbortError', '已取消本次计算。')),
    fingerprintAccountDecisionInput(input, currentRunId) {
      const browser = browserCalculationInputFingerprint(input)
      const matched = currentRunId ? fingerprints.get(currentRunId) : undefined
      return matched?.browser === browser ? matched.core : browser
    },
    ...createBrowserAccountDecisionCalculation({
      release,
      submit,
      liveRuns,
      fingerprints,
      notifyRunChange,
    }),
    ...createBrowserPlanningQueries(submit),
    ...(options.resultProjection === 'local' || options.resultProjection === 'public-development'
      ? factsTransport.createBrowserDevelopmentFactsClient({
          factsLane,
          submit,
          getFactsClient,
          abortError: () => queryError('AbortError', '已取消本次计算。'),
        })
      : {}),
    ...(options.resultProjection === 'local' || options.resultProjection === 'public-development'
      ? createBrowserPersonalDevelopmentClient({
          personalLane,
          publicDevelopment: options.resultProjection === 'public-development',
          submit,
          getPersonalClient,
          release: releasePersonal,
          register: (id) => livePersonalSessions.add(id),
          has: (id) => livePersonalSessions.has(id),
        })
      : {}),
    queryDecisionPortfolio: (query) => submit(query),
    calculateTargetTeamWarehouseFit: (query, requestOptions) =>
      submit(query, requestOptions?.signal),
    queryTeamOverviewPresentation: (query) => submit(query),
    queryTeamRoutePresentation: (query, requestOptions) => submit(query, requestOptions?.signal),
    querySavedTeamPlanReplay: (query) => submit(query),
    querySavedTeamSolutionComponents: (query) => submit(query),
    queryDevelopmentCandidateAlternatives: (query, requestOptions) =>
      submit(query, requestOptions?.signal),
    queryDevelopmentWorkbenchRoute: (query) => submit(query),
    queryWarehouseActions: async (query, requestOptions) =>
      unpackPublicWarehouseActions(await submit(query, requestOptions?.signal)),
    queryWarehouseDiscTransitionUses: (query, requestOptions) =>
      submit(query, requestOptions?.signal),
  }
}
