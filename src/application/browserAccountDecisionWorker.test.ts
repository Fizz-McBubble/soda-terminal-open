import { describe, expect, it, vi } from 'vitest'
import {
  buildAccountDecisionSnapshot,
  type AccountDecisionSnapshot,
} from '../decision/accountDecisionService'
import {
  accountDecisionSnapshotWorkerProtocolVersion,
  type AccountDecisionSnapshotCalculationInput,
  type AccountDecisionSnapshotWorkerRequest,
  type AccountDecisionSnapshotWorkerResponse,
} from './accountDecisionSnapshotWorkerProtocol'
import {
  createBrowserAccountDecisionSnapshotCalculator,
  createDefaultAccountDecisionSnapshotCalculator,
} from './browserAccountDecisionWorker'
import { query as fixtureQuery } from './localCalculationQueryClient.testFixture'

const input = (accountId: string): AccountDecisionSnapshotCalculationInput =>
  ({
    warehouse: { account: { id: accountId } },
    drafts: [],
    activePlanIds: {},
    developmentPriorityAgentIds: [],
    preference: {},
    capturedAt: '2026-09-13T00:00:00.000Z',
  }) as unknown as AccountDecisionSnapshotCalculationInput

const snapshot = (accountId: string): AccountDecisionSnapshot =>
  ({ account: { accountId } }) as unknown as AccountDecisionSnapshot

const inputAccountId = (value: AccountDecisionSnapshotCalculationInput): string =>
  value.warehouse.account!.id

