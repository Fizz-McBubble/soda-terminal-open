import { describe, expect, it } from 'vitest'
import { candidate, fixture } from './developmentValueBenchmark.fixtures'
import {
  evaluateDevelopmentValueBenchmarkSide,
  projectDevelopmentValueBenchmarks,
} from './developmentValueBenchmark'
import { projectNormalizedAccountFinalStatsDetailed } from './normalizedPlanningCandidateEvaluator'
import { prepareReviewedPotentialEvents32 } from '../calculation/reviewedPotentialPreparedEvents32'
import { createLevel60NeutralEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'

describe('3.2 existing development comparison source actions', () => {
  it('consumes Ye Unity in the ordinary personal comparison without a calibration producer', () => {
    const { warehouse, baseline } = fixture()
    const agentId = 'agent-ye-shunguang'
    const agent = warehouse.roster.agents.find((row) => row.agentId === agentId)!
    Object.assign(agent, {
      owned: true,
      level: 60,
      ascension: 5,
      mindscape: 0,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
    })
    const before = JSON.stringify(warehouse)
    const side = evaluateDevelopmentValueBenchmarkSide({
      warehouse,
      agentId,
      discs: baseline,
      stale: false,
      parameters: {
        wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
      },
    })
    expect(side.state, side.reasons.join(';')).toBe('supported')
    expect(side.coverage?.includedEffectKeys).toContain('agent-ye-shunguang:reviewed_unity_crit32')
    expect(side.coverage?.includedEffectKeys).toContain(
      'agent-ye-shunguang:reviewed_unity_damage32',
    )
    expect(side.dimensions.scenario).toContain('reviewed-template-per-event-window-comparison-r1')
    expect(side.coverage?.boundary).toContain('非当前实战观测')
    expect(JSON.stringify(warehouse)).toBe(before)
  })
  it('keeps generic source omissions visible even when declared placeholder conditions are inactive', () => {
    const { warehouse, baseline } = fixture()
    const agent = warehouse.roster.agents.find((row) => row.agentId === 'agent-zhao')!
    Object.assign(agent, {
      owned: true,
      level: 60,
      ascension: 5,
      mindscape: 0,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
    })
    const side = evaluateDevelopmentValueBenchmarkSide({
      warehouse,
      agentId: agent.agentId,
      discs: baseline,
      stale: false,
      parameters: {
        wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
      },
    })
    expect(side.state, side.reasons.join(';')).toBe('supported')
    expect(side.coverage?.excludedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectKey: 'agent-zhao:source_mechanism_completeness',
          fields: ['source_mechanism_completeness', 'generic_template'],
        }),
      ]),
    )
  })
  it.each([
    ['agent-lycaon', 'source_daze_basis', 'potential_off_field_encircle_prey_daze'],
    ['agent-burnice', 'anomaly_mastery', 'potential_energy_regen_to_anomaly_mastery'],
  ])('consumes %s potential in the production functional comparison', (agentId, kind, effectId) => {
    const { warehouse, baseline } = fixture()
    baseline[5]!.mainStat = 'energy_regen'
    const agent = warehouse.roster.agents.find((row) => row.agentId === agentId)!
    Object.assign(agent, {
      owned: true,
      level: 60,
      ascension: 5,
      mindscape: 0,
      potentialImage: 0,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
    })
    const evaluate = () =>
      evaluateDevelopmentValueBenchmarkSide({
        warehouse,
        agentId,
        discs: baseline,
        stale: false,
        parameters: {
          wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
        },
      })
    const zero = evaluate()
    agent.potentialImage = 6
    const before = JSON.stringify(warehouse)
    const six = evaluate()
    expect(six.state, six.reasons.join(';')).toBe('supported')
    const p0 = zero.functionalCapacities32?.capacities.find((row) => row.kind === kind)
    const p6 = six.functionalCapacities32?.capacities.find((row) => row.kind === kind)
    if (!p0 || !p6) throw new Error('Missing real functional comparison capacity')
    expect(p6.value, p6.excluded.join(';')).toBeGreaterThan(p0.value!)
    expect(p6.included).toContain(`${agentId}:${effectId}`)
    expect(JSON.stringify(warehouse)).toBe(before)
  })
  it.each([
    ['agent-nekomata', 'potential_pawpad_ambush_crit_damage'],
    ['agent-grace', 'potential_electric_damage'],
    ['agent-harumasa', 'potential_focus_attack'],
    ['agent-ellen', 'potential_qualifying_action_crit_damage'],
  ])('consumes %s potential in the actual development preparation', (agentId, effectId) => {
    const { warehouse, baseline } = fixture()
    const agent = warehouse.roster.agents.find((row) => row.agentId === agentId)!
    Object.assign(agent, {
      owned: true,
      level: 50,
      ascension: 4,
      mindscape: 0,
      potentialImage: 0,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
    })
    const evaluate = () =>
      evaluateDevelopmentValueBenchmarkSide({
        warehouse,
        agentId,
        discs: baseline,
        stale: false,
        parameters: {
          wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
        },
      })
    const zero = evaluate()
    agent.potentialImage = 6
    const before = JSON.stringify(warehouse)
    const six = evaluate()
    expect(zero.state, zero.reasons.join(';')).toBe('supported')
    expect(six.state, six.reasons.join(';')).toBe('supported')
    expect(six.coverage?.includedEffectKeys).toContain(`${agentId}:${effectId}`)
    expect(six.totalDamage).toBeGreaterThan(zero.totalDamage!)
    expect(six.dimensions.scenario).toContain('reviewed-potential-prepared-fixed-events')
    expect(six.dimensions.scenario).toBe(zero.dimensions.scenario)
    expect(six.coverage?.boundary).toContain('非当前实战观测')
    expect(JSON.stringify(warehouse)).toBe(before)
  })
  it('keeps Soldier11 solo preparation inactive and consumes its potential with a real compatible squad', () => {
    const { warehouse, baseline } = fixture()
    const agent = warehouse.roster.agents.find((row) => row.agentId === 'agent-soldier-11')!
    Object.assign(agent, {
      owned: true,
      level: 50,
      ascension: 4,
      mindscape: 0,
      potentialImage: 6,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
    })
    const solo = evaluateDevelopmentValueBenchmarkSide({
      warehouse,
      agentId: agent.agentId,
      discs: baseline,
      stale: false,
      parameters: {
        wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
      },
    })
    expect(solo.state, solo.reasons.join(';')).toBe('supported')
    expect(solo.coverage?.includedEffectKeys).not.toContain(
      'agent-soldier-11:potential_crit_damage',
    )
    const memberIds = ['agent-soldier-11', 'agent-burnice', 'agent-nekomata'] as const
    const members = memberIds.map((id) => {
      const member = createLevel60NeutralEffectRuntimeMember(id)
      const stats = { ...member.initialStats, crit_: 1, crit_dmg_: 1, atk: 1000, damageBonus: 0 }
      return { ...member, level: 1, potential: 0, initialStats: stats, finalStats: stats }
    })
    const actor = members[0]!
    const event = getCurrentAgentEventContract(actor.agentId)!.eventContract.events[0]!
    const eventUsages = [
      {
        ownerAgentId: actor.agentId,
        eventId: event.eventId,
        skillLevel: 1,
        occurrenceCount: 1,
        evidenceRefs: ['source-squad-consumer:test'],
      },
    ]
    const evaluate = () => {
      const prepared = prepareReviewedPotentialEvents32({ member: actor, memberIds, eventUsages })!
      return evaluateSourceBackedPlanningTeamDps({
        members,
        memberIds,
        eventUsages,
        potentialEvents: prepared.potentialEvents,
        baseline: { ...currentNormalizedPlanningBaseline, gameVersion: '3.2' },
      })
    }
    const zero = evaluate()
    actor.potential = 6
    const six = evaluate()
    if (zero.status !== 'supported' || six.status !== 'supported')
      throw new Error(JSON.stringify({ zero, six }))
    expect(six.effectBuckets).toContainEqual(
      expect.objectContaining({
        effectKey: 'agent-soldier-11:potential_crit_damage',
        value: 0.48,
        recipientAgentIds: ['agent-soldier-11'],
      }),
    )
    expect(six.memberDamage[0]!.totalDamage).toBeGreaterThan(zero.memberDamage[0]!.totalDamage)
  })
  it.each([undefined, null])(
    'does not fall back to supported normalized damage for unknown Koleda potential %s',
    (potentialImage) => {
      const { warehouse, baseline } = fixture()
      const agent = warehouse.roster.agents.find((row) => row.agentId === 'agent-koleda')!
      Object.assign(agent, {
        owned: true,
        level: 50,
        ascension: 4,
        mindscape: 0,
        potentialImage,
        skillLevels: { ...agent.skillLevels, basic: 12, core: 7 },
      })
      const parameters = {
        wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
      }
      const result = evaluateDevelopmentValueBenchmarkSide({
        warehouse,
        agentId: agent.agentId,
        discs: baseline,
        stale: false,
        parameters,
      })
      expect(result.state).toBe('unsupported')
      expect(result.reasons).toContain('explicit_potential_required')
      expect(result.totalDamage).toBeNull()
      agent.potentialImage = 0
      expect(
        evaluateDevelopmentValueBenchmarkSide({
          warehouse,
          agentId: agent.agentId,
          discs: baseline,
          stale: false,
          parameters,
        }).state,
      ).toBe('supported')
    },
  )
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
