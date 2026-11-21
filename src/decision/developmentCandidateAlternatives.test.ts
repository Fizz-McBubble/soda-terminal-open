import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { defaultTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { AccountDecisionQueryInput } from '../application/calculationQueryContract'
import type { DriveDisc } from '../domain/schemas'
import { projectDevelopmentCandidateAlternatives } from './developmentCandidateAlternatives'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { solveCandidateWarehouse } from '../optimizer/candidateWarehouseSolver'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import { history } from '../warehouse/absoluteDiscRetentionScoring'
import { rankDevelopmentCandidates } from './developmentCandidateRanking'
import { preparedAnomalyCandidateRankingContract } from './developmentPreparedAnomalySearch'
import { stableContentHash } from '../gameDataPacks/types'
import { compileAgentBuildIntent } from './buildIntent'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'
import { compareValueBenchmarkSides } from '../calculation/valueBenchmarkComparison'
import { legalSubStats } from '../gameDataPacks/candidateWarehouseConstraint.testFixture'
import { evaluateDevelopmentRecordedDiscs } from '../pages/developmentRecordedDiscEvaluation'
import { candidate as physicalCandidate } from './developmentValueBenchmark.fixtures'
import {
  absoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from '../warehouse/absoluteDiscRetentionCatalog'

function disc(slot: 1 | 2 | 3 | 4 | 5 | 6, id: string): DriveDisc {
  const constraint = getCandidateWarehouseConstraint('agent-billy')!
  const plan = constraint.setPlans![0]!
  return {
    id,
    slot,
    setId: slot <= 4 ? plan.primarySetIds[0]! : plan.secondarySetIds[0]!,
    level: 15,
    rarity: 'S',
    mainStat:
      slot === 1
        ? 'hp_flat'
        : slot === 2
          ? 'atk_flat'
          : slot === 3
            ? 'def_flat'
            : constraint.mainStats[String(slot) as '4' | '5' | '6']![0]!,
    subStats: [],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    dataVersion: '3.1',
  }
}

function input(): AccountDecisionQueryInput {
  const roster = createEmptyRoster('2026-09-01T00:00:00.000Z')
  roster.agents = roster.agents.map((agent) =>
    agent.agentId === 'agent-billy' || agent.agentId === 'agent-anby'
      ? { ...agent, owned: true }
      : agent,
  )
  return {
    warehouse: {
      accountId: 'account-development-query',
      account: null,
      roster,
      discs: Array.from({ length: 12 }, (_, index) =>
        disc(((index % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6, `disc-${index}`),
      ),
    },
    drafts: [
      {
        scopedId: 'account-development-query:anby-plan',
        accountId: 'account-development-query',
        id: 'anby-plan',
        kind: 'agent',
        name: '安比方案',
        state: 'saved',
        selection: { agentIds: ['agent-anby'], bangbooId: null, scenario: 'general' },
        manualOverrides: {
          wEngineDirection: 'none',
          discDirection: 'none',
          progressionDirection: 'none',
          notes: 'fixture',
        },
        knowledgeRefs: [],
        warehouseRefs: ['disc-0', 'disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5'],
        comparisonCapability: 'direction',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        revision: 1,
      },
    ],
    activePlanIds: { 'agent-anby': 'anby-plan' },
    developmentPriorityAgentIds: ['agent-billy'],
    preference: defaultTeamPortfolioPreference,
  }
}

describe('development candidate alternatives projection', () => {
  it('excludes an illegal legacy slot 5 from source solving and the initial cultivation candidates without rewriting inventory', () => {
    const value = input()
    const calibration = statWeightCalibrationFixture('agent-billy')
    value.warehouse = {
      ...calibration.warehouse,
      discs: calibration.discs.map((item) => ({ ...item, setId: disc(item.slot, item.id).setId })),
    }
    for (const item of value.warehouse.discs)
      expect(() =>
        history(toAbsoluteRetentionDisc(item), absoluteDiscRetentionCatalog.rules),
      ).not.toThrow()
    const legal = value.warehouse.discs.find((item) => item.slot === 5)!
    const illegal: DriveDisc = {
      ...legal,
      id: 'legacy-main-sub-conflict',
      mainStat: 'atk_percent',
      level: 0,
      subStats: [
        { stat: 'atk_percent', value: 3, upgrades: 0 },
        { stat: 'crit_rate', value: 2.4, upgrades: 0 },
        { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
      ],
    }
    value.warehouse.discs.push(illegal)
    const before = JSON.stringify(value.warehouse.discs)
    const plan = solveCandidateWarehouse(value.warehouse.discs, ['agent-billy'], 'agent')
    expect(plan.loadouts).toHaveLength(1)
    expect(plan.loadouts[0]!.discs.find((choice) => choice.disc.slot === 5)!.disc.mainStat).toBe(
      legal.mainStat,
    )
    expect(
      plan.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id)),
    ).not.toContain(illegal.id)
    expect(() =>
      solveCandidateWarehouse(value.warehouse.discs, ['agent-billy'], 'agent', {
        fixedDiscByAgent: { 'agent-billy': illegal.id },
      }),
    ).toThrow('固定盘被排除')
    const projection = projectDevelopmentCandidateAlternatives(value, 'agent-billy')
    expect(projection.status).toBe('ready')
    expect(projection.candidates.length).toBeGreaterThan(0)
    expect(
      projection.candidates.flatMap((candidate) =>
        candidate.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id)),
      ),
    ).not.toContain(illegal.id)
    const onlyIllegal = value.warehouse.discs.filter(
      (item) => item.slot !== 5 || item.id === illegal.id,
    )
    expect(solveCandidateWarehouse(onlyIllegal, ['agent-billy'], 'agent').loadouts).toEqual([])
    expect(JSON.stringify(value.warehouse.discs)).toBe(before)
  })

  it('keeps saved references advisory and solves from the complete warehouse', () => {
    const withSavedReference = input()
    withSavedReference.warehouse.discs = withSavedReference.warehouse.discs.map((disc) => ({
      ...disc,
      subStats: legalSubStats(disc.mainStat),
    }))
    withSavedReference.warehouse.discs.push({
      ...withSavedReference.warehouse.discs[0]!,
      id: 'unknown-rarity',
      rarity: undefined,
    })
    const before = structuredClone(withSavedReference.warehouse)
    const withoutSavedReference = { ...withSavedReference, drafts: [], activePlanIds: {} }
    const result = projectDevelopmentCandidateAlternatives(withSavedReference, 'agent-billy')
    const control = projectDevelopmentCandidateAlternatives(withoutSavedReference, 'agent-billy')

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('fixture should be queryable')
    expect(result.candidates).toEqual(control.candidates)
    expect(result.candidates[0]?.loadouts[0]?.discs).toHaveLength(6)
    expect(
      result.candidates.flatMap((plan) => plan.loadouts[0]!.discs.map((row) => row.disc.id)),
    ).not.toContain('unknown-rarity')
    expect(withSavedReference.warehouse).toEqual(before)
    expect(
      result.candidates.every((plan) =>
        plan.loadouts.every((loadout) => loadout.discs.every(({ disc }) => disc.rarity === 'S')),
      ),
    ).toBe(true)
    expect(result.baseline).toEqual([])
    expect(result.candidateSearch).toMatchObject({
      rankingMethod: 'source_and_local_refinement',
      productionGameAccuracyCertified: false,
    })
    expect(result.candidateSearch?.status).toBeDefined()
    expect(result.buildIntent).toMatchObject({
      contract: 'soda-build-intent/v1',
      scope: 'agent_independent',
      resourcePolicy: 'advisory',
    })
  })

  it('fails closed for an unowned agent', () => {
    expect(projectDevelopmentCandidateAlternatives(input(), 'agent-nicole')).toMatchObject({
      status: 'unavailable',
      candidates: [],
    })
  })

  it('reports an unavailable result with a reason when the warehouse cannot form six discs', () => {
    const value = input()
    value.warehouse.discs = value.warehouse.discs.filter((disc) => disc.slot !== 6)
    const result = projectDevelopmentCandidateAlternatives(value, 'agent-billy')
    expect(result.status).toBe('unavailable')
    expect(result.candidates).toEqual([])
    expect(result.gaps.length).toBeGreaterThan(0)
  })
})

function rankingFixture() {
  const first = statWeightCalibrationFixture('agent-billy', 'crit_rate')
  const second = statWeightCalibrationFixture('agent-billy', 'crit_dmg')
  const agentId = 'agent-ye-shunguang'
  const agent = first.warehouse.roster.agents.find((row) => row.agentId === agentId)!
  Object.assign(
    agent,
    first.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy'),
    { agentId },
  )
  first.warehouse.discs = [...first.discs, ...second.discs]
  first.warehouse.discs.forEach((item) => {
    item.setId = item.slot <= 4 ? 'set-white-water-ballad' : 'set-hormone-punk'
  })
  const candidates = [first.discs, second.discs].map((discs) => {
    const plan = physicalCandidate(discs)
    plan.agentIds = [agentId]
    plan.loadouts[0]!.agentId = agentId
    plan.loadouts[0]!.setCounts = { 'set-white-water-ballad': 4, 'set-hormone-punk': 2 }
    return plan
  })
  const buildIntent = compileAgentBuildIntent({ agentId, developmentPriorityAgentIds: [] })
  return {
    warehouse: first.warehouse,
    agentId,
    candidates,
    buildIntent,
    agent,
    eventConditionDeclaration: {
      sourceRefs: ['synthetic:declared-ye-ranking-event'],
      whiteWaterBalladCritWindow: false,
      whiteWaterBalladAttackWindow: false,
      ye: {
        yeShunguangUnity32: true,
        yeShunguangEnlightenedMind32: true,
        yeShunguangVerdictActive32: true,
        yeShunguangVerdictTargetInside32: true,
        yeShunguangVerdictAtCap32: true,
      },
    },
  }
}

describe('comparison candidate order at the producer boundary', () => {
  it('uses real legal 4+2 and 2+2+2 event values only when their protection and coverage allow comparison', () => {
    const value = rankingFixture()
    const [preferred, other] = value.candidates
    other!.loadouts[0]!.discs.forEach(({ disc }, index) => {
      disc.setId =
        index < 2
          ? 'set-white-water-ballad'
          : index < 4
            ? 'set-hormone-punk'
            : 'set-woodpecker-electro'
      expect(() =>
        history(toAbsoluteRetentionDisc(disc), absoluteDiscRetentionCatalog.rules),
      ).not.toThrow()
    })
    preferred!.loadouts[0]!.discs.forEach(({ disc }) =>
      expect(() =>
        history(toAbsoluteRetentionDisc(disc), absoluteDiscRetentionCatalog.rules),
      ).not.toThrow(),
    )
    value.buildIntent.recommendations.find(
      (row) => row.agentId === value.agentId,
    )!.constraint!.setPlans = [
      {
        pattern: '4+2',
        primarySetIds: ['set-white-water-ballad'],
        secondarySetIds: ['set-hormone-punk'],
      },
      {
        pattern: '2+2+2',
        primarySetIds: ['set-white-water-ballad', 'set-hormone-punk', 'set-woodpecker-electro'],
        secondarySetIds: [],
      },
    ]
    const sides = [preferred!, other!].map((plan) =>
      evaluateDevelopmentValueBenchmarkSide({
        ...value,
        discs: plan.loadouts[0]!.discs.map(({ disc }) => disc),
        stale: false,
      }),
    )
    expect(sides.every((side) => side.state === 'supported')).toBe(true)
    const ranked = rankDevelopmentCandidates(value)
    const entries = ranked.candidateRanking.entries
    expect(entries.every((entry) => entry.comparable)).toBe(true)
    expect(
      sides[1]!.totalDamage!,
      JSON.stringify(sides.map((side) => side.totalDamage)),
    ).toBeGreaterThan(sides[0]!.totalDamage!)
    expect(ranked.candidates).toEqual([other, preferred])
    expect(entries.map((entry) => entry.groupRank)).toEqual([1, 2])
  })
  it('orders four same-source Remielle fixed-event slices by the user-observed relative outputs', () => {
    const value = rankingFixture()
    const base = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: value.candidates[0]!.loadouts[0]!.discs.map((row) => row.disc),
      stale: false,
    })
    const deltas = [-2.32, -0.5, -6.77, -1.75]
    const proficiency = [326, 430, 326, 430]
    const candidates = deltas.map((_, index) => {
      const plan = structuredClone(value.candidates[0]!)
      plan.agentIds = ['agent-remielle']
      plan.loadouts[0]!.agentId = 'agent-remielle'
      plan.loadouts[0]!.discs.forEach(({ disc }) => {
        disc.id = `synthetic-${index}-${disc.slot}`
        disc.setId = disc.slot <= 4 ? 'set-34100' : 'set-freedom-blues'
      })
      return plan
    })
    const evaluator: typeof evaluateDevelopmentValueBenchmarkSide = ({ discs }) => {
      const index = Number(discs[0]!.id.split('-')[1])
      return {
        ...structuredClone(base),
        totalDamage: 100 + deltas[index]!,
        planningDps: 100 + deltas[index]!,
        calculationFingerprint: `synthetic-result-${index}`,
        functionalStats32: {
          impact: 83,
          enerRegen: 1.2,
          anomMas: 115,
          anomProf: proficiency[index]!,
        },
        functionalCapacities32: undefined,
      }
    }
    const ranked = rankDevelopmentCandidates({
      ...value,
      agentId: 'agent-remielle',
      candidates,
      buildIntent: compileAgentBuildIntent({ agentId: 'agent-remielle' }),
      evaluator,
    })
    expect(ranked.candidates).toEqual([candidates[1], candidates[3], candidates[0], candidates[2]])
    expect(ranked.candidateRanking.entries.map((entry) => entry.calculationIdentity)).toEqual([
      'synthetic-result-1',
      'synthetic-result-3',
      'synthetic-result-0',
      'synthetic-result-2',
    ])
    expect(ranked.candidateRanking.entries.map((entry) => entry.candidateRank)).toEqual([
      1, 2, 3, 4,
    ])
  })

  it('only relaxes raw function grouping when complete sourced capacity proves equivalence', () => {
    const value = rankingFixture()
    const original = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: value.candidates[0]!.loadouts[0]!.discs.map((row) => row.disc),
      stale: false,
    })
    const first = structuredClone(original)
    const second = structuredClone(original)
    first.totalDamage = 100
    second.totalDamage = 120
    first.planningDps = 100
    second.planningDps = 120
    first.functionalStats32 = { ...first.functionalStats32!, impact: 100 }
    second.functionalStats32 = { ...second.functionalStats32!, impact: 120 }
    const capacity = {
      key: `${value.agentId}:source_daze_basis`,
      kind: 'source_daze_basis' as const,
      value: 50,
      contextKey: 'same-action',
      sourceRefs: ['synthetic:verified'],
      included: ['daze'],
      excluded: [] as string[],
    }
    first.functionalCapacities32 = {
      status: 'supported',
      capacities: [structuredClone(capacity)],
      blockers: [],
    }
    second.functionalCapacities32 = {
      status: 'supported',
      capacities: [structuredClone(capacity)],
      blockers: [],
    }
    const evaluator: typeof evaluateDevelopmentValueBenchmarkSide = ({ discs }) =>
      discs[0]!.id === value.candidates[0]!.loadouts[0]!.discs[0]!.disc.id ? first : second
    const ranked = rankDevelopmentCandidates({ ...value, evaluator })
    expect(ranked.candidates).toEqual([value.candidates[1], value.candidates[0]])
    expect(ranked.candidateRanking.entries.every((entry) => entry.comparable)).toBe(true)
    first.functionalCapacities32.capacities[0]!.value = 0
    second.functionalCapacities32.capacities[0]!.value = 0
    expect(rankDevelopmentCandidates({ ...value, evaluator }).candidates).toEqual(value.candidates)
    first.functionalCapacities32.capacities[0]!.value = 50
    second.functionalCapacities32.capacities[0]!.value = 49
    expect(rankDevelopmentCandidates({ ...value, evaluator }).candidates).toEqual(value.candidates)
    second.functionalStats32.impact = 100
    expect(
      rankDevelopmentCandidates({ ...value, evaluator }).candidateRanking.entries.every(
        (entry) => !entry.comparable,
      ),
    ).toBe(true)
    second.functionalStats32.impact = 120
    second.functionalCapacities32.capacities[0]!.value = 50
    second.functionalCapacities32.capacities[0]!.excluded.push('unknown-function')
    first.functionalCapacities32.capacities[0]!.excluded.push('unknown-function')
    expect(rankDevelopmentCandidates({ ...value, evaluator }).candidates).toEqual(value.candidates)
    first.functionalCapacities32.capacities[0]!.excluded = []
    second.functionalCapacities32.capacities[0]!.excluded = []
    second.functionalStats32.impact = 100
    second.functionalStats32.anomProf += 1
    expect(
      rankDevelopmentCandidates({ ...value, agentId: 'agent-remielle', evaluator }).candidates,
    ).toEqual([value.candidates[1], value.candidates[0]])
    second.functionalStats32.anomMas += 1
    expect(
      rankDevelopmentCandidates({ ...value, agentId: 'agent-remielle', evaluator }).candidates,
    ).toEqual(value.candidates)
  })

  it('prioritizes same-domain output before source-qualified 4+2, and uses score only for tied output', () => {
    const value = rankingFixture()
    const [preferred, other] = value.candidates
    other!.loadouts[0]!.discs.forEach(({ disc }, index) => {
      disc.setId =
        index < 2
          ? 'set-white-water-ballad'
          : index < 4
            ? 'set-hormone-punk'
            : 'set-woodpecker-electro'
    })
    value.buildIntent.recommendations.find(
      (row) => row.agentId === value.agentId,
    )!.constraint!.setPlans = [
      {
        pattern: '4+2',
        primarySetIds: ['set-white-water-ballad'],
        secondarySetIds: ['set-hormone-punk'],
      },
      {
        pattern: '2+2+2',
        primarySetIds: ['set-white-water-ballad', 'set-hormone-punk', 'set-woodpecker-electro'],
        secondarySetIds: [],
      },
    ]
    const baseline = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: preferred!.loadouts[0]!.discs.map((row) => row.disc),
      stale: false,
    })
    const evaluator: typeof evaluateDevelopmentValueBenchmarkSide = ({ discs }) => ({
      ...baseline,
      totalDamage: discs[0]!.id === preferred!.loadouts[0]!.discs[0]!.disc.id ? 100 : 200,
      planningDps: discs[0]!.id === preferred!.loadouts[0]!.discs[0]!.disc.id ? 100 : 200,
      calculationFingerprint: `synthetic:${discs[0]!.id}`,
    })
    preferred!.totalScore = 1
    other!.totalScore = 999
    preferred!.loadouts[0]!.panelObjective = { attackDeficit: 1, anomalyProficiency: 200 }
    other!.loadouts[0]!.panelObjective = { attackDeficit: 0, anomalyProficiency: 300 }
    const ranked = rankDevelopmentCandidates({
      ...value,
      evaluator,
      candidates: [other!, preferred!],
    })
    expect(ranked.candidates).toEqual([other, preferred])
    expect(ranked.candidateRanking.entries.map((entry) => entry.groupId)).toEqual([
      ranked.candidateRanking.entries[0]!.groupId,
      ranked.candidateRanking.entries[0]!.groupId,
    ])
    expect(ranked.candidateRanking.entries).toMatchObject([
      {
        candidateRank: 1,
        groupRank: 1,
        groupSize: 2,
        comparable: true,
        recommendedFourPlusTwo: false,
        orderingPolicy: [
          'fixed_event_output',
          'recommended_4plus2',
          'loadout_score',
          'fewer_swaps',
          'incoming_order',
        ],
        basis: { kind: 'fixed_event_output' },
      },
      {
        candidateRank: 2,
        groupRank: 2,
        groupSize: 2,
        comparable: true,
        recommendedFourPlusTwo: true,
        orderingPolicy: [
          'fixed_event_output',
          'recommended_4plus2',
          'loadout_score',
          'fewer_swaps',
          'incoming_order',
        ],
        basis: { kind: 'fixed_event_output' },
      },
    ])
    expect(ranked.candidateRanking.entries.map((entry) => entry.calculationIdentity)).toEqual([
      `synthetic:${other!.loadouts[0]!.discs[0]!.disc.id}`,
      `synthetic:${preferred!.loadouts[0]!.discs[0]!.disc.id}`,
    ])
    expect(ranked.candidateRanking.entries.map((entry) => entry.candidateIdentity)).toEqual(
      [other!, preferred!].map((plan) =>
        stableContentHash({
          agentId: value.agentId,
          discs: plan.loadouts[0]!.discs.map(({ disc }) => [disc.slot, disc.id]),
        }),
      ),
    )

    // A conditional source without its required team is unknown, not a recommendation.
    const source = value.buildIntent.recommendations.find((row) => row.agentId === value.agentId)!
      .constraint!.setPlans![0]!
    source.purpose = 'conditional'
    source.condition = {
      sourceId: 'synthetic',
      sourceUrl: 'https://example.com',
      sourceTextVerified: true,
      rule: { kind: 'teammate', agentId: 'agent-dialyn' },
    }
    expect(
      rankDevelopmentCandidates({ ...value, evaluator, candidates: [other!, preferred!] })
        .candidates,
    ).toEqual([other, preferred])

    source.purpose = 'recommended'
    delete source.condition
    delete preferred!.loadouts[0]!.panelObjective
    delete other!.loadouts[0]!.panelObjective
    const preparedRows = [other!, preferred!].map((plan, index) => ({
      candidateIdentity: stableContentHash({
        agentId: value.agentId,
        discs: plan.loadouts[0]!.discs.map(({ disc }) => [disc.slot, disc.id]),
      }),
      calculationIdentity: `synthetic-${index}`,
      coverageIdentity: 'same-coverage',
      groupId: 'same-group',
      groupRank: index + 1,
      groupSize: 2,
      comparable: true as const,
      totalDamage: index === 0 ? 200 : 100,
      swapCount: 0,
    }))
    const preparedCore = {
      contract: preparedAnomalyCandidateRankingContract,
      source: 'prepared_anomaly_settlement' as const,
      candidateRarityScope: 'S' as const,
      baselineCalculationIdentity: 'baseline',
      comparisonParametersIdentity: null,
      entries: preparedRows,
    }
    const prepared = rankDevelopmentCandidates({
      ...value,
      candidates: [other!, preferred!],
      rankingSource: 'prepared_anomaly_settlement',
      preparedCandidateRanking: { ...preparedCore, identity: stableContentHash(preparedCore) },
    })
    expect(prepared.candidates).toEqual([other, preferred])
    expect(prepared.candidateRanking.entries).toMatchObject([
      {
        candidateRank: 1,
        groupRank: 1,
        groupSize: 2,
        comparable: true,
        recommendedFourPlusTwo: false,
        orderingPolicy: [
          'prepared_anomaly_output',
          'recommended_4plus2',
          'loadout_score',
          'fewer_swaps',
          'incoming_order',
        ],
      },
      {
        candidateRank: 2,
        groupRank: 2,
        groupSize: 2,
        comparable: true,
        recommendedFourPlusTwo: true,
      },
    ])
    expect(prepared.candidateRanking.entries[0]!.groupId).toBe(
      prepared.candidateRanking.entries[1]!.groupId,
    )
    expect(prepared.candidateRanking.entries.map((row) => row.calculationIdentity)).toEqual([
      'synthetic-0',
      'synthetic-1',
    ])

    const tie = rankingFixture()
    const fixed = evaluateDevelopmentValueBenchmarkSide({
      ...tie,
      discs: tie.candidates[0]!.loadouts[0]!.discs.map((row) => row.disc),
      stale: false,
    })
    const equalEvaluator: typeof evaluateDevelopmentValueBenchmarkSide = () => fixed
    const actualScores = tie.candidates.map((plan) =>
      evaluateDevelopmentRecordedDiscs(
        tie.agentId,
        plan.loadouts[0]!.discs.map((row) => row.disc),
        { constraint: tie.buildIntent.recommendations[0]!.constraint },
      ),
    )
    expect(actualScores[0]?.complete).toBe(true)
    expect(actualScores[1]?.complete).toBe(true)
    expect(actualScores[1]!.totalScore!).toBeGreaterThan(actualScores[0]!.totalScore!)
    // Old raw scores conflict with the source-bound re-evaluation and must not decide the tie.
    tie.candidates[0]!.totalScore = 999
    tie.candidates[1]!.totalScore = 1
    expect(rankDevelopmentCandidates({ ...tie, evaluator: equalEvaluator }).candidates).toEqual([
      tie.candidates[1],
      tie.candidates[0],
    ])
    tie.candidates[0]!.totalScore = Number.NaN
    expect(rankDevelopmentCandidates({ ...tie, evaluator: equalEvaluator }).candidates).toEqual([
      tie.candidates[1],
      tie.candidates[0],
    ])
  })
  it('ranks an anomaly agent on the same fixed-event slice and keeps calculation identities bound', () => {
    const value = rankingFixture()
    const sides = value.candidates.map((plan) =>
      evaluateDevelopmentValueBenchmarkSide({
        ...value,
        discs: plan.loadouts[0]!.discs.map((row) => row.disc),
        stale: false,
      }),
    )
    // Simulate the reported relative order using one declared slice, while
    // preserving identical protected utility rather than treating it as zero.
    const commonUtility = sides[0]!.functionalStats32!
    const evidence: ReturnType<typeof evaluateDevelopmentValueBenchmarkSide>[] = sides.map(
      (side, index) => ({
        ...side,
        totalDamage: index === 0 ? 97.68 : 102.74,
        planningDps: index === 0 ? 97.68 : 102.74,
        functionalStats32: commonUtility,
      }),
    )
    const evaluator: typeof evaluateDevelopmentValueBenchmarkSide = ({ discs }) =>
      evidence[discs[0]!.id === value.candidates[0]!.loadouts[0]!.discs[0]!.disc.id ? 0 : 1]!
    const anomalyInput = { ...value, agentId: 'agent-remielle', evaluator }
    const ranked = rankDevelopmentCandidates(anomalyInput)
    expect(ranked.candidates).toEqual([value.candidates[1], value.candidates[0]])
    expect(ranked.candidateRanking.entries.map((entry) => entry.calculationIdentity)).toEqual([
      evidence[1]!.calculationFingerprint,
      evidence[0]!.calculationFingerprint,
    ])
    expect(
      ranked.candidateRanking.entries.every((entry) => entry.basis.kind === 'fixed_event_output'),
    ).toBe(true)

    const secondDisc = value.candidates[1]!.loadouts[0]!.discs[0]!.disc
    const originalSet = secondDisc.setId
    secondDisc.setId = 'set-woodpecker-electro'
    expect(rankDevelopmentCandidates(anomalyInput).candidates).toEqual([
      value.candidates[1],
      value.candidates[0],
    ])
    secondDisc.setId = originalSet

    // Even complete objectives cannot merge different declared effect coverage.
    evidence[0]!.coverage = { ...evidence[0]!.coverage!, excludedEffects: [] }
    evidence[1]!.coverage = {
      ...evidence[1]!.coverage!,
      excludedEffects: [],
      includedEffectKeys: [...evidence[0]!.coverage!.includedEffectKeys, 'different-effect'],
    }
    expect(rankDevelopmentCandidates(anomalyInput).candidates).toEqual(value.candidates)
    evidence[1]!.functionalStats32 = undefined
    expect(rankDevelopmentCandidates(anomalyInput).candidates).toEqual(value.candidates)
  })

  it('orders the same declared slice before rank binding without upgrading missing effects to overall benefits', () => {
    const value = rankingFixture()
    value.candidates[0]!.totalScore = 999
    value.candidates[1]!.totalScore = 1
    const before = JSON.stringify(value.warehouse)
    const sides = value.candidates.map((plan) =>
      evaluateDevelopmentValueBenchmarkSide({
        ...value,
        discs: plan.loadouts[0]!.discs.map((row) => row.disc),
        stale: false,
      }),
    )
    expect(sides.every((side) => side.state === 'supported')).toBe(true)
    expect(sides[1]!.totalDamage).toBeGreaterThan(sides[0]!.totalDamage!)
    const comparison = compareValueBenchmarkSides({
      baseline: sides[0]!,
      candidate: sides[1]!,
      changedDimensions: ['disc_loadout'],
      labels: { baseline: 'a', candidate: 'b' },
    })
    expect(comparison.coverage.generalConclusion).toBe('limited')
    expect(comparison.coverage.exclusionContextChanged).toBe(true)
    const ranked = rankDevelopmentCandidates(value)
    expect(ranked.candidates).toEqual([value.candidates[1], value.candidates[0]])
    expect(ranked.rankingScopes).toEqual(['fixed_event_slice'])
    expect(ranked.candidateRanking.entries).toMatchObject([
      {
        candidateRank: 1,
        groupRank: 1,
        groupSize: 2,
        comparable: true,
        basis: { kind: 'fixed_event_output', direction: 'higher' },
      },
      {
        candidateRank: 2,
        groupRank: 2,
        groupSize: 2,
        comparable: true,
        basis: { kind: 'fixed_event_output', direction: 'higher' },
      },
    ])
    expect(ranked.candidateRanking.entries.map((entry) => entry.calculationIdentity)).toEqual([
      sides[1]!.calculationFingerprint,
      sides[0]!.calculationFingerprint,
    ])
    expect(JSON.stringify(value.warehouse)).toBe(before)
    expect(sides[1]!.coverage!.excludedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ effectKey: `${value.agentId}:source_mechanism_completeness` }),
      ]),
    )
  })

  it('keeps unknown equipment and different protected resource rates apart while comparing compatible source branches', () => {
    const unknown = rankingFixture()
    unknown.agent.wEngineDetails.id = null
    expect(rankDevelopmentCandidates(unknown).candidates).toEqual(unknown.candidates)
    const resource = rankingFixture()
    resource.candidates[1]!.loadouts[0]!.discs.find((row) => row.disc.slot === 6)!.disc.mainStat =
      'energy_regen'
    const resourceRanked = rankDevelopmentCandidates(resource)
    expect(resourceRanked.candidates).toEqual(resource.candidates)
    expect(
      resourceRanked.candidateRanking.entries.every(
        (entry) => !entry.comparable && entry.groupRank === null,
      ),
    ).toBe(true)
    const source = rankingFixture()
    source.candidates[1]!.loadouts[0]!.discs.filter((row) => row.disc.slot > 4).forEach((row) => {
      row.disc.setId = 'set-woodpecker-electro'
    })
    source.buildIntent.recommendations.find(
      (row) => row.agentId === source.agentId,
    )!.constraint!.setPlans = [
      {
        pattern: '4+2',
        primarySetIds: ['set-white-water-ballad'],
        secondarySetIds: ['set-hormone-punk'],
        priority: 0,
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-white-water-ballad'],
        secondarySetIds: ['set-woodpecker-electro'],
        priority: 1,
      },
    ]
    expect(rankDevelopmentCandidates(source).candidates).toEqual([
      source.candidates[1],
      source.candidates[0],
    ])
  })

  it('orders by comparable output before panel targets', () => {
    const value = rankingFixture()
    const first = value.candidates[0]!.loadouts[0]!
    const second = value.candidates[1]!.loadouts[0]!
    first.panelObjective = { attackDeficit: 0, anomalyProficiency: 200 }
    second.panelObjective = { attackDeficit: 1, anomalyProficiency: 300 }
    expect(rankDevelopmentCandidates(value).candidates).toEqual([
      value.candidates[1],
      value.candidates[0],
    ])
    second.panelObjective = { ...first.panelObjective }
    expect(rankDevelopmentCandidates(value).candidates).toEqual([
      value.candidates[1],
      value.candidates[0],
    ])
  })

  it('uses a complete applied panel objective when event output is unavailable, without filling missing targets', () => {
    const value = rankingFixture()
    const first = value.candidates[0]!.loadouts[0]!
    const second = value.candidates[1]!.loadouts[0]!
    first.panelObjectiveStatus = second.panelObjectiveStatus = 'applied'
    first.panelObjective = {
      attackDeficit: 100,
      anomalyProficiency: 200,
      priorityStat: 'energyRegen',
      energyRegen: 1.2,
    }
    second.panelObjective = {
      attackDeficit: 0,
      anomalyProficiency: 200,
      priorityStat: 'energyRegen',
      energyRegen: 1.3,
    }
    const original = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: first.discs.map((row) => row.disc),
      stale: false,
    })
    const missingOutput: ReturnType<typeof evaluateDevelopmentValueBenchmarkSide> = {
      ...original,
      state: 'unsupported',
      totalDamage: null,
      planningDps: null,
      calculationFingerprint: null,
      coverage: undefined,
    }
    const evaluator: typeof evaluateDevelopmentValueBenchmarkSide = () => missingOutput
    const ranked = rankDevelopmentCandidates({ ...value, evaluator })
    expect(ranked.candidates).toEqual([value.candidates[1], value.candidates[0]])
    expect(ranked.candidateRanking.entries).toMatchObject([
      { groupRank: 1, comparable: true, basis: { kind: 'panel_target' } },
      { groupRank: 2, comparable: true, basis: { kind: 'panel_target' } },
    ])
    missingOutput.functionalStats32 = undefined
    expect(rankDevelopmentCandidates({ ...value, evaluator }).candidates).toEqual([
      value.candidates[1],
      value.candidates[0],
    ])
    delete second.panelObjective.energyRegen
    expect(rankDevelopmentCandidates({ ...value, evaluator }).candidates).toEqual(value.candidates)
    second.panelObjective.energyRegen = 1.3
    second.panelObjectiveStatus = 'limited'
    expect(rankDevelopmentCandidates({ ...value, evaluator }).candidates).toEqual(value.candidates)
  })

  it('uses fewer swaps after equal outputs and scores even with panel targets', () => {
    const value = rankingFixture()
    const first = value.candidates[0]!.loadouts[0]!
    const second = value.candidates[1]!.loadouts[0]!
    value.agent.equippedDiscIds = second.discs.map(({ disc }) => disc.id)
    first.panelObjective = { attackDeficit: 0, anomalyProficiency: 200 }
    second.panelObjective = { attackDeficit: 0, anomalyProficiency: 200 }

    const fixed = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: first.discs.map((row) => row.disc),
      stale: false,
    })
    value.candidates[0]!.totalScore = value.candidates[1]!.totalScore
    const ranked = rankDevelopmentCandidates({ ...value, evaluator: () => fixed })

    expect(ranked.candidates[0]).toBe(value.candidates[1])
    expect(ranked.candidateRanking.entries).toMatchObject([
      {
        candidateRank: 1,
        groupRank: 1,
        comparable: true,
        basis: {
          kind: 'fixed_event_output',
          direction: 'higher',
          tieBreakers: ['loadout_score', 'fewer_swaps', 'incoming_order'],
        },
      },
      {
        candidateRank: 2,
        groupRank: 2,
        comparable: true,
        basis: { kind: 'fixed_event_output' },
      },
    ])
  })
})