class FakeWorker {
  onmessage: ((event: MessageEvent<AccountDecisionSnapshotWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null
  readonly requests: AccountDecisionSnapshotWorkerRequest[] = []
  terminated = false

  postMessage(request: AccountDecisionSnapshotWorkerRequest) {
    this.requests.push(structuredClone(request))
  }

  terminate() {
    this.terminated = true
  }

  respond(response: AccountDecisionSnapshotWorkerResponse) {
    this.onmessage?.({ data: structuredClone(response) } as MessageEvent)
  }
}

const success = (
  requestId: number,
  result: AccountDecisionSnapshot,
): AccountDecisionSnapshotWorkerResponse => ({
  protocolVersion: accountDecisionSnapshotWorkerProtocolVersion,
  kind: 'success',
  requestId,
  snapshot: result,
})

describe('browser account decision snapshot worker', () => {
  it('structured-clones a real query input and its complete decision snapshot', () => {
    const query = fixtureQuery('worker-clone-contract', ['yixuan', 'dialyn', 'lucia'])
    const clonedInput = structuredClone({ ...query.input, capturedAt: query.capturedAt })
    const result = buildAccountDecisionSnapshot(clonedInput)
    const clonedResult = structuredClone(result)

    expect(clonedResult).not.toBe(result)
    expect(clonedResult.fingerprint).toEqual(result.fingerprint)
    expect(clonedResult.decisionAuthority.fingerprint).toBe(result.decisionAuthority.fingerprint)
    expect(clonedResult.explanation).toEqual(result.explanation)
  })

  it('structured-clones inputs and dispatches concurrent requests in FIFO order', async () => {
    const worker = new FakeWorker()
    const calculator = createBrowserAccountDecisionSnapshotCalculator({
      createWorker: () => worker,
    })
    const firstInput = input('first')
    const first = calculator.calculateSnapshot(firstInput)
    const second = calculator.calculateSnapshot(input('second'))
    ;(firstInput.warehouse.account as { id: string }).id = 'mutated-after-post'

    expect(worker.requests.map((request) => inputAccountId(request.input))).toEqual(['first'])
    worker.respond(success(worker.requests[0]!.requestId, snapshot('first')))
    expect(worker.requests.map((request) => inputAccountId(request.input))).toEqual([
      'first',
      'second',
    ])
    worker.respond(success(worker.requests[1]!.requestId, snapshot('second')))

    await expect(first).resolves.toMatchObject({ account: { accountId: 'first' } })
    await expect(second).resolves.toMatchObject({ account: { accountId: 'second' } })
  })

  it('rejects only the matching calculation error and ignores late unknown replies', async () => {
    const worker = new FakeWorker()
    const calculator = createBrowserAccountDecisionSnapshotCalculator({
      createWorker: () => worker,
    })
    const failed = calculator.calculateSnapshot(input('failed'))
    const successful = calculator.calculateSnapshot(input('successful'))
    worker.respond({
      protocolVersion: accountDecisionSnapshotWorkerProtocolVersion,
      kind: 'error',
      requestId: worker.requests[0]!.requestId,
      error: { name: 'FixtureCalculationError', message: 'fixture failed' },
    })
    worker.respond(success(99_999, snapshot('late')))
    expect(worker.requests).toHaveLength(2)
    worker.respond(success(worker.requests[1]!.requestId, snapshot('successful')))

    await expect(failed).rejects.toMatchObject({
      name: 'FixtureCalculationError',
      message: '队伍分析计算失败：fixture failed',
    })
    await expect(successful).resolves.toMatchObject({ account: { accountId: 'successful' } })
  })

  it('terminates an aborted active worker and continues queued work on a replacement', async () => {
    const workers: FakeWorker[] = []
    const calculator = createBrowserAccountDecisionSnapshotCalculator({
      createWorker: () => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
      },
    })
    const controller = new AbortController()
    const aborted = calculator.calculateSnapshot(input('aborted'), {
      signal: controller.signal,
    })
    const queued = calculator.calculateSnapshot(input('queued'))
    controller.abort()

    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    expect(workers[0]!.terminated).toBe(true)
    expect(inputAccountId(workers[1]!.requests[0]!.input)).toBe('queued')
    workers[1]!.respond(success(workers[1]!.requests[0]!.requestId, snapshot('queued')))
    await expect(queued).resolves.toMatchObject({ account: { accountId: 'queued' } })

    const replacement = calculator.calculateSnapshot(input('replacement'))
    expect(workers).toHaveLength(2)
    workers[1]!.respond(success(workers[1]!.requests[1]!.requestId, snapshot('replacement')))
    await expect(replacement).resolves.toMatchObject({ account: { accountId: 'replacement' } })
  })

  it('removes an aborted queued request without interrupting the active calculation', async () => {
    const worker = new FakeWorker()
    const calculator = createBrowserAccountDecisionSnapshotCalculator({
      createWorker: () => worker,
    })
    const active = calculator.calculateSnapshot(input('active'))
    const controller = new AbortController()
    const queued = calculator.calculateSnapshot(input('queued'), { signal: controller.signal })
    controller.abort()

    await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminated).toBe(false)
    expect(worker.requests).toHaveLength(1)
    worker.respond(success(worker.requests[0]!.requestId, snapshot('active')))
    await expect(active).resolves.toMatchObject({ account: { accountId: 'active' } })
    expect(worker.requests).toHaveLength(1)
  })

  it('rejects all pending work on a worker runtime failure without main-thread fallback', async () => {
    const worker = new FakeWorker()
    const calculator = createBrowserAccountDecisionSnapshotCalculator({
      createWorker: () => worker,
    })
    const first = calculator.calculateSnapshot(input('first'))
    const second = calculator.calculateSnapshot(input('second'))
    worker.onerror?.({ message: 'worker crashed' } as ErrorEvent)

    await expect(first).rejects.toMatchObject({
      name: 'AccountDecisionWorkerRuntimeError',
      message: '队伍分析服务异常：worker crashed',
    })
    await expect(second).rejects.toMatchObject({ name: 'AccountDecisionWorkerRuntimeError' })
    expect(worker.terminated).toBe(true)
  })

  it('uses the direct calculator only when Worker is unavailable', async () => {
    const directCalculate = vi.fn((value: AccountDecisionSnapshotCalculationInput) =>
      snapshot(inputAccountId(value)),
    )
    const calculator = createDefaultAccountDecisionSnapshotCalculator({
      workerSupported: false,
      directCalculate,
    })

    await expect(calculator.calculateSnapshot(input('ssr'))).resolves.toMatchObject({
      account: { accountId: 'ssr' },
    })
    expect(directCalculate).toHaveBeenCalledOnce()
  })

  it('does not silently fall back when browser Worker creation fails', async () => {
    const directCalculate = vi.fn(() => snapshot('must-not-run'))
    const calculator = createDefaultAccountDecisionSnapshotCalculator({
      workerSupported: true,
      createWorker: () => {
        throw new Error('worker blocked')
      },
      directCalculate,
    })

    await expect(calculator.calculateSnapshot(input('browser'))).rejects.toThrow('worker blocked')
    expect(directCalculate).not.toHaveBeenCalled()
  })

  it('dispose terminates the worker, rejects pending work, and blocks later calculations', async () => {
    const worker = new FakeWorker()
    const calculator = createBrowserAccountDecisionSnapshotCalculator({
      createWorker: () => worker,
    })
    const pending = calculator.calculateSnapshot(input('pending'))
    calculator.dispose()

    await expect(pending).rejects.toMatchObject({ name: 'AccountDecisionWorkerDisposedError' })
    await expect(calculator.calculateSnapshot(input('later'))).rejects.toMatchObject({
      name: 'AccountDecisionWorkerDisposedError',
    })
    expect(worker.terminated).toBe(true)
  })
})
