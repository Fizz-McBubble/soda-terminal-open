import { describe, expect, it, vi } from 'vitest'
import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { createLocalCalculationQueryClient } from './localCalculationQueryClient'
import { query } from './localCalculationQueryClient.testFixture'
import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'

function deferredCalculator() {
  const pending: Array<{
    signal?: AbortSignal
    resolve: (snapshot: ReturnType<typeof buildAccountDecisionSnapshot>) => void
  }> = []
  const calculate: AccountDecisionSnapshotCalculator = (_input, options) =>
    new Promise((resolve) => pending.push({ signal: options?.signal, resolve }))
  return { pending, calculate }
}

const current = { status: 'compiled_current' } as CurrentGameDataRuntimeSelection

describe('background snapshot lifecycle', () => {
  it('cancels only the released pending run and never registers a late result', async () => {
    const deferred = deferredCalculator()
    const client = createLocalCalculationQueryClient({
      readRuntimeSelection: async () => current,
      calculateSnapshot: deferred.calculate,
    })
    const first = client.calculateAccountDecision(query('discarded'))
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    const second = client.calculateAccountDecision(query('retained'))
    await vi.waitFor(() => expect(deferred.pending).toHaveLength(2))
    client.releaseAccountDecisionRun?.('discarded')
    expect(deferred.pending[0]!.signal?.aborted).toBe(true)
    expect(deferred.pending[1]!.signal?.aborted).toBe(false)
    const snapshot = buildAccountDecisionSnapshot({
      ...query('x').input,
      capturedAt: query('x').capturedAt,
    })
    deferred.pending[0]!.resolve(snapshot)
    deferred.pending[1]!.resolve(snapshot)
    await rejected
    await expect(second).resolves.toMatchObject({ runId: 'retained', snapshot })
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        contractVersion: 'soda-calculation-query/v2',
        kind: 'development_candidate_alternatives',
        runId: 'discarded',
        agentId: 'agent-billy',
      }),
    ).rejects.toThrow('run is unavailable')
  })

  it('rejects a completed background result when the runtime became unavailable', async () => {
    const deferred = deferredCalculator()
    const readRuntimeSelection = vi.fn(async () => current)
    const client = createLocalCalculationQueryClient({
      readRuntimeSelection,
      calculateSnapshot: deferred.calculate,
    })
    const task = client.calculateAccountDecision(query('runtime-changed'))
    const rejected = expect(task).rejects.toThrow('无法读取游戏资料')
    await vi.waitFor(() => expect(deferred.pending).toHaveLength(1))
    readRuntimeSelection.mockRejectedValueOnce(new Error('unavailable'))
    deferred.pending[0]!.resolve(
      buildAccountDecisionSnapshot({
        ...query('x').input,
        capturedAt: query('x').capturedAt,
      }),
    )
    await rejected
    expect(deferred.pending[0]!.signal?.aborted).toBe(true)
  })
})
