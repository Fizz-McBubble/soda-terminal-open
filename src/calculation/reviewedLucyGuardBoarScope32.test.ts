import { describe, expect, it } from 'vitest'
import {
  compileCurrentPlanningSelfEffects32,
  planningRuntimeEffectBuckets32,
} from './currentPlanningSelfEffects32'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { calculateCurrentPlanningEventDamage32 } from './currentPlanningEventDamage32'
import { resolveCurrentPlanningEventEffects32 } from './currentPlanningEventEffectResolution32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import {
  evaluateSourceBackedPersonalPlanningDps,
  evaluateSourceBackedPlanningTeamDps,
} from './currentPlanningTeamDpsRuntime'
import { baseline, member, usage } from './currentPlanningEventEffectResolution32.testFixture'

const ordinary = 'basic.BasicAttackLadysBat.hit-0'
const boarEvents = [
  'basic.GuardBoarsToArms.hit-0',
  'basic.GuardBoarsToArms.hit-1',
  'basic.GuardBoarsToArms.hit-2',
  'basic.GuardBoarsSpinningSwing.hit-0',
]

function journey(coreLevel: number, cheerOn?: boolean, self = false, mindscape = 0) {
  const lucy = { ...member('agent-lucy'), coreLevel, mindscape }
  lucy.skillLevels = { ...lucy.skillLevels, special: 1 }
  const members = self ? [lucy] : [lucy, member('agent-billy'), member('agent-soldier-11')]
  const memberIds = members.map((row) => row.agentId)
  const references = cheerOn === undefined ? {} : { cheerOn }
  const entries = ['exSpecial_atk', 'core_atk', 'm4_crit_dmg_'].map(
    (id) => getCurrentAgentPlanningEffectBlueprint(`agent-lucy:${id}`)!,
  )
  const selfCompiled = self
    ? compileCurrentPlanningSelfEffects32({ member: lucy, references })
    : null
  const compiled =
    selfCompiled ??
    evaluateCurrentPlanningEffectEntries32(
      { members, memberIds, baselineReferencesByAgentId: { [lucy.agentId]: references } },
      entries,
    )
  if (compiled.status !== 'supported') throw new Error(JSON.stringify(compiled))
  const buckets = planningRuntimeEffectBuckets32(compiled.results, memberIds)
  const actualEntries = selfCompiled?.status === 'supported' ? selfCompiled.entries : entries
  const context = {
    members,
    memberIds,
    entries: actualEntries,
    baselineReferencesByAgentId: { [lucy.agentId]: references },
  }
  const resolve = (eventId: string) => {
    const event = getCurrentAgentEventContract(lucy.agentId)!.eventContract.events.find(
      (row) => row.eventId === eventId,
    )!
    const result = resolveCurrentPlanningEventEffects32({
      ...context,
      ownerAgentId: lucy.agentId,
      event,
      attribute: event.attribute ?? 'fire',
      buckets,
    })
    if (result.status !== 'supported') throw new Error(JSON.stringify(result))
    return result
  }
  const damage = (eventId: string) =>
    calculateCurrentPlanningEventDamage32({
      member: lucy,
      buckets,
      eventUsages: [usage(lucy.agentId, eventId)],
      baseline,
      eventEffectContext: { ...context, consumedBuckets: [], exclusions: [] },
    })!
  return { compiled, resolve, damage }
}

