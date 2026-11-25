import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserCalculationQueryClient } from './browserCalculationQueryClient'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'
import { query } from './localCalculationQueryClient.testFixture'
import { personalDevelopmentInputFingerprint } from './publicPersonalDevelopment'
import { warehouseAnalysisStopReason } from './warehouseActionContract'

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
  it('cancels an active personal route observer without destroying its session or a following query', async () => {
    vi.useFakeTimers()
    const worker = new WorkerPort()
    const client = createBrowserCalculationQueryClient({
      readRuntimeSelection: async () => current,
      createPersonalWorker: () => worker,
      resultProjection: 'local',
    })
    const source = query('personal-fixture').input
    const open = {
      contractVersion: query('personal-fixture').contractVersion,
      kind: 'personal_development_open' as const,
      operationId: 'open',
      sessionId: 'piper-session',
      capturedAt: '2026-01-01T00:00:00Z',
      input: source,
    }
    const opened = client.openPersonalDevelopmentSession!(open)
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1))
    worker.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId: 1,
        status: 'succeeded',
        result: {
          contract: 'soda-personal-development-session/v1',
          sessionId: open.sessionId,
          accountId: source.warehouse.accountId,
          capturedAt: open.capturedAt,
          inputFingerprint: personalDevelopmentInputFingerprint(source),
        },
      },
    } as MessageEvent)
    const session = await opened
    const route = {
      contractVersion: open.contractVersion,
      kind: 'personal_development_route' as const,
      operationId: 'route',
      sessionId: session.sessionId,
      accountId: session.accountId,
      inputFingerprint: session.inputFingerprint,
      generationIdentity: 'generation',
      selection: {
        agentId: 'agent-piper',
        requestedPlanId: null,
        candidateRank: 1,
        candidateLoadoutFingerprint: 'loadout',
      },
    }
    const controller = new AbortController()
    const first = client.queryPersonalDevelopmentRoute!(route, { signal: controller.signal })
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(worker.requests).toHaveLength(2))
    controller.abort()
    await rejected
    expect(worker.terminated).toBe(false)
    expect(client.hasPersonalDevelopmentSession!(session.sessionId)).toBe(true)
    const second = client.queryPersonalDevelopmentRoute!({ ...route, operationId: 'next' })
    worker.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId: 2,
        status: 'succeeded',
        result: {},
      },
    } as MessageEvent)
    await vi.waitFor(() => expect(worker.requests).toHaveLength(3))
    worker.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId: 3,
        status: 'succeeded',
        result: {
          contract: 'soda-personal-development-route/v1',
          sessionId: session.sessionId,
          accountId: session.accountId,
          inputFingerprint: session.inputFingerprint,
          generationIdentity: route.generationIdentity,
          selection: route.selection,
        },
      },
    } as MessageEvent)
    await expect(second).resolves.toMatchObject({ sessionId: session.sessionId })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(worker.terminated).toBe(false)
    expect(client.hasPersonalDevelopmentSession!(session.sessionId)).toBe(true)
  })

  it.each([true, false])(
    'distinguishes an explicit warehouse stop (%s) from route cleanup',
    async (explicit) => {
      vi.useFakeTimers()
      const workers: WorkerPort[] = []
      const client = createBrowserCalculationQueryClient({
        readRuntimeSelection: async () => current,
        createWorker() {
          const worker = new WorkerPort()
          workers.push(worker)
          return worker
        },
      })
      const first = client.calculateAccountDecision(query('warehouse-before'))
      await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1))
      const original = workers[0]!
      original.respond(1, 'warehouse-before')
      await first

      const controller = new AbortController()
      const checked = client.queryWarehouseActions!(
        {
          contractVersion: query('warehouse-before').contractVersion,
          kind: 'warehouse_actions',
          runId: 'warehouse-before',
        },
        { signal: controller.signal },
      )
      const abandoned = expect(checked).rejects.toMatchObject({
        name: 'AbortError',
      })
      await vi.waitFor(() => expect(original.requests).toHaveLength(2))
      controller.abort(explicit ? warehouseAnalysisStopReason : undefined)
      await abandoned
      expect(original.terminated).toBe(explicit)
      expect(client.hasAccountDecisionRun?.('warehouse-before')).toBe(!explicit)

      const retry = client.calculateAccountDecision(query('warehouse-after'))
      if (!explicit) original.respond(2, 'warehouse-before')
      await vi.waitFor(() => {
        const receiver = workers[explicit ? 1 : 0]
        const queries = receiver?.requests.filter((message) => message.kind === 'query')
        expect(queries).toHaveLength(explicit ? 1 : 3)
      })
      workers[explicit ? 1 : 0]!.respond(3, 'warehouse-after')
      await expect(retry).resolves.toMatchObject({ runId: 'warehouse-after' })
      expect(client.hasAccountDecisionRun?.('warehouse-after')).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('invalidates the channel at the hard deadline when a cancelled active query never replies', async () => {
    vi.useFakeTimers()
    const worker = new WorkerPort()
    const client = createBrowserCalculationQueryClient({
      readRuntimeSelection: async () => current,
      createWorker: () => worker,
    })
    const seed = client.calculateAccountDecision(query('run'))
    await vi.advanceTimersByTimeAsync(0)
    worker.respond(1, 'run')
    await seed
    const controller = new AbortController()
    const fit = {
      contractVersion: query('run').contractVersion,
      kind: 'target_team_warehouse_fit' as const,
      runId: 'run',
      candidateId: 'cancelled',
    }
    const cancelled = client.calculateTargetTeamWarehouseFit(fit, { signal: controller.signal })
    const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(1_000)
    controller.abort()
    await rejected
    const next = client.calculateTargetTeamWarehouseFit({ ...fit, candidateId: 'next' })
    const failed = expect(next).rejects.toMatchObject({ name: 'BrowserCalculationTimeoutError' })
    await vi.advanceTimersByTimeAsync(118_999)
    expect(worker.terminated).toBe(false)
    expect(client.hasAccountDecisionRun!('run')).toBe(true)
    expect(worker.requests).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    await failed
    expect(worker.terminated).toBe(true)
    expect(client.hasAccountDecisionRun!('run')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves completed runs when the Worker reports a business error about game data', async () => {
    const worker = new WorkerPort()
    const client = createBrowserCalculationQueryClient({
      readRuntimeSelection: async () => current,
      createWorker: () => worker,
    })
    const seed = client.calculateAccountDecision(query('run'))
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1))
    worker.respond(1, 'run')
    await seed
    const task = client.queryDecisionPortfolio({
      contractVersion: query('run').contractVersion,
      kind: 'decision_portfolio',
      runId: 'run',
      teamCount: 2,
      lockedTemplateIds: [],
    })
    const error = '缺少这条建议的游戏资料。'
    const failed = expect(task).rejects.toThrow(error)
    await vi.waitFor(() => expect(worker.requests).toHaveLength(2))
    worker.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId: 2,
        status: 'failed',
        error,
      },
    } as MessageEvent)
    await failed
    expect(worker.terminated).toBe(false)
    expect(client.hasAccountDecisionRun!('run')).toBe(true)
  })

  it('terminates a cancelled long personal solve and immediately opens a new worker session', async () => {
    const workers: WorkerPort[] = []
    const client = createBrowserCalculationQueryClient({
      readRuntimeSelection: async () => current,
      createPersonalWorker: () => {
        const port = new WorkerPort()
        workers.push(port)
        return port
      },
      resultProjection: 'local',
    })
    const source = query('personal-fixture').input
    const makeOpen = (id: string) => ({
      contractVersion: query('personal-fixture').contractVersion,
      kind: 'personal_development_open' as const,
      operationId: `open-${id}`,
      sessionId: id,
      capturedAt: '2026-01-01T00:00:00Z',
      input: source,
    })
    const respondOpen = (worker: WorkerPort, id: string) =>
      worker.onmessage?.({
        data: {
          protocolVersion: browserCalculationQueryProtocolVersion,
          requestId: worker.requests[0]!.kind === 'query' ? worker.requests[0]!.requestId : -1,
          status: 'succeeded',
          result: {
            contract: 'soda-personal-development-session/v1',
            sessionId: id,
            accountId: source.warehouse.accountId,
            capturedAt: '2026-01-01T00:00:00Z',
            inputFingerprint: personalDevelopmentInputFingerprint(source),
          },
        },
      } as MessageEvent)
    const opening = client.openPersonalDevelopmentSession!(makeOpen('old'))
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1))
    respondOpen(workers[0]!, 'old')
    const session = await opening
    const controller = new AbortController()
    const solve = client.queryPersonalDevelopmentCandidates!(
      {
        contractVersion: makeOpen('old').contractVersion,
        kind: 'personal_development_candidates',
        operationId: 'long',
        sessionId: 'old',
        accountId: session.accountId,
        inputFingerprint: session.inputFingerprint,
        agentId: 'agent-piper',
        mode: 'compare',
      },
      { signal: controller.signal },
    )
    const rejected = expect(solve).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(workers[0]!.requests).toHaveLength(2))
    controller.abort()
    await rejected
    expect(workers[0]!.terminated).toBe(true)
    const reopening = client.openPersonalDevelopmentSession!(makeOpen('new'))
    await vi.waitFor(() => expect(workers[1]?.requests).toHaveLength(1))
    respondOpen(workers[1]!, 'new')
    await expect(reopening).resolves.toMatchObject({ sessionId: 'new' })
  })
  it('clears a queued cancellation deadline without interrupting active analysis', async () => {
    vi.useFakeTimers()
    const worker = new WorkerPort()
    const client = createBrowserCalculationQueryClient({
      readRuntimeSelection: async () => current,
      createWorker: () => worker,
    })
    const active = client.calculateAccountDecision(query('active'))
    const queued = client.calculateTargetTeamWarehouseFit({
      contractVersion: query('queued').contractVersion,
      kind: 'target_team_warehouse_fit',
      runId: 'queued',
      candidateId: 'candidate',
    })
    const rejected = expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(2)
    client.cancelActiveQuery?.('queued')
    await rejected
    expect(vi.getTimerCount()).toBe(1)
    expect(worker.terminated).toBe(false)
    worker.respond(1, 'active')
    await active
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['response', 'response validation'])(
    'rejects an overdue %s even if the browser has not run the timeout callback',
    async (phase) => {
      vi.useFakeTimers()
      vi.setSystemTime(0)
      let reads = 0
      let finishRead!: (runtime: CurrentGameDataRuntimeSelection) => void
      const delayedRead = new Promise<CurrentGameDataRuntimeSelection>((resolve) => {
        finishRead = resolve
      })
      const worker = new WorkerPort()
      const client = createBrowserCalculationQueryClient({
        readRuntimeSelection: () =>
          ++reads === 2 && phase === 'response validation' ? delayedRead : Promise.resolve(current),
        createWorker: () => worker,
      })
      const task = client.calculateAccountDecision(query('overdue'))
      const rejected = expect(task).rejects.toMatchObject({
        name: 'BrowserCalculationTimeoutError',
      })
      await vi.advanceTimersByTimeAsync(0)
      if (phase === 'response validation') {
        worker.respond(1, 'overdue')
        await Promise.resolve()
      }
      vi.setSystemTime(120_001)
      if (phase === 'response') worker.respond(1, 'overdue')
      else finishRead(current)
      await rejected
      expect(worker.terminated).toBe(true)
      expect(client.hasAccountDecisionRun?.('overdue')).toBe(false)
    },
  )

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

  it('times out a queued request from submission instead of granting it a fresh compute window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-28T00:00:00.000Z'))
    const worker = new WorkerPort()
    const client = createBrowserCalculationQueryClient({
      readRuntimeSelection: async () => current,
      createWorker: () => worker,
    })
    const first = client.calculateAccountDecision(query('queued-timeout'))
    let queuedError: Error | null = null
    const queued = client
      .queryDevelopmentCandidateAlternatives({
        contractVersion: query('queued-timeout').contractVersion,
        kind: 'development_candidate_alternatives',
        runId: 'queued-timeout',
        agentId: 'agent-remielle',
      })
      .catch((error: Error) => {
        queuedError = error
      })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(119_000)
    worker.respond(1, 'queued-timeout')
    await first
    await vi.advanceTimersByTimeAsync(1_000)
    await queued

    expect(queuedError).toMatchObject({
      name: 'BrowserCalculationTimeoutError',
    })
    expect(worker.terminated).toBe(true)
    expect(client.hasAccountDecisionRun?.('queued-timeout')).toBe(false)
  })
})
