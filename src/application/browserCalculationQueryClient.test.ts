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

  constructor(autoReady = true) {
    if (autoReady) queueMicrotask(() => this.ready())
  }

  ready() {
    this.onmessage?.({
      data: {
        protocolVersion: browserCalculationQueryProtocolVersion,
        requestId: 0,
        status: 'ready',
      },
    } as MessageEvent<BrowserCalculationQueryResponse>)
  }

  postMessage(request: BrowserCalculationQueryRequest) {
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
    workers[0]!.respond(1, { runId: 'one', inputFingerprint: 'core-fingerprint', input: input.input })
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