describe('Lucy actual recipients through self/formation producer and shared event formula', () => {
  it('retains pinned extra-ATK source values as event-only effects, with only the four boar recipients', () => {
    const source = getCurrentAgentDecisionMechanicContract('agent-lucy')!.effectContract.source
    expect(source.formulaSha256).toBe(
      '7B7964B69D7D18A4EAD0914B2DA83915EC4DE5BB795098F078EA9A381DE5B903',
    )
    expect(getCurrentAgentPlanningEffectBlueprint('agent-lucy:core_atk')!.applicationScope).toBe(
      'event_only',
    )
    const bound = getCurrentAgentEventContract('agent-lucy')!.eventContract.events.filter((row) =>
      row.eventModifierRefs.includes('core_atk'),
    )
    expect(bound.map((row) => row.eventId)).toEqual(boarEvents)
  })
  it.each([
    [1, 0.4],
    [7, 1],
  ])(
    'core %s gives ordinary Lucy only team Cheer On, and all four boar events their extra component',
    (core, extra) => {
      const inactive = journey(core, false)
      const active = journey(core, true)
      // Special 1, initial ATK 1000: 1000*(13%+0.8%)+40+4 = 182, below cap.
      expect(active.resolve(ordinary).finalStats['agent-lucy']!.atk).toBeCloseTo(1182, 10)
      expect(
        active.resolve(ordinary).buckets.some((row) => row.effectKey === 'agent-lucy:core_atk'),
      ).toBe(false)
      expect(active.damage(ordinary) / inactive.damage(ordinary)).toBeCloseTo(1.182, 10)
      for (const eventId of boarEvents) {
        expect(active.resolve(eventId).finalStats['agent-lucy']!.atk).toBeCloseTo(
          1182 + 182 * extra,
          10,
        )
        expect(active.damage(eventId) / inactive.damage(eventId)).toBeCloseTo(
          (1182 + 182 * extra) / 1000,
          10,
        )
      }
    },
  )

  it.each([1, 7])('self receives the same team component once at core %s', (core) => {
    const personal = journey(core, true, true)
    const formation = journey(core, true)
    for (const eventId of [ordinary, ...boarEvents]) {
      expect(personal.resolve(eventId).finalStats['agent-lucy']!.atk).toBeCloseTo(
        formation.resolve(eventId).finalStats['agent-lucy']!.atk,
        10,
      )
      expect(personal.damage(eventId)).toBeCloseTo(formation.damage(eventId), 10)
    }
  })

  it('never invents Cheer On without an explicit state', () => {
    for (const self of [false, true]) {
      const unknown = journey(7, undefined, self)
      const off = journey(7, false, self)
      for (const eventId of [ordinary, ...boarEvents]) {
        expect(unknown.resolve(eventId).finalStats['agent-lucy']!.atk).toBe(1000)
        expect(unknown.damage(eventId)).toBe(off.damage(eventId))
      }
    }
  })

  it('keeps the source M4 team crit damage for Lucy once, still behind mindscape and Cheer On', () => {
    for (const self of [false, true]) {
      expect(journey(7, true, self, 3).resolve(ordinary).finalStats['agent-lucy']!.crit_dmg_).toBe(
        0,
      )
      expect(journey(7, false, self, 4).resolve(ordinary).finalStats['agent-lucy']!.crit_dmg_).toBe(
        0,
      )
      expect(
        journey(7, undefined, self, 4).resolve(ordinary).finalStats['agent-lucy']!.crit_dmg_,
      ).toBe(0)
      expect(
        journey(7, true, self, 4).resolve(ordinary).finalStats['agent-lucy']!.crit_dmg_,
      ).toBeCloseTo(0.1, 10)
    }
  })

  it('closes the actual personal and formation runtime callers with the same declared Cheer On', () => {
    const lucy = {
      ...member('agent-lucy'),
      skillLevels: { ...member('agent-lucy').skillLevels, special: 1 },
    }
    const memberIds = ['agent-lucy', 'agent-billy', 'agent-soldier-11'] as const
    const members = [lucy, member('agent-billy'), member('agent-soldier-11')]
    for (const cheerOn of [undefined, false, true]) {
      const references = cheerOn === undefined ? {} : { cheerOn }
      for (const eventId of [ordinary, boarEvents[0]!]) {
        const eventUsages = [usage(lucy.agentId, eventId)]
        const personal = evaluateSourceBackedPersonalPlanningDps({
          member: lucy,
          baselineReferences: references,
          eventUsages,
          baseline,
        })
        const formation = evaluateSourceBackedPlanningTeamDps({
          members,
          memberIds,
          baselineReferencesByAgentId: { [lucy.agentId]: references },
          eventUsages,
          baseline,
        })
        if (personal.status !== 'supported' || formation.status !== 'supported')
          throw new Error(JSON.stringify({ personal, formation }))
        expect(personal.totalDamage).toBeCloseTo(
          formation.memberDamage.find((row) => row.agentId === lucy.agentId)!.totalDamage,
          10,
        )
      }
    }
  })
})
