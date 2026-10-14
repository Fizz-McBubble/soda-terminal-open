import { expect, it } from 'vitest'
import { fixture } from './developmentValueBenchmark.fixtures'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'
import { prepareReviewedPotentialEvents32 } from '../calculation/reviewedPotentialPreparedEvents32'
import { createLevel60NeutralEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
export function registerDevelopmentSourceWindowTests32() {
  it('consumes declared White Water windows in the actual personal comparison without inferring them from Unity', () => {
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
    for (const disc of baseline) disc.setId = 'set-white-water-ballad'
    const before = JSON.stringify(warehouse)
    const common = {
      warehouse,
      agentId,
      discs: baseline,
      stale: false,
      parameters: {
        wEngine: { engineId: 'wengine-12001', level: 40, ascension: 3, refinement: 1 },
      },
    }
    const unknown = evaluateDevelopmentValueBenchmarkSide(common)
    const inactive = evaluateDevelopmentValueBenchmarkSide({
      ...common,
      eventConditionDeclaration: {
        sourceRefs: ['explicit-fixed-event-window'],
        whiteWaterBalladCritWindow: false,
        whiteWaterBalladAttackWindow: false,
      },
    })
    const active = evaluateDevelopmentValueBenchmarkSide({
      ...common,
      eventConditionDeclaration: {
        sourceRefs: ['explicit-fixed-event-window'],
        whiteWaterBalladCritWindow: true,
        whiteWaterBalladAttackWindow: true,
      },
    })
    expect(active.state, active.reasons.join(';')).toBe('supported')
    expect(active.totalDamage).toBeGreaterThan(inactive.totalDamage!)
    expect(unknown.totalDamage).toBe(inactive.totalDamage)
    expect(unknown.coverage?.excludedEffects).toContainEqual(
      expect.objectContaining({
        effectKey: `disc:${agentId}:set-white-water-ballad:four-piece`,
        reason: 'unobserved_condition',
      }),
    )
    expect(active.coverage?.includedEffectKeys).toContain(
      'disc:set-white-water-ballad:four-piece:0',
    )
    expect(active.coverage?.includedEffectKeys).toContain(
      'disc:set-white-water-ballad:four-piece:1',
    )
    expect(active.coverage?.includedEffectKeys).toContain(`${agentId}:reviewed_unity_crit32`)
    expect(active.dimensions.scenario).not.toBe(inactive.dimensions.scenario)
    expect(JSON.stringify(warehouse)).toBe(before)
  })

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
}
