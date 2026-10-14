import { expect, it } from 'vitest'
import { evaluateSourceDazeCapacity32 } from './sourceDazeCapacity32'
import { member } from './reviewedFunctionalCapacity32.testFixture'
export function registerSourceDazeGuardTests32() {
  it('guards Lycaon source daze against missing sourceRefs and conflicting eventIds without inventing declared-potential-event', () => {
    const actor = member('agent-lycaon')
    actor.potential = 6
    const lycaonUsage = {
      ownerAgentId: 'agent-lycaon',
      eventId: 'basic.BasicAttackMoonHunter.hit-0',
      skillLevel: 1,
      occurrenceCount: 1,
      evidenceRefs: ['test:basic'],
    }
    const baseline = evaluateSourceDazeCapacity32({
      member: actor,
      equipmentExclusions: [],
      eventUsages: [lycaonUsage],
    })
    const baseValue = baseline.capacities[0]!.value

    // 1. Missing sourceRefs: must NOT invent declared-potential-event, excludes potential and keeps baseline value
    const missingRefsInput = {
      member: actor,
      equipmentExclusions: [],
      eventUsages: [lycaonUsage],
      potentialEvents: {
        'agent-lycaon:potential': {
          eventId: 'basic.BasicAttackMoonHunter.hit-0',
          actionFamilies: ['basic'],
          targetStateKeys: [],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          sourceRefs: [],
        },
      },
    }
    const missingRefsBefore = structuredClone(missingRefsInput)
    const missingRefsResult = evaluateSourceDazeCapacity32(missingRefsInput)
    expect(missingRefsInput).toEqual(missingRefsBefore)
    expect(missingRefsResult.capacities[0]!.value).toBe(baseValue)
    expect(missingRefsResult.capacities[0]!.excluded).toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze:Missing source-backed event evidence.',
    )
    expect(missingRefsResult.capacities[0]!.sourceRefs).not.toContain('declared-potential-event')

    // 2. Conflicting eventId: declared dodge.counter vs usage basic.BasicAttackMoonHunter.hit-0 -> excluded and keeps baseline
    const conflictEventInput = {
      member: actor,
      equipmentExclusions: [],
      eventUsages: [lycaonUsage],
      potentialEvents: {
        'agent-lycaon:potential': {
          eventId: 'dodge.counter',
          actionFamilies: ['dodge_counter'],
          targetStateKeys: [],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          sourceRefs: ['declared-lycaon-source'],
        },
      },
    }
    const conflictBefore = structuredClone(conflictEventInput)
    const conflictResult = evaluateSourceDazeCapacity32(conflictEventInput)
    expect(conflictEventInput).toEqual(conflictBefore)
    expect(conflictResult.capacities[0]!.value).toBe(baseValue)
    expect(conflictResult.capacities[0]!.excluded).toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze:EventId conflict: declared dodge.counter does not match usage basic.BasicAttackMoonHunter.hit-0',
    )

    // 3. Other member event key does not activate Lycaon
    const foreignMemberInput = {
      member: actor,
      equipmentExclusions: [],
      eventUsages: [lycaonUsage],
      potentialEvents: {
        'agent-ellen:potential': {
          eventId: 'basic.BasicAttackMoonHunter.hit-0',
          actionFamilies: ['basic'],
          targetStateKeys: [],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          sourceRefs: ['declared-lycaon-source'],
        },
      },
    }
    const foreignMemberResult = evaluateSourceDazeCapacity32(foreignMemberInput)
    expect(foreignMemberResult.capacities[0]!.value).toBe(baseValue)
    expect(foreignMemberResult.capacities[0]!.excluded).toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze:Missing source-backed event evidence.',
    )
  })
}
