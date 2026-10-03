import { describe, expect, it, vi } from 'vitest'
import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { createLocalCalculationQueryClient } from './localCalculationQueryClient'
import { query } from './localCalculationQueryClient.testFixture'
import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import { calculationQueryContractVersion } from './calculationQueryContract'
import { n4ValidationDisc } from '../testing/n4RecommendationValidationFixture'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'

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
  it('binds explicit engine parameters and output fingerprints without changing the captured account', async () => {
    const request = query('explicit-comparison', ['agent-billy'])
    const constraint = getCandidateWarehouseConstraint('agent-billy')!
    const setPlan = constraint.setPlans![0]!
    request.input.warehouse.discs = Array.from({ length: 12 }, (_, index) => {
      const disc = n4ValidationDisc(index)
      return {
        ...disc,
        setId: disc.slot <= 4 ? setPlan.primarySetIds[0]! : setPlan.secondarySetIds[0]!,
        subStats: [],
        mainStat:
          disc.slot >= 4
            ? constraint.mainStats[String(disc.slot) as '4' | '5' | '6']![0]!
            : disc.mainStat,
      }
    })
    request.input.warehouse.roster.agents = request.input.warehouse.roster.agents.map((agent) =>
      agent.agentId === 'agent-billy'
        ? {
            ...agent,
            level: 50,
            ascension: 4,
            equippedDiscIds: request.input.warehouse.discs.slice(0, 6).map((disc) => disc.id),
            wEngineDetails: {
              id: 'wengine-12001',
              name: null,
              level: 40,
              ascension: 3,
              refinement: 1,
            },
          }
        : agent,
    )
    const before = JSON.stringify(request.input)
    const client = createLocalCalculationQueryClient({ readRuntimeSelection: async () => current })
    const run = await client.calculateAccountDecision(request)
    const base = {
      contractVersion: calculationQueryContractVersion,
      kind: 'development_candidate_alternatives' as const,
      runId: run.runId,
      agentId: 'agent-billy',
    }
    const parameters = {
      wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 5 },
    }
    const first = await client.queryDevelopmentCandidateAlternatives({
      ...base,
      candidateParametersByRank: { 1: parameters },
    })
    const second = await client.queryDevelopmentCandidateAlternatives({
      ...base,
      candidateParametersByRank: { 1: { wEngine: { ...parameters.wEngine, level: 41 } } },
    })
    expect(first).toMatchObject({
      comparisonContract: 'soda-explicit-development-comparison/v1',
      candidateParametersByRank: { 1: parameters },
      sideEffect: 'read_only',
    })
    expect(first.valueBenchmarks?.[0]?.candidate.dimensions.w_engine).toContain('p5:lv40:asc3')
    expect(first.comparisonFingerprint).not.toBe(second.comparisonFingerprint)
    expect(first.inputFingerprint).toBe(second.inputFingerprint)
    expect(JSON.stringify(request.input)).toBe(before)
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        ...base,
        contractVersion: 'soda-calculation-query/v2',
      } as never),
    ).rejects.toThrow('Unsupported Calculation/Query contract')
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        ...base,
        candidateParametersByRank: { 999: parameters },
      }),
    ).rejects.toThrow('候选序号')
  })
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
        contractVersion: 'soda-calculation-query/v4',
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
