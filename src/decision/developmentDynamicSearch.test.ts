import { describe, expect, it } from 'vitest'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import { compileAgentBuildIntent } from './buildIntent'
import { projectDevelopmentCandidateAlternatives } from './developmentCandidateAlternatives'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'
import { searchDevelopmentDynamicCandidates } from './developmentDynamicSearch'
import { solveCandidateAgentAlternatives } from '../optimizer/candidateWarehouseSolver'
import { dynamicLegalInventory } from '../optimizer/teamDynamicDomain'

function fixture() {
  const value = statWeightCalibrationFixture('agent-claret', 'crit_rate')
  const other = statWeightCalibrationFixture('agent-claret', 'def_percent')
  value.warehouse.discs.push(...other.discs)
  value.warehouse.roster.agents.find((row) => row.agentId === value.agentId)!.equippedDiscIds =
    value.discs.slice(0, 6).map((disc) => disc.id)
  return value
}

describe('dynamic six-disc production producer', () => {
  it('keeps actual anomaly proficiency when the declared direct target cannot value its loss', () => {
    const value = statWeightCalibrationFixture('agent-billy', 'crit_rate')
    const current = value.discs.slice()
    const damageDisc = current.find((disc) => disc.slot === 4)!
    const equippedDisc = {
      ...structuredClone(damageDisc),
      id: 'equipped-proficiency-four',
      mainStat: 'anomaly_proficiency' as const,
    }
    value.warehouse.discs.push(equippedDisc)
    const equipped = current.map((disc) => (disc.slot === 4 ? equippedDisc : disc))
    value.warehouse.roster.agents.find((row) => row.agentId === value.agentId)!.equippedDiscIds =
      equipped.map((disc) => disc.id)
    const before = JSON.stringify(value.warehouse)
    const baseline = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: equipped,
      stale: false,
    })
    const higherDamage = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: current,
      stale: false,
    })
    expect(higherDamage.totalDamage!).toBeGreaterThan(baseline.totalDamage!)
    expect(higherDamage.functionalStats32!.anomProf).toBeLessThan(
      baseline.functionalStats32!.anomProf,
    )
    const result = projectDevelopmentCandidateAlternatives(
      { warehouse: value.warehouse, developmentPriorityAgentIds: [] },
      value.agentId,
    )
    expect(result.status).toBe('ready')
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(
      result.candidates.every((plan) =>
        plan.loadouts[0]!.discs.some((row) => row.disc.id === equippedDisc.id),
      ),
    ).toBe(true)
    expect(JSON.stringify(value.warehouse)).toBe(before)
  })

  it('generates the six-disc optimum under explicit equipment even when account equipment is unknown', () => {
    const value = fixture()
    value.warehouse.roster.agents.find((row) => row.agentId === value.agentId)!.wEngineDetails.id =
      null
    const before = JSON.stringify(value.warehouse)
    const parameters = {
      wEngine: { engineId: 'wengine-14161', level: 60, ascension: 5, refinement: 5 },
    }
    const pools = Array.from({ length: 6 }, (_, slot) =>
      value.warehouse.discs.filter((disc) => disc.slot === slot + 1),
    )
    let oracle = -Infinity
    for (let mask = 0; mask < 64; mask++) {
      const side = evaluateDevelopmentValueBenchmarkSide({
        ...value,
        parameters,
        discs: pools.map((pool, slot) => pool[(mask >> slot) & 1]!),
        stale: false,
      })
      expect(side.state).toBe('supported')
      oracle = Math.max(oracle, side.totalDamage!)
    }
    const result = projectDevelopmentCandidateAlternatives(
      { warehouse: value.warehouse, developmentPriorityAgentIds: [] },
      value.agentId,
      parameters,
    )
    const selected = result.candidates[0]!.loadouts[0]!.discs.map((row) => row.disc)
    expect(
      evaluateDevelopmentValueBenchmarkSide({ ...value, parameters, discs: selected, stale: false })
        .totalDamage,
    ).toBeCloseTo(oracle, 7)
    expect(
      evaluateDevelopmentValueBenchmarkSide({ ...value, discs: selected, stale: false })
        .totalDamage,
    ).toBeNull()
    expect(JSON.stringify(value.warehouse)).toBe(before)
  }, 30000)

  it('does not conflate physical IDs containing separators in full-loadout caches', () => {
    const value = statWeightCalibrationFixture('agent-claret')
    const other = statWeightCalibrationFixture('agent-claret', 'def_percent')
    const current = value.discs.slice()
    current[0]!.id = 'a|b'
    current[1]!.id = 'c'
    other.discs[0]!.id = 'a'
    other.discs[1]!.id = 'b|c'
    value.warehouse.discs.push(...other.discs.slice(0, 2))
    value.warehouse.roster.agents.find((row) => row.agentId === value.agentId)!.equippedDiscIds =
      current.map((disc) => disc.id)
    const buildIntent = compileAgentBuildIntent({
      agentId: value.agentId,
      developmentPriorityAgentIds: [],
    })
    const source = solveCandidateAgentAlternatives(
      value.warehouse.discs,
      value.agentId,
      10,
      {},
      buildIntent.recommendations,
    )
    const result = searchDevelopmentDynamicCandidates({
      ...value,
      buildIntent,
      candidates: source,
      evaluationBudget: 256,
    })
    const alternative = [other.discs[0]!, other.discs[1]!, ...current.slice(2)]
    const expected = evaluateDevelopmentValueBenchmarkSide({
      ...value,
      discs: alternative,
      stale: false,
    }).totalDamage!
    expect(result.search?.best?.evaluation.modeledValue).toBeCloseTo(expected, 8)
    expect(result.candidates[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).toEqual(
      alternative.map((disc) => disc.id),
    )
    expect(expected).toBeCloseTo(803137.3456039455, 8)
  })

  it('matches an independent full inventory enumeration and preserves account facts', () => {
    const value = fixture()
    const before = structuredClone(value.warehouse)
    expect(dynamicLegalInventory(value.warehouse.discs)).toHaveLength(12)
    const buildIntent = compileAgentBuildIntent({
      agentId: value.agentId,
      developmentPriorityAgentIds: [],
    })
    const source = solveCandidateAgentAlternatives(
      value.warehouse.discs,
      value.agentId,
      10,
      {},
      buildIntent.recommendations,
    )
    const result = searchDevelopmentDynamicCandidates({
      ...value,
      buildIntent,
      candidates: source,
      evaluationBudget: 256,
    })
    const pools = Array.from({ length: 6 }, (_, slot) =>
      value.warehouse.discs.filter((disc) => disc.slot === slot + 1),
    )
    let best = -Infinity
    for (let mask = 0; mask < 64; mask++) {
      const discs = pools.map((pool, slot) => pool[(mask >> slot) & 1]!)
      const side = evaluateDevelopmentValueBenchmarkSide({ ...value, discs, stale: false })
      expect(side.state).toBe('supported')
      best = Math.max(best, side.totalDamage!)
    }
    const selected = result.candidates[0]!.loadouts[0]!.discs.map((row) => row.disc)
    expect(
      evaluateDevelopmentValueBenchmarkSide({ ...value, discs: selected, stale: false })
        .totalDamage,
    ).toBeCloseTo(best, 7)
    expect(result.search?.exactWithinDeclaredModel).toBe(true)
    expect(value.warehouse).toEqual(before)
  }, 30000)

  it('reaches the existing player candidate contract, including a non-source main stat', () => {
    const value = fixture()
    const original = value.warehouse.discs.find((disc) => disc.slot === 4)!
    const alternative = {
      ...structuredClone(original),
      id: 'outside-guide-main-four',
      mainStat: 'def_percent' as const,
      subStats: [
        { stat: 'crit_rate' as const, value: 14.4, upgrades: 5 },
        { stat: 'crit_dmg' as const, value: 4.8, upgrades: 0 },
        { stat: 'def_flat' as const, value: 15, upgrades: 0 },
        { stat: 'pen' as const, value: 9, upgrades: 0 },
      ],
    }
    value.warehouse.discs.push(alternative)
    const result = projectDevelopmentCandidateAlternatives(
      { warehouse: value.warehouse, developmentPriorityAgentIds: [] },
      value.agentId,
    )
    expect(result.status).toBe('ready')
    const scores = result.candidates.map(
      (plan) =>
        evaluateDevelopmentValueBenchmarkSide({
          ...value,
          discs: plan.loadouts[0]!.discs.map((row) => row.disc),
          stale: false,
        }).totalDamage!,
    )
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(
      result.candidates.some((plan) =>
        plan.loadouts[0]!.discs.some((row) => row.disc.id === alternative.id),
      ),
    ).toBe(true)
  }, 30000)

  it('keeps unknown outcomes in the source path and never coerces them to zero', () => {
    const value = fixture()
    value.warehouse.roster.agents.find((row) => row.agentId === value.agentId)!.wEngineDetails.id =
      null
    const intent = compileAgentBuildIntent({
      agentId: value.agentId,
      developmentPriorityAgentIds: [],
    })
    const source = solveCandidateAgentAlternatives(
      value.warehouse.discs,
      value.agentId,
      10,
      {},
      intent.recommendations,
    )
    const result = searchDevelopmentDynamicCandidates({
      ...value,
      buildIntent: intent,
      candidates: source,
      evaluationBudget: 8,
    })
    expect(result.candidates).toEqual(source)
    expect(result.search?.unresolved.every((row) => row.evaluation.modeledValue === null)).toBe(
      true,
    )
  })
})
