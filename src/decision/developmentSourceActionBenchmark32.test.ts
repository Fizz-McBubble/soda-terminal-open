import { describe, expect, it } from 'vitest'
import { candidate, fixture } from './developmentValueBenchmark.fixtures'
import {
  evaluateDevelopmentValueBenchmarkSide,
  projectDevelopmentValueBenchmarks,
} from './developmentValueBenchmark'
import { projectNormalizedAccountFinalStatsDetailed } from './normalizedPlanningCandidateEvaluator'

describe('3.2 existing development comparison source actions', () => {
  it.each([
    ['agent-claret', 'wengine-14161'],
    ['agent-roxy', 'wengine-14162'],
    ['agent-claret', 'wengine-13021'],
    ['agent-claret', 'wengine-13017'],
    ['agent-claret', 'wengine-12016'],
  ])(
    'compares %s with new engine %s through the existing player projection',
    (agentId, engineId) => {
      const { warehouse, baseline } = fixture()
      const agent = warehouse.roster.agents.find((row) => row.agentId === agentId)!
      Object.assign(agent, {
        owned: true,
        level: 50,
        ascension: 4,
        mindscape: 0,
        potentialImage: 0,
        skillLevels: { ...agent.skillLevels, basic: 12, special: 12, chain: 12, core: 7 },
        wEngineDetails: {
          id: agentId === 'agent-roxy' ? 'wengine-12006' : 'wengine-13017',
          name: null,
          level: 40,
          ascension: 3,
          refinement: 1,
        },
        equippedDiscIds: baseline.map((row) => row.id),
      })
      const plan = candidate(baseline)
      plan.agentIds = [agentId]
      plan.loadouts[0]!.agentId = agentId
      const before = JSON.stringify(warehouse)
      const result = projectDevelopmentValueBenchmarks({
        warehouse,
        agentId,
        baseline,
        candidates: [plan],
        stale: false,
        candidateParametersByRank: {
          1: { wEngine: { engineId, level: 50, ascension: 4, refinement: 5 } },
        },
      })[0]!
      expect(result.status, result.reasons.join(';')).toBe('supported')
      expect(result.comparisonBasis.changedDimensions).toEqual(['w_engine'])
      expect(result.baseline.dimensions.w_engine).toContain(':p1:lv40:asc3')
      expect(result.candidate.dimensions.w_engine).toBe(`${engineId}:p5:lv50:asc4`)
      for (const key of ['subject', 'scenario', 'event_set', 'runtime', 'disc_loadout'] as const)
        expect(result.candidate.dimensions[key]).toBe(result.baseline.dimensions[key])
      expect(result.candidate.planningDps).toBeCloseTo(result.candidate.totalDamage! / 30, 8)
      expect(result.candidate.calculationFingerprint).not.toBe(
        result.baseline.calculationFingerprint,
      )
      expect(result.candidate.coverage?.boundary).toContain('不代表完整整队轮转')
      expect(result.candidate.modelQualification32).toMatchObject({
        status: 'formal',
        capability: 'formal_dps',
        wholeTeamFormal: false,
        importReady: false,
      })
      expect(JSON.stringify(warehouse)).toBe(before)
    },
  )

  it('accepts two new agents at actual levels with typed production static stats', () => {
    for (const [agentId, engineId] of [
      ['agent-claret', 'wengine-13021'],
      ['agent-roxy', 'wengine-14162'],
    ] as const) {
      const { warehouse, baseline } = fixture()
      warehouse.roster.agents = warehouse.roster.agents.map((row) =>
        row.agentId === agentId
          ? {
              ...row,
              owned: true,
              level: 50,
              ascension: 4,
              mindscape: 0,
              potentialImage: 0,
              skillLevels: { ...row.skillLevels, special: 12, core: 7 },
            }
          : row,
      )
      const side = evaluateDevelopmentValueBenchmarkSide({
        warehouse,
        agentId,
        discs: baseline,
        stale: false,
        parameters: { wEngine: { engineId, level: 40, ascension: 3, refinement: 1 } },
      })
      expect(side.state, side.reasons.join(';')).toBe('supported')
      expect(side.totalDamage).toBeGreaterThan(0)
      expect(side.dimensions.game_version).toContain('3.2')
      expect(side.coverage?.domain).toBe('fixed_event_direct_damage')
      expect(side.dimensions.scenario).toContain(
        agentId === 'agent-roxy'
          ? 'personal-roxy-prepared-held-one-second-30s-r1'
          : 'personal-claret-prepared-held-subduing-axe-30s-r1',
      )
      expect(side.dimensions.duration).toBe('30')
      expect(side.coverage?.boundary).toContain('不代表完整整队轮转')
      if (agentId === 'agent-claret')
        expect(side.coverage?.includedEffectKeys).toContain('agent-claret:core_crit_')
    }
  })

  it('retains EX-triggered engine windows in the sourced Claret prepared comparison', () => {
    const { warehouse, baseline } = fixture()
    const agent = warehouse.roster.agents.find((row) => row.agentId === 'agent-claret')!
    Object.assign(agent, {
      owned: true,
      level: 50,
      ascension: 4,
      mindscape: 0,
      potentialImage: 0,
      skillLevels: { ...agent.skillLevels, special: 12, core: 7 },
    })
    const before = JSON.stringify(warehouse)
    for (const engineId of ['wengine-14161', 'wengine-13017']) {
      const side = evaluateDevelopmentValueBenchmarkSide({
        warehouse,
        agentId: agent.agentId,
        discs: baseline,
        stale: false,
        parameters: { wEngine: { engineId, level: 40, ascension: 3, refinement: 1 } },
      })
      expect(side.state, side.reasons.join(';')).toBe('supported')
      expect(side.coverage?.excludedEffects).not.toContainEqual(
        expect.objectContaining({
          effectKey: `wengine:${engineId}:formula:${engineId === 'wengine-14161' ? 2 : 1}`,
        }),
      )
      expect(side.coverage?.includedEffectKeys).toContain(
        `wengine:${engineId}:resolved:${engineId === 'wengine-14161' ? 2 : 1}`,
      )
    }
    expect(JSON.stringify(warehouse)).toBe(before)
  })

  it('uses one Roxy held chain in the existing comparison with actual stats and skill level', () => {
    const { warehouse, baseline } = fixture()
    const agent = warehouse.roster.agents.find((row) => row.agentId === 'agent-roxy')!
    Object.assign(agent, {
      owned: true,
      level: 50,
      ascension: 4,
      mindscape: 0,
      potentialImage: 0,
      skillLevels: { ...agent.skillLevels, special: 12, core: 7 },
    })
    // Off-specialty equipment keeps conditional passives out of this arithmetic check.
    const engine = { id: 'wengine-12001', name: '', level: 40, ascension: 3, refinement: 1 }
    const projection = projectNormalizedAccountFinalStatsDetailed({
      agent: { ...agent, wEngineDetails: engine },
      engineId: engine.id,
      discs: baseline,
    })
    if (projection.status !== 'supported') throw new Error(JSON.stringify(projection))
    const before = JSON.stringify(warehouse)
    const result = evaluateDevelopmentValueBenchmarkSide({
      warehouse,
      agentId: agent.agentId,
      discs: baseline,
      stale: false,
      parameters: { wEngine: { engineId: engine.id, ...engine } },
    })
    const stats = projection.stats.finalStats
    // Pinned L12: .280 + 26.086*1s + .638 + 3*.525 + 5.008 + 3*1.049 + 4.174*1s.
    // Existing level-50 coefficient592, neutral enemy DEF700/RES20%, one chain /30s.
    const expected =
      stats.atk *
      40.908 *
      (1 + Math.min(1, stats.crit_) * stats.crit_dmg_) *
      (1 + stats.damageBonus) *
      (592 / (592 + Math.max(0, 700 * (1 - stats.pen_) - stats.pen))) *
      0.8
    expect(result.state, result.reasons.join(';')).toBe('supported')
    expect(result.totalDamage).toBeCloseTo(expected, 6)
    expect(result.planningDps).toBeCloseTo(expected / 30, 6)
    expect(JSON.stringify(warehouse)).toBe(before)
    agent.skillLevels.special = 11
    const lower = evaluateDevelopmentValueBenchmarkSide({
      warehouse,
      agentId: agent.agentId,
      discs: baseline,
      stale: false,
      parameters: { wEngine: { engineId: engine.id, ...engine } },
    })
    expect(lower.state).toBe('supported')
    expect(lower.totalDamage!).toBeLessThan(result.totalDamage!)
    expect(lower.calculationFingerprint).not.toBe(result.calculationFingerprint)
  })

  it('uses the same legal Claret prepared event set at M0–M6 with shared M1/M2 effects', () => {
    const { warehouse, baseline } = fixture()
    const agent = warehouse.roster.agents.find((row) => row.agentId === 'agent-claret')!
    Object.assign(agent, {
      owned: true,
      level: 50,
      ascension: 4,
      mindscape: 0,
      potentialImage: 0,
      skillLevels: { ...agent.skillLevels, basic: 12, special: 12, chain: 12, core: 7 },
    })
    // Off-specialty passive isolates sourced Maim and resistance changes;
    // each side still projects the same actual level and typed DEF panel.
    const parameters = {
      wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
    }
    const evaluate = () =>
      evaluateDevelopmentValueBenchmarkSide({
        warehouse,
        agentId: agent.agentId,
        discs: baseline,
        stale: false,
        parameters,
      })
    const m0 = evaluate()
    agent.mindscape = 1
    const m1 = evaluate()
    agent.mindscape = 2
    const m2 = evaluate()
    for (const side of [m0, m1, m2]) expect(side.state, side.reasons.join(';')).toBe('supported')
    // Independent L12 held+axe63.136; only the three Maims gain M1's30%.
    const m1Ratio = (63.136 + 3 * 16.256 * 0.3) / 63.136
    expect(m1.totalDamage!).toBeCloseTo(m0.totalDamage! * m1Ratio, 6)
    // Source M2 ignores 18 percentage points of the declared 20% resistance.
    expect(m2.totalDamage!).toBeCloseTo(m1.totalDamage! * (0.98 / 0.8), 6)
    expect(m1.coverage?.includedEffectKeys).toContain('agent-claret:m1_maim_mult_')
    expect(m2.coverage?.includedEffectKeys).toContain('agent-claret:m2_electric_resIgn_')
    expect(m1.dimensions.event_set).toBe(m0.dimensions.event_set)
    for (const mindscape of [3, 4, 5, 6]) {
      agent.mindscape = mindscape
      const before = JSON.stringify(warehouse)
      const side = evaluate()
      expect(side.state, side.reasons.join(';')).toBe('supported')
      expect(side.dimensions.scenario).toContain(
        'personal-claret-prepared-held-subduing-axe-30s-r1',
      )
      expect(side.dimensions.event_set).toBe(m0.dimensions.event_set)
      expect(JSON.stringify(warehouse)).toBe(before)
    }
  })
})
