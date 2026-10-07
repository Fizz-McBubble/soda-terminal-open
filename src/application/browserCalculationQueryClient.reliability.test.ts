import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserCalculationQueryClient } from './browserCalculationQueryClient'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'
import { query } from './localCalculationQueryClient.testFixture'

const current: CurrentGameDataRuntimeSelection = {
  contract: 'soda-current-game-data-runtime-selection/v1',
  status: 'compiled_current',
  packageId: 'game-base-3.1',
  packageVersion: '3.1',
  gameVersion: '3.1',
  source: 'implicit_compiled_baseline',
}

class WorkerPort {
  onmessage: ((event: MessageEvent<BrowserCalculationQueryResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null
  readonly requests: BrowserCalculationQueryRequest[] = []
  terminated = false

  constructor() {
    queueMicrotask(() =>
      this.onmessage?.({
        data: {
          protocolVersion: browserCalculationQueryProtocolVersion,
          requestId: 0,
          status: 'ready',
        },
      } as MessageEvent<BrowserCalculationQueryResponse>),
    )
  }

  postMessage(request: BrowserCalculationQueryRequest) {
    this.requests.push(request)
  }

  terminate() {
    this.terminated = true
  }

  respond(requestId: number, runId: string) {
    this.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId,
        status: 'succeeded',
        result: { runId, inputFingerprint: 'fresh', input: query(runId).input },
      },
    } as MessageEvent<BrowserCalculationQueryResponse>)
  }
}

afterEach(() => vi.useRealTimers())

describe('browser calculation request recovery', () => {
  it.each(['dispatch selection read', 'Worker response', 'response selection read'])(
    'settles a stalled %s and the queued work, then retries in a fresh Worker',
    async (phase) => {
      vi.useFakeTimers()
      let reads = 0
      let finishRead!: (runtime: CurrentGameDataRuntimeSelection) => void
      const stalledRead = new Promise<CurrentGameDataRuntimeSelection>((resolve) => {
        finishRead = resolve
      })
      const workers: WorkerPort[] = []
      const client = createBrowserCalculationQueryClient({
        readRuntimeSelection: async () => {
          reads += 1
          return (phase === 'dispatch selection read' && reads === 1) ||
            (phase === 'response selection read' && reads === 2)
            ? stalledRead
            : current
        },
        createWorker: () => {
          const worker = new WorkerPort()
          workers.push(worker)
          return worker
        },
      })
      const rejected = vi.fn()
      const active = client.calculateAccountDecision(query('stalled')).catch(rejected)
      const queued = client
        .calculateTargetTeamWarehouseFit({
          contractVersion: query('stalled').contractVersion,
          kind: 'target_team_warehouse_fit',
          runId: 'stalled',
          candidateId: 'queued',
        })
        .catch(rejected)
      await vi.advanceTimersByTimeAsync(0)
      const oldHandler = workers[0]!.onmessage
      const oldErrorHandler = workers[0]!.onerror
      const oldMessageErrorHandler = workers[0]!.onmessageerror
      if (phase === 'response selection read') {
        workers[0]!.respond(1, 'stalled')
        await vi.advanceTimersByTimeAsync(0)
      }
      await vi.advanceTimersByTimeAsync(120_000)
      expect(rejected).toHaveBeenCalledTimes(2)
      expect(rejected.mock.calls[0]![0]).toMatchObject({
        name: 'BrowserCalculationTimeoutError',
      })
      await Promise.all([active, queued])
      expect(workers[0]!.terminated).toBe(true)
      expect(client.hasAccountDecisionRun?.('stalled')).toBe(false)

      const retry = client.calculateAccountDecision(query('retry'))
      await vi.advanceTimersByTimeAsync(0)
      oldErrorHandler?.({ message: 'late Worker failure' } as ErrorEvent)
      oldMessageErrorHandler?.({ data: null } as MessageEvent<unknown>)
      finishRead(current)
      oldHandler?.({
        data: {
          protocolVersion: browserCalculationQueryProtocolVersion,
          requestId: 1,
          status: 'succeeded',
          result: { runId: 'stalled' },
        },
      } as MessageEvent<BrowserCalculationQueryResponse>)
      workers[1]!.respond(3, 'retry')
      await expect(retry).resolves.toMatchObject({ runId: 'retry' })
      expect(client.hasAccountDecisionRun?.('retry')).toBe(true)
      expect(client.hasAccountDecisionRun?.('stalled')).toBe(false)
      await vi.advanceTimersByTimeAsync(120_000)
      expect(workers[1]!.terminated).toBe(false)
    },
  )

  it.each(['succeeds', 'fails'])(
    'keeps a newer request active when older duplicate response validation %s late',
    async (validation) => {
      vi.useFakeTimers()
      let reads = 0
      let finishDuplicate!: (runtime: CurrentGameDataRuntimeSelection) => void
      let failDuplicate!: (error: Error) => void
      const validatingDuplicate = new Promise<CurrentGameDataRuntimeSelection>(
        (resolve, reject) => {
          finishDuplicate = resolve
          failDuplicate = reject
        },
      )
      const worker = new WorkerPort()
      const client = createBrowserCalculationQueryClient({
        readRuntimeSelection: async () => (++reads === 3 ? validatingDuplicate : current),
        createWorker: () => worker,
      })
      const initial = client.calculateAccountDecision(query('run'))
      const fitQuery = (candidateId: string) =>
        client.calculateTargetTeamWarehouseFit({
          contractVersion: query('run').contractVersion,
          kind: 'target_team_warehouse_fit',
          runId: 'run',
          candidateId,
        })
      const next = fitQuery('next')
      const last = fitQuery('last')
      await vi.advanceTimersByTimeAsync(0)
      worker.respond(1, 'run')
      worker.respond(1, 'run')
      await initial
      await vi.advanceTimersByTimeAsync(0)
      expect(worker.requests.filter((request) => request.kind === 'query')).toHaveLength(2)
      if (validation === 'fails') failDuplicate(new Error('late runtime read failure'))
      else finishDuplicate(current)
      await vi.advanceTimersByTimeAsync(0)
      expect(worker.requests.filter((request) => request.kind === 'query')).toHaveLength(2)
      worker.respond(2, 'run')
      await next
      await vi.advanceTimersByTimeAsync(0)
      expect(worker.requests.filter((request) => request.kind === 'query')).toHaveLength(3)
      worker.respond(3, 'run')
      await last
      await vi.advanceTimersByTimeAsync(120_000)
      expect(worker.terminated).toBe(false)
    },
  )
})
