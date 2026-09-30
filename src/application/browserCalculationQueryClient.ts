import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CalculationQueryClient } from './calculationQueryContract'
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
  runId: string
  query: BrowserCalculationQuery
  resolve(value: never): void
  reject(error: Error): void
  signal?: AbortSignal
  runtime?: Extract<CurrentGameDataRuntimeSelection, { status: 'compiled_current' }>
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

/** The browser owns storage and UI; this client keeps every expensive Query operation in one Worker. */
export function createBrowserCalculationQueryClient(options: {
  readRuntimeSelection: () => Promise<CurrentGameDataRuntimeSelection>
  createWorker?: () => WorkerPort
}): CalculationQueryClient {
  const pending = new Map<number, PendingRequest>()
  const queue: number[] = []
  const liveRuns = new Set<string>()
  const fingerprints = new Map<string, { browser: string; core: string }>()
  let worker: WorkerPort | null = null
  let workerReady = false
  let workerReadyTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  let activeRequestId: number | null = null
  let nextRequestId = 1

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
    for (const request of pending.values()) {
      request.removeAbortListener()
      request.reject(error)
    }
    pending.clear()
    queue.length = 0
    activeRequestId = null
    liveRuns.clear()
    fingerprints.clear()
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
        dispatchNext()
        return
      }
      if (response.requestId !== activeRequestId) return
      const request = pending.get(response.requestId)
      if (!request) return
      void (async () => {
        try {
          const runtime = await options.readRuntimeSelection()
          if (workerGeneration !== generation || !pending.has(response.requestId)) return
          if (runtime.status !== 'compiled_current') throw new Error(runtime.message)
          if (
            !request.runtime ||
            runtime.packageId !== request.runtime.packageId ||
            runtime.packageVersion !== request.runtime.packageVersion ||
            runtime.gameVersion !== request.runtime.gameVersion
          )
            throw new Error('游戏资料已变化，请重新分析。')
          if (response.status !== 'succeeded') throw new Error(response.error ?? '计算失败。')
          request.resolve(response.result as never)
        } catch (error) {
          if (workerGeneration !== generation) return
          if (
            error instanceof Error &&
            (response.status === 'succeeded' || /游戏资料/.test(error.message))
          ) {
            invalidate(queryError('BrowserCalculationRuntimeError', '游戏资料已变化，请重新分析。'))
            return
          }
          request.reject(error instanceof Error ? error : new Error('计算失败。'))
        } finally {
          if (workerGeneration === generation) {
            request.removeAbortListener()
            pending.delete(response.requestId)
            activeRequestId = null
            dispatchNext()
          }
        }
      })()
    }
    created.onerror = (event) => {
      invalidate(
        queryError(
          'BrowserCalculationWorkerError',
          event.message ? `本机计算异常：${event.message}` : '本机计算异常，请重新分析。',
        ),
      )
    }
    created.onmessageerror = () => {
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

  function dispatchNext() {
    if (activeRequestId !== null) return
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
    activeRequestId = requestId
    const dispatchGeneration = generation
    void (async () => {
      try {
        const runtime = await options.readRuntimeSelection()
        if (dispatchGeneration !== generation || !pending.has(requestId)) return
        if (runtime.status !== 'compiled_current') throw new Error(runtime.message)
        request.runtime = runtime
        const currentWorker = ensureWorker()
        currentWorker.postMessage({
          protocolVersion: browserCalculationQueryProtocolVersion,
          kind: 'query',
          requestId,
          runtime,
          query: request.query,
        } satisfies BrowserCalculationQueryRequest)
      } catch (error) {
        if (dispatchGeneration !== generation) return
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
        if (activeRequestId === requestId) {
          invalidate(queryError('AbortError', '本机计算已取消，请重新分析。'))
          return
        }
        request.removeAbortListener()
        pending.delete(requestId)
        request.reject(queryError('AbortError', '已取消本次计算。'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      pending.set(requestId, {
        runId: query.runId,
        query,
        resolve: resolve as (value: never) => void,
        reject,
        signal,
        removeAbortListener: () => signal?.removeEventListener('abort', abort),
      })
      queue.push(requestId)
      dispatchNext()
    })
  }

  function release(runId: string) {
    liveRuns.delete(runId)
    fingerprints.delete(runId)
    for (const [requestId, request] of pending) {
      if (request.runId !== runId) continue
      if (activeRequestId === requestId) {
        invalidate(queryError('AbortError', '本机计算已取消，请重新分析。'))
        return
      }
      request.removeAbortListener()
      pending.delete(requestId)
      request.reject(queryError('AbortError', '本次分析已释放。'))
    }
    worker?.postMessage({
      protocolVersion: browserCalculationQueryProtocolVersion,
      kind: 'release',
      runId,
    } satisfies BrowserCalculationQueryRequest)
  }

  return {
    releaseAccountDecisionRun: release,
    hasAccountDecisionRun: (runId) => liveRuns.has(runId),
    cancelActiveQuery: (runId) => {
      for (const [requestId, request] of pending) {
        if (request.runId !== runId) continue
        if (activeRequestId === requestId) {
          invalidate(queryError('AbortError', '本机计算已取消，请重新分析。'))
          return
        }
        request.removeAbortListener()
        pending.delete(requestId)
        request.reject(queryError('AbortError', '已取消本次计算。'))
      }
    },
    fingerprintAccountDecisionInput(input, currentRunId) {
      const browser = browserCalculationInputFingerprint(input)
      const matched = currentRunId ? fingerprints.get(currentRunId) : undefined
      return matched?.browser === browser ? matched.core : browser
    },
    async calculateAccountDecision(query) {
      release(query.runId)
      const browser = browserCalculationInputFingerprint(query.input)
      const run =
        await submit<Awaited<ReturnType<CalculationQueryClient['calculateAccountDecision']>>>(query)
      liveRuns.add(query.runId)
      fingerprints.set(query.runId, { browser, core: run.inputFingerprint })
      return run
    },
    queryDecisionPortfolio: (query) => submit(query),
    calculateTargetTeamWarehouseFit: (query) => submit(query),
    queryTeamOverviewPresentation: (query) => submit(query),
    queryTeamRoutePresentation: (query) => submit(query),
    querySavedTeamPlanReplay: (query) => submit(query),
    querySavedTeamSolutionComponents: (query) => submit(query),
    queryDevelopmentCandidateAlternatives: (query) => submit(query),
    queryDevelopmentWorkbenchRoute: (query) => submit(query),
    queryWarehouseDiscTransitionUses: (query, requestOptions) =>
      submit(query, requestOptions?.signal),
  }
}
