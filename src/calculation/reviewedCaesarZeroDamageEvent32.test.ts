import { describe, expect, it } from 'vitest'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import { calculateCurrentPlanningEventDamage32 } from './currentPlanningEventDamage32'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from './currentNormalizedPlanningBaseline'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'

const neutral = createLevel60NeutralEffectRuntimeMember('agent-caesar')
const stats = { ...neutral.finalStats, atk: 1000, crit_: 0, crit_dmg_: 0, pen_: 0, pen: 0 }
const member = { ...neutral, level: 1, initialStats: stats, finalStats: stats }
const baseline = {
  ...currentNormalizedPlanningBaseline,
  gameVersion: '3.2',
  enemy: {
    ...currentNormalizedPlanningBaseline.enemy,
    defense: 50,
    resistance: 0,
    stunMultiplier: 1,
    vulnerability: 0,
  },
}
const zeroEventId = 'special.EXSpecialAttackParryCounter.hit-1'
const usage = {
  ownerAgentId: member.agentId,
  eventId: zeroEventId,
  skillLevel: 1,
  occurrenceCount: 3,
  evidenceRefs: ['source-zero-damage:caesar-parry-counter'],
}

describe('Caesar sourced zero-damage event remains in the actual damage consumer', () => {
  it('retains all three source rows, including the positive daze and buildup row', () => {
    const contract = getCurrentAgentEventContract(member.agentId)!
    expect(contract.source.statsSha256).toBe(
      '9A73253C268C12E57EAA494375E7E288F5F137833070BEE418669E3C8C7C47F6',
    )
    const row = contract.eventContract.events.find((event) => event.eventId === zeroEventId)!
    expect(row.operators.damageMultiplier).toMatchObject({ base: 0, growthPerLevel: 0 })
    expect(
      resolveCurrentAgentEvent({ stableId: member.agentId, eventId: zeroEventId, skillLevel: 1 }),
    ).toMatchObject({
      status: 'supported',
      damageMultiplier: 0,
      dazeMultiplier: 1.54,
      anomalyBuildup: 100,
    })
    const schedule = compileNormalizedAgentEventSchedule({
      agentId: member.agentId,
      skillLevels: { special: 1 },
    })
    expect(schedule.status).toBe('supported')
    if (schedule.status !== 'supported') return
    expect(schedule.eventUsages.map((event) => event.eventId)).toEqual([
      'special.EXSpecialAttackParryCounter.hit-0',
      zeroEventId,
      'special.EXSpecialAttackParryCounter.hit-2',
    ])
    // Source MV3.872, two damaging rows, three uses, ATK1000, level1 DEF factor1/2.
    expect(
      calculateCurrentPlanningEventDamage32({
        member,
        baseline,
        buckets: [],
        eventUsages: schedule.eventUsages,
      }),
    ).toBeCloseTo(11616)
    expect(
      calculateCurrentPlanningEventDamage32({
        member,
        baseline,
        buckets: [],
        eventUsages: [usage],
      }),
    ).toBe(0)
  })

  it('keeps invalid panel, enemy and source observations unsupported even for the zero row', () => {
    const input = { member, baseline, buckets: [], eventUsages: [usage] }
    expect(
      calculateCurrentPlanningEventDamage32({
        ...input,
        member: { ...member, finalStats: { ...stats, atk: Number.NaN } },
      }),
    ).toBeNull()
    expect(
      calculateCurrentPlanningEventDamage32({
        ...input,
        baseline: { ...baseline, enemy: { ...baseline.enemy, defense: -1 } },
      }),
    ).toBeNull()
    expect(
      calculateCurrentPlanningEventDamage32({
        ...input,
        eventUsages: [{ ...usage, skillLevel: 17 }],
      }),
    ).toBeNull()
    expect(
      calculateCurrentPlanningEventDamage32({
        ...input,
        eventUsages: [{ ...usage, occurrenceCount: 0 }],
      }),
    ).toBeNull()
  })
})
