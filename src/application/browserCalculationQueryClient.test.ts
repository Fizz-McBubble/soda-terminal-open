import { describe, expect, it, vi } from 'vitest'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { createBrowserCalculationQueryClient } from './browserCalculationQueryClient'
import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'
import { query } from './localCalculationQueryClient.testFixture'

class FakeQueryWorker {
  onmessage: ((event: MessageEvent<BrowserCalculationQueryResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null
  readonly requests: BrowserCalculationQueryRequest[] = []
  terminated = false
  failNextQuery = false
  lastMessageHandler: FakeQueryWorker['onmessage'] = null

  constructor(autoReady = true) {
    if (autoReady) queueMicrotask(() => this.ready())
  }

  ready() {
    this.lastMessageHandler = this.onmessage
    this.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId: 0,
        status: 'ready',
      },
    } as MessageEvent<BrowserCalculationQueryResponse>)
  }

  postMessage(request: BrowserCalculationQueryRequest) {
    if (request.kind === 'query' && this.failNextQuery) {
      this.failNextQuery = false
      throw new Error('postMessage failed')
    }
    this.requests.push(structuredClone(request))
  }

  terminate() {
    this.terminated = true
  }

  respond(requestId: number, result: unknown) {
    this.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId,
        status: 'succeeded',
        result,
      },
    } as MessageEvent<BrowserCalculationQueryResponse>)
  }
}

const current: CurrentGameDataRuntimeSelection = {
  contract: 'soda-current-game-data-runtime-selection/v1',
  status: 'compiled_current',
  packageId: 'game-base-3.1',
  packageVersion: '3.1',
  gameVersion: '3.1',
  source: 'implicit_compiled_baseline',
}

function harness(autoReady = true) {
  const workers: FakeQueryWorker[] = []
  const runtime = { value: current as CurrentGameDataRuntimeSelection }
  const client = createBrowserCalculationQueryClient({
    readRuntimeSelection: async () => runtime.value,
    createWorker: () => {
      const worker = new FakeQueryWorker(autoReady)
      workers.push(worker)
      return worker
    },
  })
  return { client, runtime, workers }
}

