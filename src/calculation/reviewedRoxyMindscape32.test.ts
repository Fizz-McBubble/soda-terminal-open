import { roxyPreparedState, roxyHeldConditions } from './reviewedRoxyPreparedAction32.testFixture'
import { describe, expect, it } from 'vitest'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import { evaluateSourceBackedPersonalPlanningDps } from './currentPlanningTeamDpsRuntime'
import { developmentSourceAction32 } from '../decision/developmentSourceAction32'
import { qualifyReviewedPreparedBenchmark32 } from './reviewedPreparedBenchmark32'
import { compileReviewedRoxyHeldAction32 } from './reviewedRoxyHeldAction32'
import { fixture as teamFixture } from '../decision/targetTeamPlanningContext.testFixture'
import { compileTargetTeamPlanningContext } from '../decision/targetTeamPlanningContext'

function evaluate(mindscape: number, stunMultiplier = 1, special = 12) {
  const base = createLevel60NeutralEffectRuntimeMember('agent-roxy')
  const stats = {
    ...base.finalStats,
    atk: 1000,
    def: 400,
    crit_: 0.5,
    crit_dmg_: 1,
    enerRegen: 1.2,
    damageBonus: 0,
    pen_: 0,
    pen: 0,
  }
  const member = {
    ...base,
    level: 60,
    coreLevel: 7,
    mindscape,
    potential: 0,
    skillLevels: { basic: 12, special },
    initialStats: { ...stats },
    finalStats: { ...stats },
  }
  const packet = developmentSourceAction32(member)
  if (packet?.status !== 'supported') throw new Error(JSON.stringify(packet))
  const baseline = {
    ...currentNormalizedPlanningBaseline,
    enemy: {
      id: 'independent-roxy-defense794',
      defense: 794,
      resistance: 0.2,
      stunMultiplier,
      vulnerability: 0,
    },
  }
  const result = evaluateSourceBackedPersonalPlanningDps({
    member,
    baseline,
    ...packet.runtimeInput,
  })
  if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
  const qualificationInput = {
    member,
    baseline,
    policyId: packet.policyId,
    actionIdentity: packet.identity,
    eventUsages: packet.eventUsages,
    resourceLegality: packet.resourceLegality,
    engine: { engineId: 'wengine-12001', level: 60, refinement: 1 },
    discs: [],
    accountId: 'isolated-mindscape',
    accountHash: 'literal-v1',
    effects: result.effectBuckets,
    totalDamage: result.totalDamage,
    planningDps: result.planningDps,
    stale: false,
  }
  return { member, packet, result, qualificationInput }
}

describe('Roxy M0–M6 source packet and shared arithmetic', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])(
    'consumes M%s through the existing personal formula',
    (mindscape) => {
      const { result, packet, qualificationInput } = evaluate(mindscape)
      // Independent GO 3456cd source L12 coefficients. Both cannon rows belong
      // to its first contact; only hammer/eyes/storm receive its new M1 debuff.
      const beforeRelease = 0.28 + 26.086 + 0.638 + 3 * 0.525
      const afterRelease = 5.008 + 3 * 1.049 + 4.174 * (mindscape === 6 ? 3 * 2.5 : 1)
      const initialResistance = 0.8 + (mindscape === 6 ? 0.15 : 0)
      const laterResistance = initialResistance + (mindscape >= 1 ? 0.15 : 0)
      const crit = 1 + 0.5 * (1 + (mindscape >= 1 ? 0.4 : 0))
      const expected =
        1000 * 0.5 * crit * (beforeRelease * initialResistance + afterRelease * laterResistance)
      expect(result.totalDamage).toBeCloseTo(expected, 7)
      expect(result.planningDps).toBeCloseTo(expected / 30, 7)
      expect(qualifyReviewedPreparedBenchmark32(qualificationInput)?.status).toBe('formal')
      expect(packet.resourceLegality).toMatchObject({
        legal: true,
        windflow: { consumed: 0, freeWhirlwindSeconds: 0 },
        afterecho: { additionalStorms: mindscape === 6 ? 2 : 0 },
      })
    },
  )

  it('uses the sourced M2 stun increase after first contact, only in an existing stun window', () => {
    const neutralM1 = evaluate(1).result.totalDamage
    expect(evaluate(2).result.totalDamage).toBeCloseTo(neutralM1, 7)
    const { result } = evaluate(2, 1.5)
    const expected =
      1000 *
      0.5 *
      1.7 *
      (0.28 * 0.8 * 1.5 +
        (26.086 + 0.638 + 3 * 0.525) * 0.8 * 1.8 +
        (5.008 + 3 * 1.049 + 4.174) * 0.95 * 1.8)
    expect(result.totalDamage).toBeCloseTo(expected, 7)
    expect(
      result.effectBuckets.some(
        (row) => row.effectKey === 'agent-roxy:m2_stun_' && row.value === 0.3,
      ),
    ).toBe(true)
  })

  it('keeps explicit effective skill levels authoritative at M3/M5 without double adding levels', () => {
    expect(evaluate(3, 1, 12).result.totalDamage).toBe(evaluate(2, 1, 12).result.totalDamage)
    expect(evaluate(3, 1, 14).result.totalDamage).toBeGreaterThan(
      evaluate(3, 1, 12).result.totalDamage,
    )
    expect(evaluate(5, 1, 16).result.totalDamage).toBeGreaterThan(
      evaluate(5, 1, 14).result.totalDamage,
    )
    expect(evaluate(5, 1, 16).packet.eventUsages.every((row) => row.skillLevel === 16)).toBe(true)
  })

  it('requires M6 afterecho contact and rejects tampered exposure/counts at qualification', () => {
    const { packet, qualificationInput } = evaluate(6)
    expect(packet.eventUsages.at(-1)).toMatchObject({ occurrenceCount: 3, durationSeconds: 3 })
    for (const patch of [{ occurrenceCount: 1 }, { durationSeconds: 1 }, { durationSeconds: 9 }]) {
      const eventUsages = packet.eventUsages.map((row, i) =>
        i === packet.eventUsages.length - 1 ? { ...row, ...patch } : row,
      )
      expect(qualifyReviewedPreparedBenchmark32({ ...qualificationInput, eventUsages })).toBeNull()
    }
    const missingContact = compileReviewedRoxyHeldAction32({
      mindscape: 6,
      skillLevel: 12,
      holdDurationSeconds: 1,
      preparedState: roxyPreparedState(120),
      conditions: roxyHeldConditions(),
    })
    expect(missingContact.status).toBe('unsupported')
  })
})

