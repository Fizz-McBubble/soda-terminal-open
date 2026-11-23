import { statWeightCalibrationFixture } from '../decision/developmentStatWeights.calibrationFixture'
import { evaluateDevelopmentValueBenchmarkSide } from '../decision/developmentValueBenchmark'
import { reviewedEventConditionDeclarationsIdentity32 } from '../calculation/reviewedEventConditionDeclarations32'
import { projectPublicCalculationResult } from './publicCalculationTransport'
import { describe, expect, it, vi } from 'vitest'
import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { createLocalCalculationQueryClient } from './localCalculationQueryClient'
import { query } from './localCalculationQueryClient.testFixture'
import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import { calculationQueryContractVersion } from './calculationQueryContract'

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
    const { agentId, warehouse, discs } = statWeightCalibrationFixture('agent-billy', 'crit_rate')
    const request = query('explicit-comparison', [agentId])
    request.input.warehouse.discs = discs
    request.input.warehouse.roster = warehouse.roster
    request.input.warehouse.roster.agents = warehouse.roster.agents.map((agent) =>
      agent.agentId === agentId
        ? {
            ...agent,
            equippedDiscIds: discs.map((disc) => disc.id),
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
      agentId,
    }
    const unmodified = await client.queryDevelopmentCandidateAlternatives(base)
    expect(unmodified.status).toBe('ready')
    expect(unmodified.candidates).toHaveLength(1)
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
    expect(first.candidateSearch).toMatchObject({
      rankingMethod: 'parameter_bound_unranked',
    })
    expect(first.candidateSearch).not.toHaveProperty('candidateRanking')
    expect(first.candidateSearchByRank?.[1]).toMatchObject({
      rankingMethod: 'parameter_bound_unranked',
      candidateRanking: {
        entries: [
          {
            candidateRank: 1,
            groupRank: null,
            groupSize: 1,
            comparable: false,
            basis: {
              kind: 'unranked',
              reason: 'parameter_bound_projection_mismatch',
            },
          },
        ],
      },
    })
    expect(
      first.candidateSearchByRank?.[1]?.candidateRanking?.entries[0]?.calculationIdentity,
    ).toBe(first.valueBenchmarks?.[0]?.candidate.calculationFingerprint)
    expect(
      first.candidateSearchByRank?.[1]?.candidateRanking?.comparisonParametersIdentity,
    ).toBeTruthy()
    expect(first.valueBenchmarks?.[0]?.candidate.dimensions.w_engine).toContain('p5:lv40:asc3')
    expect(first.comparisonFingerprint).not.toBe(second.comparisonFingerprint)
    expect(first.inputFingerprint).toBe(second.inputFingerprint)
    const stunned = await client.queryDevelopmentCandidateAlternatives({
      ...base,
      candidateParametersByRank: { 1: parameters },
      scenarioSelection: { schemaVersion: 1, id: 'declared-stun-comparison' },
    })
    expect(stunned.scenarioSelection?.id).toBe('declared-stun-comparison')
    expect(stunned.scenarioIdentity).not.toBe(first.scenarioIdentity)
    expect(stunned.comparisonFingerprint).not.toBe(first.comparisonFingerprint)
    expect(stunned.valueBenchmarks?.[0]?.candidate.totalDamage).toBeCloseTo(
      first.valueBenchmarks![0]!.candidate.totalDamage! * 1.5,
      6,
    )
    expect(stunned.valueBenchmarks?.[0]?.baseline.totalDamage).toBeCloseTo(
      first.valueBenchmarks![0]!.baseline.totalDamage! * 1.5,
      6,
    )
    expect(stunned.valueBenchmarks?.[0]?.candidate.dimensions.scenario).not.toBe(
      first.valueBenchmarks?.[0]?.candidate.dimensions.scenario,
    )
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        ...base,
        scenarioSelection: { schemaVersion: 9, id: 'future' } as never,
      }),
    ).rejects.toThrow('规划场景版本')
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        ...base,
        resourceGrantDeclaration32: {
          authority: 'declared_resource_triggers',
          durationSeconds: 30,
          lastTriggerAtSeconds: {},
          sourceRefs: undefined,
        } as never,
      }),
    ).rejects.toThrow('资源到账声明格式无效')
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        ...base,
        resourceGrantDeclaration32: {
          authority: 'declared_resource_triggers',
          durationSeconds: 30,
          lastTriggerAtSeconds: {},
          triggers: { atSeconds: 0 },
          sourceRefs: ['fixture'],
        } as never,
      }),
    ).rejects.toThrow('资源到账声明格式无效')
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
  }, 20_000)
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

describe('fixed event declarations in the production query', () => {
  it('uses the same statement for candidate generation, comparison and public transport', async () => {
    const fixture = statWeightCalibrationFixture('agent-billy', 'crit_rate')
    const request = query('event-conditions-chain', [fixture.agentId])
    request.input.warehouse = fixture.warehouse
    const before = JSON.stringify(request.input)
    const client = createLocalCalculationQueryClient({
      readRuntimeSelection: async () => ({ status: 'compiled_current' }) as never,
    })
    const run = await client.calculateAccountDecision(request)
    const base = {
      contractVersion: calculationQueryContractVersion,
      kind: 'development_candidate_alternatives' as const,
      runId: run.runId,
      agentId: fixture.agentId,
    }
    const declaration = {
      sourceRefs: ['fixture:explicit-fixed-events'],
      whiteWaterBalladAttackWindow: true,
      windswept: null,
    }
    const declarations = { [fixture.agentId]: declaration }
    const neutral = await client.queryDevelopmentCandidateAlternatives(base)
    const selected = await client.queryDevelopmentCandidateAlternatives({
      ...base,
      eventConditionDeclarationsByAgentId: declarations,
    })
    expect(selected.status).toBe('ready')
    expect(selected.eventConditionDeclarationsIdentity).toBe(
      reviewedEventConditionDeclarationsIdentity32(declarations),
    )
    expect(selected.comparisonFingerprint).not.toBe(neutral.comparisonFingerprint)
    for (const [index, candidate] of selected.candidates.entries()) {
      const recalculated = evaluateDevelopmentValueBenchmarkSide({
        warehouse: fixture.warehouse,
        agentId: fixture.agentId,
        discs: candidate.loadouts[0]!.discs.map((row) => row.disc),
        stale: false,
        eventConditionDeclaration: selected.eventConditionDeclarationsByAgentId![fixture.agentId],
      })
      expect(selected.valueBenchmarks![index]!.candidate.calculationFingerprint).toBe(
        recalculated.calculationFingerprint,
      )
      expect(selected.valueBenchmarks![index]!.candidate.totalDamage).toBe(recalculated.totalDamage)
    }
    const publicResult = projectPublicCalculationResult(
      'development_candidate_alternatives',
      selected,
    )
    expect(publicResult).toMatchObject({
      eventConditionDeclarationsByAgentId: declarations,
      eventConditionDeclarationsIdentity: selected.eventConditionDeclarationsIdentity,
      scenarioIdentity: selected.scenarioIdentity,
    })
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        ...base,
        eventConditionDeclarationsByAgentId: { [fixture.agentId]: { sourceRefs: null } } as never,
      }),
    ).rejects.toThrow('技能事件声明格式无效')
    await expect(
      client.queryDevelopmentCandidateAlternatives({
        ...base,
        eventConditionDeclarationsByAgentId: { 'agent-other': declaration },
      }),
    ).rejects.toThrow('代理人不一致')
    expect(JSON.stringify(request.input)).toBe(before)
  }, 20_000)
})