describe('browser Query Worker lifecycle', () => {
  it('rejects an older Worker before accepting any mixed-version comparison response', async () => {
    const { client, workers } = harness(false)
    const task = client.calculateAccountDecision(query('mixed-worker'))
    const rejected = expect(task).rejects.toMatchObject({ name: 'BrowserCalculationProtocolError' })
    await vi.waitFor(() => expect(workers).toHaveLength(1))
    workers[0]!.onmessage?.({
      data: { protocolVersion: 'soda-browser-calculation-query/v2', requestId: 0, status: 'ready' },
    } as unknown as MessageEvent<BrowserCalculationQueryResponse>)
    await rejected
    expect(workers[0]!.terminated).toBe(true)
    expect(workers[0]!.requests).toHaveLength(0)
  })
  it('notifies handle subscribers when the Worker fails, and supports unsubscribe', async () => {
    const { client, workers } = harness()
    const listener = vi.fn()
    const unsubscribe = client.subscribeAccountDecisionRuns!(listener)
    const first = client.calculateAccountDecision(query('observed-run'))
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1))
    workers[0]!.respond(1, {
      runId: 'observed-run',
      inputFingerprint: 'observed-input',
      input: query('observed-run').input,
    })
    await first
    expect(client.hasAccountDecisionRun?.('observed-run')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    workers[0]!.onerror?.({ message: 'synthetic Worker failure' } as ErrorEvent)
    expect(client.hasAccountDecisionRun?.('observed-run')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    client.releaseAccountDecisionRun?.('observed-run')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it.each(['selection throws', 'selection unbound', 'postMessage throws'])(
    'settles the active and queued requests when %s, then retries with a new Worker',
    async (failure) => {
      const workers: FakeQueryWorker[] = []
      let reads = 0
      const client = createBrowserCalculationQueryClient({
        readRuntimeSelection: async (): Promise<CurrentGameDataRuntimeSelection> => {
          if (++reads === 1) {
            if (failure === 'selection throws') throw new Error('资料读取失败')
            if (failure === 'selection unbound')
              return {
                contract: current.contract,
                status: 'unbound',
                packageId: null,
                packageVersion: null,
                gameVersion: null,
                reason: 'active_game_base_missing',
                message: '游戏资料暂时不可用',
              }
          }
          return current
        },
        createWorker: () => {
          const worker = new FakeQueryWorker()
          worker.failNextQuery = failure === 'postMessage throws' && workers.length === 0
          workers.push(worker)
          return worker
        },
      })
      const first = client.calculateAccountDecision(query('failed'))
      const firstRejected = expect(first).rejects.toThrow(
        failure === 'postMessage throws' ? 'postMessage failed' : /资料/,
      )
      const queued = client.calculateTargetTeamWarehouseFit({
        contractVersion: query('failed').contractVersion,
        kind: 'target_team_warehouse_fit',
        runId: 'failed',
        candidateId: 'queued',
      })
      const queuedRejected = expect(queued).rejects.toThrow(
        failure === 'postMessage throws' ? 'postMessage failed' : /资料/,
      )
      await Promise.all([firstRejected, queuedRejected])
      expect(workers[0]?.terminated).toBe(true)
      expect(workers[0]?.requests.filter((request) => request.kind === 'query')).toHaveLength(0)

      const oldHandler = workers[0]!.lastMessageHandler
      const retry = client.calculateAccountDecision(query('retry'))
      await vi.waitFor(() =>
        expect(workers[1]?.requests.filter((request) => request.kind === 'query')).toHaveLength(1),
      )
      oldHandler?.({
        data: {
          protocolVersion: browserCalculationQueryProtocolVersion,
          requestId: 1,
          status: 'succeeded',
          result: { runId: 'failed', inputFingerprint: 'stale' },
        },
      } as MessageEvent<BrowserCalculationQueryResponse>)
      workers[1]!.respond(3, {
        runId: 'retry',
        inputFingerprint: 'fresh',
        input: query('retry').input,
      })
      await expect(retry).resolves.toMatchObject({ runId: 'retry', inputFingerprint: 'fresh' })
    },
  )

  it.each(['abort', 'release'])(
    'settles an active selection read and its queue during %s',
    async (interruption) => {
      let finishRead!: (selection: CurrentGameDataRuntimeSelection) => void
      const reading = new Promise<CurrentGameDataRuntimeSelection>((resolve) => {
        finishRead = resolve
      })
      let reads = 0
      const workers: FakeQueryWorker[] = []
      const client = createBrowserCalculationQueryClient({
        readRuntimeSelection: () => (++reads === 1 ? reading : Promise.resolve(current)),
        createWorker: () => {
          const worker = new FakeQueryWorker()
          workers.push(worker)
          return worker
        },
      })
      const controller = new AbortController()
      const active = client.queryWarehouseDiscTransitionUses!(
        {
          contractVersion: query('concurrent').contractVersion,
          kind: 'warehouse_disc_transition_uses',
          runId: 'concurrent',
          discId: 'disc-a',
        },
        { signal: controller.signal },
      )
      const activeRejected = expect(active).rejects.toMatchObject({ name: 'AbortError' })
      const queued = client.calculateTargetTeamWarehouseFit({
        contractVersion: query('concurrent').contractVersion,
        kind: 'target_team_warehouse_fit',
        runId: 'concurrent',
        candidateId: 'queued',
      })
      const queuedRejected = expect(queued).rejects.toMatchObject({ name: 'AbortError' })
      await vi.waitFor(() => expect(reads).toBe(1))
      if (interruption === 'abort') controller.abort()
      else client.releaseAccountDecisionRun?.('concurrent')
      finishRead(current)
      await Promise.all([activeRejected, queuedRejected])
      expect(workers[0]?.terminated).toBe(true)
      expect(workers[0]?.requests.filter((request) => request.kind === 'query')).toHaveLength(0)

      const retry = client.calculateAccountDecision(query('after-interruption'))
      await vi.waitFor(() =>
        expect(workers[1]?.requests.filter((request) => request.kind === 'query')).toHaveLength(1),
      )
      workers[1]!.respond(3, {
        runId: 'after-interruption',
        inputFingerprint: 'fresh',
        input: query('after-interruption').input,
      })
      await expect(retry).resolves.toMatchObject({ runId: 'after-interruption' })
    },
  )

  it('clears a failed Worker startup before the next query retries', async () => {
    const workers: FakeQueryWorker[] = []
    let startupAttempts = 0
    const client = createBrowserCalculationQueryClient({
      readRuntimeSelection: async () => current,
      createWorker: () => {
        if (++startupAttempts === 1) throw new Error('Worker unavailable')
        const worker = new FakeQueryWorker()
        workers.push(worker)
        return worker
      },
    })
    await expect(client.calculateAccountDecision(query('failed-start'))).rejects.toMatchObject({
      name: 'BrowserCalculationWorkerStartupError',
    })
    const retry = client.calculateAccountDecision(query('retry'))
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1))
    expect(workers[0]?.requests[0]).toMatchObject({
      kind: 'query',
      query: { kind: 'account_decision', runId: 'retry' },
    })
    workers[0]!.respond(2, {
      runId: 'retry',
      inputFingerprint: 'retry-fingerprint',
      input: query('retry').input,
    })
    await expect(retry).resolves.toMatchObject({ runId: 'retry' })
  })

  it('holds the first query until the module Worker signals that its handler is installed', async () => {
    const { client, workers } = harness(false)
    const decision = client.calculateAccountDecision(query('cold-start'))
    await vi.waitFor(() => expect(workers).toHaveLength(1))
    expect(workers[0]!.requests).toHaveLength(0)
    workers[0]!.ready()
    await vi.waitFor(() => expect(workers[0]!.requests).toHaveLength(1))
    workers[0]!.respond(1, {
      runId: 'cold-start',
      inputFingerprint: 'ready-fingerprint',
      input: query('cold-start').input,
    })
    await expect(decision).resolves.toMatchObject({ runId: 'cold-start' })
  })
  it('keeps successive calculation kinds in one Worker and detects changed account input', async () => {
    const { client, workers } = harness()
    const input = query('one')
    const decision = client.calculateAccountDecision(input)
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1))
    expect(workers[0]?.requests[0]).toMatchObject({
      kind: 'query',
      query: { kind: 'account_decision', runId: 'one' },
    })
    workers[0]!.respond(1, {
      runId: 'one',
      inputFingerprint: 'core-fingerprint',
      input: input.input,
    })
    await expect(decision).resolves.toMatchObject({ runId: 'one' })
    expect(client.hasAccountDecisionRun?.('one')).toBe(true)
    expect(client.fingerprintAccountDecisionInput(input.input, 'one')).toBe('core-fingerprint')
    expect(
      client.fingerprintAccountDecisionInput(
        { ...input.input, preference: { ...input.input.preference, teamCount: 2 } },
        'one',
      ),
    ).not.toBe('core-fingerprint')

    const fit = client.calculateTargetTeamWarehouseFit({
      contractVersion: input.contractVersion,
      kind: 'target_team_warehouse_fit',
      runId: 'one',
      candidateId: 'candidate-a',
    })
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(2))
    workers[0]!.respond(2, { candidateId: 'candidate-a' })
    await expect(fit).resolves.toMatchObject({ candidateId: 'candidate-a' })
    expect(workers).toHaveLength(1)
  })

  it('terminates active synchronous work and rejects all stale results before recovery', async () => {
    const { client, workers } = harness()
    const first = client.calculateAccountDecision(query('first'))
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1))
    client.releaseAccountDecisionRun?.('first')
    await rejected
    expect(workers[0]?.terminated).toBe(true)
    expect(client.hasAccountDecisionRun?.('first')).toBe(false)
    workers[0]!.respond(1, { runId: 'first', inputFingerprint: 'stale' })

    const second = client.calculateAccountDecision(query('second'))
    await vi.waitFor(() => expect(workers[1]?.requests).toHaveLength(1))
    workers[1]!.respond(2, {
      runId: 'second',
      inputFingerprint: 'fresh',
      input: query('second').input,
    })
    await expect(second).resolves.toMatchObject({ runId: 'second', inputFingerprint: 'fresh' })
  })

  it('invalidates a completed result if the selected data package changed during computation', async () => {
    const { client, runtime, workers } = harness()
    const decision = client.calculateAccountDecision(query('changed'))
    const rejected = expect(decision).rejects.toThrow('游戏资料已变化')
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1))
    runtime.value = { ...current, packageVersion: 'later' }
    workers[0]!.respond(1, { runId: 'changed', inputFingerprint: 'stale' })
    await rejected
    expect(workers[0]?.terminated).toBe(true)
    expect(client.hasAccountDecisionRun?.('changed')).toBe(false)
  })
})