describe('Roxy mindscapes through the existing eighteen-disc consumer', () => {
  it('keeps all M0–M6 qualified and applies new enemy debuffs to later allies only', () => {
    const original = teamFixture()
    const ids = ['agent-claret', 'agent-roxy', 'agent-koleda'] as const
    original.warehouse.roster.agents = original.warehouse.roster.agents.map((agent) =>
      ids.includes(agent.agentId as (typeof ids)[number])
        ? {
            ...agent,
            owned: true,
            level: 50,
            ascension: 4,
            mindscape: 0,
            potentialImage: 0,
            skillLevels: { ...agent.skillLevels, basic: 12, special: 12, chain: 12, core: 7 },
          }
        : agent,
    )
    original.warehouse.discs = original.warehouse.discs.map((disc) => ({
      ...disc,
      setId:
        disc.slot <= 2
          ? 'set-fanged-metal'
          : disc.slot <= 4
            ? 'set-woodpecker-electro'
            : 'set-soul-rock',
    }))
    const input = {
      ...original,
      candidate: { ...original.candidate, memberIds: [...ids] as [string, string, string] },
      fit: {
        ...original.fit,
        memberIds: [...ids] as [string, string, string],
        loadouts: original.fit.loadouts.map((row, i) => ({ ...row, agentId: ids[i]! })),
      },
      parameters: {
        ...original.parameters,
        wEngines: ids.map((agentId) => ({
          agentId,
          engineId: 'wengine-12001',
          level: 40,
          ascension: 3,
          refinement: 1,
        })),
      },
    }
    const results = Array.from({ length: 7 }, (_, mindscape) => {
      input.warehouse.roster.agents.find((row) => row.agentId === 'agent-roxy')!.mindscape =
        mindscape
      const before = JSON.stringify(input)
      const result = compileTargetTeamPlanningContext(input)
      if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
      expect(JSON.stringify(input)).toBe(before)
      expect(result.memberModelQualification32).toMatchObject({ status: 'formal' })
      expect(result.totalDamage).toBeCloseTo(
        result.memberDamage.reduce((sum, row) => sum + row.totalDamage, 0),
        7,
      )
      expect(result.planningDps).toBeCloseTo(result.totalDamage / 30, 7)
      return result
    })
    const damage = (m: number, id: string) =>
      results[m]!.memberDamage.find((row) => row.agentId === id)!.totalDamage
    expect(damage(1, 'agent-claret')).toBe(damage(0, 'agent-claret'))
    expect(damage(1, 'agent-koleda')).toBeGreaterThan(damage(0, 'agent-koleda'))
    expect(damage(1, 'agent-roxy')).toBeGreaterThan(damage(0, 'agent-roxy'))
    expect(damage(6, 'agent-roxy')).toBeGreaterThan(damage(5, 'agent-roxy'))
  })
})
