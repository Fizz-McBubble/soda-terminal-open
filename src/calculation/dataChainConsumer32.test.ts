import { describe, expect, it } from 'vitest'
import {
  createLevel60NeutralEffectRuntimeMember,
  evaluateCurrentPlanningEffectEntries32,
} from './currentPlanningEffectRuntime'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { compileCurrentDriveDiscPlanningEffects } from './currentDriveDiscPlanningEffects'
import {
  evaluateReviewedFunctionalCapacity32,
  preservesReviewedFunctionalCapacities32,
} from './reviewedFunctionalCapacity32'

function actor(agentId: string) {
  const member = createLevel60NeutralEffectRuntimeMember(agentId)
  member.coreLevel = 7
  member.potential = 0
  member.skillLevels = { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 }
  member.initialStats = { ...member.initialStats, atk: 3000, impact: 100, crit_: 0.6 }
  member.finalStats = { ...member.initialStats }
  return member
}

describe('audited source fields reach functional decisions without inventing state', () => {
  it('retains source event-only daze references and leaves an absent trigger unknown', () => {
    const member = actor('agent-anby')
    const evaluate = (condition?: boolean) =>
      evaluateReviewedFunctionalCapacity32({
        member,
        equipmentExclusions: [],
        eventUsages: [
          {
            ownerAgentId: member.agentId,
            eventId: 'basic.BasicAttackThunderbolt.hit-0',
            skillLevel: 12,
            occurrenceCount: 1,
            evidenceRefs: ['source:Anby.ts:Thunderbolt'],
          },
        ],
        baselineReferencesByAgentId:
          condition === undefined ? {} : { 'agent-anby': { core_after3rdBasic: condition } },
      }).capacities[0]!
    expect(evaluate().value).toBeNull()
    expect(evaluate(false).value).toBeCloseTo(100 * (1.424 + 0.065 * 11), 10)
    expect(evaluate(true).value).toBeCloseTo(100 * (1.424 + 0.065 * 11) * 1.64, 10)
  })

  it('consumes Proto Punk two-piece shield exactly once and rejects its loss', () => {
    const member = actor('agent-seth')
    const evaluate = (count: number) => {
      const gear = compileCurrentDriveDiscPlanningEffects({
        members: [member],
        loadouts: [
          {
            agentId: member.agentId,
            discs: Array.from({ length: count }, () => ({ setId: 'set-proto-punk' })),
          },
        ],
      })
      return evaluateReviewedFunctionalCapacity32({
        member,
        equipmentModifierBuckets: gear.buckets,
        equipmentExclusions: gear.exclusions,
      }).capacities
    }
    const none = evaluate(1),
      two = evaluate(2),
      six = evaluate(6)
    expect(none[0]!.value).toBe(2400)
    expect(two[0]!.value).toBeCloseTo(2760, 10)
    expect(six[0]!.value).toBeCloseTo(2760, 10)
    expect(preservesReviewedFunctionalCapacities32(two, none)).toBe(false)
    expect(preservesReviewedFunctionalCapacities32(none, two)).toBe(true)
  })

  it('rejects losing 6% daze even when the initial impact rises 5%', () => {
    const evaluate = (impact: number, count: number) => {
      const member = actor('agent-dialyn')
      member.initialStats = { ...member.initialStats, impact, crit_: 0.5 }
      member.finalStats = { ...member.initialStats }
      const gear = compileCurrentDriveDiscPlanningEffects({
        members: [member],
        loadouts: [
          {
            agentId: member.agentId,
            discs: Array.from({ length: count }, () => ({ setId: 'set-king-of-the-summit' })),
          },
        ],
      })
      return evaluateReviewedFunctionalCapacity32({
        member,
        equipmentModifierBuckets: gear.buckets,
        equipmentExclusions: gear.exclusions,
        eventUsages: [
          {
            ownerAgentId: member.agentId,
            eventId: 'basic.BasicAttackHappyToBeOfService.hit-0',
            skillLevel: 12,
            occurrenceCount: 2,
            evidenceRefs: ['synthetic:same-source-event'],
          },
        ],
      }).capacities
    }
    const before = evaluate(100, 2),
      after = evaluate(105, 1)
    expect(before[0]!.value).toBeCloseTo(100 * (0.194 + 11 * 0.009) * 2 * 1.06, 10)
    expect(after[0]!.value).toBeCloseTo(105 * (0.194 + 11 * 0.009) * 2, 10)
    expect(preservesReviewedFunctionalCapacities32(before, after)).toBe(false)
  })

  it.each([
    ['agent-lucy', 'exSpecial_atk', 'cheerOn'],
    ['agent-caesar', 'core_atk', 'radiant_aegis'],
    ['agent-seth', 'core_anomProf', 'shield_active'],
    ['agent-rina', 'core_pen_', 'minions_onField'],
  ])('%s distinguishes absent, observed off and observed on', (id, effect, condition) => {
    const members = [actor(id), actor('agent-billy'), actor('agent-anby')]
    const entry = getCurrentAgentPlanningEffectBlueprint(`${id}:${effect}`)!
    const evaluate = (refs?: Record<string, unknown>) => {
      const result = evaluateCurrentPlanningEffectEntries32(
        {
          memberIds: members.map((row) => row.agentId),
          members,
          baselineReferencesByAgentId: refs ? { [id]: refs } : undefined,
        },
        [entry],
      )
      expect(result.status).toBe('supported')
      if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
      return result.results.find((row) => row.effectKey === entry.effectKey)!
    }
    expect(evaluate()).toMatchObject({ status: 'excluded_unknown' })
    expect(evaluate({ [condition]: false })).toMatchObject({
      status: 'supported',
      active: false,
      value: 0,
    })
    expect(evaluate({ [condition]: true })).toMatchObject({ status: 'supported', active: true })
  })
})
