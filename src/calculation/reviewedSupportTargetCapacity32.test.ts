import { describe, expect, it } from 'vitest'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'
import { evaluateReviewedSupportTargetCapacity32 } from './reviewedSupportTargetCapacity32'
import { preservesReviewedFunctionalCapacities32 } from './reviewedFunctionalCapacity32'

function capacity(agentId: string, hp: number, core = 7, special = 12, darkbreaker?: boolean) {
  const member = createLevel60NeutralEffectRuntimeMember(agentId)
  member.coreLevel = core
  member.skillLevels = { ...member.skillLevels, special }
  member.initialStats = { ...member.initialStats, hp }
  member.finalStats = { ...member.finalStats, hp: 99000 } // Must not use final/combat HP.
  return evaluateReviewedSupportTargetCapacity32({
    member,
    members: [member, createLevel60NeutralEffectRuntimeMember('agent-billy')],
    equipmentExclusions: [],
    baselineReferencesByAgentId: { [agentId]: { darkbreaker, inside_any_ether_veil: true } },
  })
}

describe('source-bound independent support capacities', () => {
  it('caps Zhao core7 HP target progress at 27000 without freezing surplus or pricing damage', () => {
    const before = capacity('agent-zhao', 30000).capacities
    expect(before[0]!.value).toBe(0.4)
    expect(
      preservesReviewedFunctionalCapacities32(before, capacity('agent-zhao', 27000).capacities),
    ).toBe(true)
    expect(
      preservesReviewedFunctionalCapacities32(before, capacity('agent-zhao', 26000).capacities),
    ).toBe(false)
    expect(capacity('agent-zhao', 30000, 6).capacities[0]!.value).toBeNull()
    expect(before[0]!.included.join()).toContain('非团队伤害')
    expect(capacity('agent-zhao', 15000).capacities[0]!.value).toBe(0.1)
    expect(capacity('agent-zhao', 26600).capacities[0]!.value).toBe(0.39)
    expect(capacity('agent-zhao', 26601).capacities[0]!.value).toBeNull()
  })
  it('evaluates Lucia pinned EX expression at actual skill, independent of other HP purposes', () => {
    const before = capacity('agent-lucia', 30000, 7, 12, true).capacities
    expect(before[0]!.value).toBe(900)
    expect(capacity('agent-lucia', 24000, 7, 12, true).capacities[0]!.value).toBe(900)
    expect(capacity('agent-lucia', 20000, 7, 12, true).capacities[0]!.value).toBe(752)
    expect(
      preservesReviewedFunctionalCapacities32(
        before,
        capacity('agent-lucia', 24000, 7, 12, true).capacities,
      ),
    ).toBe(true)
    expect(
      preservesReviewedFunctionalCapacities32(
        before,
        capacity('agent-lucia', 24000, 7, 11, true).capacities,
      ),
    ).toBe(false)
    expect(capacity('agent-lucia', 24000).capacities[0]!.value).toBeNull()
    expect(capacity('agent-lucia', 24000, 7, 12, false).capacities[0]!.value).toBe(0)
    for (const [special, cap] of [
      [1, 636],
      [7, 780],
      [16, 996],
    ]) {
      expect(capacity('agent-lucia', 24000, 7, special, true).capacities[0]!.value).toBeCloseTo(
        cap,
        10,
      )
      expect(capacity('agent-lucia', 24200, 7, special, true).capacities[0]!.value).toBeCloseTo(
        cap,
        10,
      )
    }
  })
  it('binds Remielle entry attack to the actual team and keeps AP distinct from anomaly count', () => {
    const actor = createLevel60NeutralEffectRuntimeMember('agent-remielle')
    actor.initialStats.atk = 4000
    const evaluate = (ids: string[], entered: boolean | undefined) =>
      evaluateReviewedSupportTargetCapacity32({
        member: actor,
        members: [actor, ...ids.map(createLevel60NeutralEffectRuntimeMember)],
        equipmentExclusions: [],
        baselineReferencesByAgentId: { [actor.agentId]: { battlefield_entered: entered } },
      })
    const before = JSON.stringify(actor)
    expect(evaluate(['agent-grace', 'agent-billy'], true).capacities[0]!.value).toBe(480)
    expect(evaluate(['agent-grace', 'agent-jane'], true).capacities[0]!.value).toBe(1600)
    expect(evaluate(['agent-grace', 'agent-jane'], false).capacities[0]!.value).toBe(0)
    expect(evaluate(['agent-grace', 'agent-jane'], undefined).capacities[0]!.value).toBeNull()
    expect(JSON.stringify(actor)).toBe(before)
  })
  it('keeps missing equipment, invalid HP and absent team activation unresolved', () => {
    const member = createLevel60NeutralEffectRuntimeMember('agent-zhao')
    member.coreLevel = 7
    member.initialStats.hp = Number.NaN
    expect(evaluateReviewedSupportTargetCapacity32({ member }).capacities[0]!.value).toBeNull()
    const lucia = createLevel60NeutralEffectRuntimeMember('agent-lucia')
    expect(
      evaluateReviewedSupportTargetCapacity32({
        member: lucia,
        baselineReferencesByAgentId: { 'agent-lucia': { darkbreaker: true } },
      }).capacities[0]!.value,
    ).toBeNull()
  })
})
