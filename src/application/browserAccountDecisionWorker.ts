import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
import type { AccountDecisionSnapshot } from '../decision/accountDecisionService'
import {
  accountDecisionSnapshotWorkerProtocolVersion,
  type AccountDecisionSnapshotCalculationInput,
  type AccountDecisionSnapshotWorkerRequest,
  type AccountDecisionSnapshotWorkerResponse,
} from './accountDecisionSnapshotWorkerProtocol'

export type AccountDecisionSnapshotCalculator = (
  input: AccountDecisionSnapshotCalculationInput,
  options?: { signal?: AbortSignal },
) => Promise<AccountDecisionSnapshot>

export type BrowserAccountDecisionSnapshotCalculator = {
  calculateSnapshot: AccountDecisionSnapshotCalculator
  dispose(): void
}

type WorkerPort = Pick<Worker, 'postMessage' | 'terminate'> & {
  onmessage: ((event: MessageEvent<AccountDecisionSnapshotWorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null
}

type PendingRequest = {
  request: AccountDecisionSnapshotWorkerRequest
  resolve(snapshot: AccountDecisionSnapshot): void
  reject(error: Error): void
  removeAbortListener(): void
}

type BrowserCalculatorOptions = {
  createWorker?: () => WorkerPort
}

type DefaultCalculatorOptions = BrowserCalculatorOptions & {
  workerSupported?: boolean
  directCalculate?: (input: AccountDecisionSnapshotCalculationInput) => AccountDecisionSnapshot
}

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function defaultModuleWorker(): WorkerPort {
  return new Worker(new URL('./accountDecisionSnapshot.worker.ts', import.meta.url), {
    type: 'module',
  })
}

export function createBrowserAccountDecisionSnapshotCalculator(
  options: BrowserCalculatorOptions = {},
): BrowserAccountDecisionSnapshotCalculator {
  const createWorker = options.createWorker ?? defaultModuleWorker
  const pending = new Map<number, PendingRequest>()
  const queue: number[] = []
  let worker: WorkerPort | null = null
  let activeRequestId: number | null = null
  let nextRequestId = 1
  let disposed = false

  const rejectPending = (errorFor: (requestId: number) => Error) => {
    for (const [requestId, request] of pending) {
      request.removeAbortListener()
      request.reject(errorFor(requestId))
    }
    pending.clear()
    queue.length = 0
    activeRequestId = null
  }

  const detachAndTerminate = () => {
    if (!worker) return
    worker.onmessage = null
    worker.onerror = null
    worker.onmessageerror = null
    worker.terminate()
    worker = null
  }

  const failWorker = (error: Error) => {
    detachAndTerminate()
    rejectPending(() => error)
  }

  const ensureWorker = (): WorkerPort => {
    if (worker) return worker
    const created = createWorker()
    created.onmessage = (event) => {
      const response = event.data
      if (response.protocolVersion !== accountDecisionSnapshotWorkerProtocolVersion) {
        failWorker(
          namedError(
            'AccountDecisionWorkerProtocolError',
            '队伍分析服务版本不匹配，请刷新页面后重试。',
          ),
        )
        return
      }
      if (response.requestId !== activeRequestId) return
      const request = pending.get(response.requestId)
      if (!request) return
      pending.delete(response.requestId)
      activeRequestId = null
      request.removeAbortListener()
      if (response.kind === 'success') {
        request.resolve(response.snapshot)
      } else {
        request.reject(
          namedError(response.error.name, `队伍分析计算失败：${response.error.message}`),
        )
      }
      dispatchNext()
    }
    created.onerror = (event) => {
      failWorker(
        namedError(
          'AccountDecisionWorkerRuntimeError',
          event.message ? `队伍分析服务异常：${event.message}` : '队伍分析服务异常，请重试。',
        ),
      )
    }
    created.onmessageerror = () => {
      failWorker(
        namedError('AccountDecisionWorkerMessageError', '队伍分析结果无法读取，请刷新页面后重试。'),
      )
    }
    worker = created
    return created
  }

  function dispatchNext() {
    if (disposed || activeRequestId !== null) return
    let requestId = queue.shift()
    while (requestId !== undefined && !pending.has(requestId)) requestId = queue.shift()
    if (requestId === undefined) return
    const request = pending.get(requestId)!
    let activeWorker: WorkerPort
    try {
      activeWorker = ensureWorker()
    } catch (error) {
      failWorker(
        namedError(
          'AccountDecisionWorkerCreationError',
          `无法启动队伍分析服务：${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      return
    }
    activeRequestId = requestId
    try {
      activeWorker.postMessage(request.request)
    } catch (error) {
      activeRequestId = null
      pending.delete(requestId)
      request.removeAbortListener()
      request.reject(
        namedError(
          'AccountDecisionWorkerInputError',
          `队伍分析输入无法传递：${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      dispatchNext()
    }
  }

  const calculateSnapshot: AccountDecisionSnapshotCalculator = (input, requestOptions = {}) => {
    if (disposed) {
      return Promise.reject(
        namedError('AccountDecisionWorkerDisposedError', '队伍分析服务已关闭。'),
      )
    }
    if (requestOptions.signal?.aborted) {
      return Promise.reject(namedError('AbortError', '已取消本次队伍分析。'))
    }

    return new Promise((resolve, reject) => {
      const requestId = nextRequestId++
      const abort = () => {
        const request = pending.get(requestId)
        if (!request) return
        pending.delete(requestId)
        request.removeAbortListener()
        request.reject(namedError('AbortError', '已取消本次队伍分析。'))
        if (activeRequestId === requestId) {
          activeRequestId = null
          detachAndTerminate()
        }
        dispatchNext()
      }
      requestOptions.signal?.addEventListener('abort', abort, { once: true })
      pending.set(requestId, {
        request: {
          protocolVersion: accountDecisionSnapshotWorkerProtocolVersion,
          kind: 'calculate',
          requestId,
          input,
        },
        resolve,
        reject,
        removeAbortListener: () => requestOptions.signal?.removeEventListener('abort', abort),
      })
      queue.push(requestId)
      dispatchNext()
    })
  }

  return {
    calculateSnapshot,
    dispose() {
      if (disposed) return
      disposed = true
      detachAndTerminate()
      rejectPending(() => namedError('AccountDecisionWorkerDisposedError', '队伍分析服务已关闭。'))
    },
  }
}

export function createDefaultAccountDecisionSnapshotCalculator(
  options: DefaultCalculatorOptions = {},
): BrowserAccountDecisionSnapshotCalculator {
  const workerSupported = options.workerSupported ?? typeof Worker !== 'undefined'
  if (workerSupported) return createBrowserAccountDecisionSnapshotCalculator(options)
  const directCalculate = options.directCalculate ?? buildAccountDecisionSnapshot
  let disposed = false
  return {
    async calculateSnapshot(input, requestOptions = {}) {
      if (disposed) {
        throw namedError('AccountDecisionWorkerDisposedError', '队伍分析服务已关闭。')
      }
      if (requestOptions.signal?.aborted) {
        throw namedError('AbortError', '已取消本次队伍分析。')
      }
      return directCalculate(input)
    },
    dispose() {
      disposed = true
    },
  }
}
