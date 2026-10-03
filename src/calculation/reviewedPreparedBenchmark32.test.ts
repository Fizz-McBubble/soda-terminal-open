import { describe, expect, it } from 'vitest'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import { evaluateSourceBackedPersonalPlanningDps } from './currentPlanningTeamDpsRuntime'
import { developmentSourceAction32 } from '../decision/developmentSourceAction32'
import {
  qualifyReviewedPreparedBenchmark32,
  reviewedPreparedBenchmarkCapabilities32,
} from './reviewedPreparedBenchmark32'

function fixture(agentId: string) {
  const member = createLevel60NeutralEffectRuntimeMember(agentId)
  const stats = {
    ...member.finalStats,
    atk: 1000,
    def: 400,
    crit_: 0.5,
    crit_dmg_: 1,
    enerRegen: 1.2,
    damageBonus: 0,
    pen_: 0,
    pen: 0,
    lacerationDamage: 1.5,
    sharpDamageBonus: 0,
    directDamageBonus: 0,
    buffBonus: 0,
  }
  Object.assign(member, {
    level: 60,
    coreLevel: 7,
    mindscape: 0,
    potential: 0,
    skillLevels: { basic: 12, special: 12 },
    initialStats: { ...stats },
    finalStats: { ...stats },
  })
  const selected = developmentSourceAction32(member)
  if (selected?.status !== 'supported') throw new Error(JSON.stringify(selected))
  const baseline = {
    ...currentNormalizedPlanningBaseline,
    enemy: {
      id: 'declared-defense794',
      defense: 794,
      resistance: 0,
      stunMultiplier: 1,
      vulnerability: 0,
    },
  }
  const runtime = evaluateSourceBackedPersonalPlanningDps({
    member,
    baseline,
    ...selected.runtimeInput,
  })
  if (runtime.status !== 'supported') throw new Error(runtime.blockers.join(';'))
  return {
    member,
    baseline,
    selected,
    runtime,
    qualificationInput: {
      member,
      baseline,
      policyId: selected.policyId,
      actionIdentity: selected.identity,
      eventUsages: selected.eventUsages,
      resourceLegality: selected.resourceLegality,
      engine: { engineId: 'wengine-12001', level: 60, refinement: 1 },
      discs: [],
      accountId: 'isolated-arithmetic',
      accountHash: 'literal-input-v1',
      effects: { included: runtime.effectBuckets, excluded: runtime.sourceEffectExclusions },
      totalDamage: runtime.totalDamage,
      planningDps: runtime.planningDps,
      stale: false,
    },
  }
}

describe('reviewed finite prepared personal CalculationContext', () => {
  it.each([
    // DEF400 * MV63.136 * .5 DEF * (1+1*1.5)*(1+.15*1.5).
    ['agent-claret', 38670.8],
    // ATK1000 * MV40.908 * .5 DEF * (1+.5*1).
    ['agent-roxy', 30681],
    // ATK1000 * (1.274+1.584+3.225+8.108) * .5 DEF * 1.5 crit.
    ['agent-koleda', 10643.25],
  ] as const)(
    'qualifies %s through the shared formula with independent arithmetic',
    (agentId, expected) => {
      const { runtime, qualificationInput } = fixture(agentId)
      expect(runtime.totalDamage).toBeCloseTo(expected, 7)
      expect(runtime.planningDps).toBeCloseTo(expected / 30, 7)
      const qualification = qualifyReviewedPreparedBenchmark32(qualificationInput)
      expect(qualification).toMatchObject({
        status: 'formal',
        capability: 'formal_dps',
        scope: 'personal_prepared_fixed_event_model',
        wholeTeamFormal: false,
        importReady: false,
      })
      expect(qualification?.contextComparisonKey).toBe(
        qualifyReviewedPreparedBenchmark32(qualificationInput)?.contextComparisonKey,
      )
    },
  )

  it('does not promote a six-Maim inventory, unknown resource state, stale input or changed counts', () => {
    const { qualificationInput } = fixture('agent-claret')
    for (const patch of [
      { policyId: 'personal-claret-authored-six-maim-30s-r1' },
      { resourceLegality: { legal: false } },
      { stale: true },
      { eventUsages: qualificationInput.eventUsages.slice(1) },
      { baseline: { ...qualificationInput.baseline, declaredDurationSeconds: 12 } },
      { member: { ...qualificationInput.member, level: undefined } },
    ])
      expect(qualifyReviewedPreparedBenchmark32({ ...qualificationInput, ...patch })).toBeNull()
    const changed = qualificationInput.eventUsages.map((row, index) =>
      index ? row : { ...row, occurrenceCount: 2 },
    )
    expect(
      qualifyReviewedPreparedBenchmark32({ ...qualificationInput, eventUsages: changed }),
    ).toBeNull()
    expect(reviewedPreparedBenchmarkCapabilities32.map((row) => row.agentId)).toEqual([
      'agent-claret',
      'agent-roxy',
      'agent-koleda',
    ])
  })

  it('consumes Koleda potential in her own received team buff and only the eligible enhanced hit', () => {
    const { member, baseline } = fixture('agent-koleda')
    for (const potential of [0, 1, 2, 3, 4, 5, 6]) {
      member.potential = potential
      const packet = developmentSourceAction32(member)
      if (packet?.status !== 'supported') throw new Error(JSON.stringify(packet))
      const runtime = evaluateSourceBackedPersonalPlanningDps({
        member,
        baseline,
        ...packet.runtimeInput,
      })
      if (runtime.status !== 'supported') throw new Error(runtime.blockers.join(';'))
      const critBonus = [0, 0, 0.11, 0.17, 0.23, 0.29, 0.35][potential]!
      const active = potential >= 2
      const weighted = 14.191 * (active ? 1.35 : 1) + (active ? 8.108 * 0.1 : 0)
      expect(runtime.totalDamage).toBeCloseTo(
        1000 * weighted * 0.5 * (1 + 0.5 * (1 + critBonus)),
        7,
      )
      if (active)
        expect(runtime.effectBuckets.map((row) => row.effectKey)).toContain(
          'agent-koleda:basic_common_dmg_',
        )
    }
  })
})
