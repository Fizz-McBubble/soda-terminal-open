import { expect, it } from 'vitest'
import {
  evaluateReviewedFunctionalCapacity32,
  preservesReviewedFunctionalCapacities32,
} from './reviewedFunctionalCapacity32'
import { evaluateSourceDazeCapacity32 } from './sourceDazeCapacity32'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'
import { member } from './reviewedFunctionalCapacity32.testFixture'
export function registerLycaonFunctionalCapacityTests32() {
  it('evaluates Lycaon potential impact consumption into source daze basis with zero input mutation', () => {
    const actorP0 = member('agent-lycaon')
    actorP0.potential = 0
    actorP0.initialStats.impact = 100
    const actorP6 = member('agent-lycaon')
    actorP6.potential = 6
    actorP6.initialStats.impact = 100

    const eventUsages = [
      {
        ownerAgentId: 'agent-lycaon',
        eventId: 'basic.BasicAttackMoonHunter.hit-0',
        skillLevel: 1,
        occurrenceCount: 1,
        evidenceRefs: ['declared-lycaon-basic'],
      },
    ]

    const activePotEvent: PotentialApplicationEvent = {
      eventId: 'basic.BasicAttackMoonHunter.hit-0',
      actionFamilies: ['basic'],
      providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
      targetStateKeys: [],
      sourceRefs: ['declared-lycaon-potential-event'],
    }

    const inputP0 = {
      member: actorP0,
      eventUsages,
      equipmentExclusions: [],
      potentialEvents: {
        'basic.BasicAttackMoonHunter.hit-0': activePotEvent,
      },
    }
    const beforeP0 = structuredClone(inputP0)
    const resultP0 = evaluateSourceDazeCapacity32(inputP0)
    expect(resultP0.status).toBe('supported')
    expect(inputP0).toEqual(beforeP0)
    const capP0 = resultP0.capacities[0]!
    expect(capP0.value).toBeCloseTo(100 * 0.146, 10)
    expect(capP0.included).not.toContain('agent-lycaon:potential_off_field_encircle_prey_daze')
    expect(capP0.excluded).toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze:Potential image is level 0; this source effect is disabled.',
    )

    const prodResultP0 = evaluateReviewedFunctionalCapacity32(inputP0)
    expect(prodResultP0.status).toBe('supported')
    expect(prodResultP0.capacities[0]!.value).toBeCloseTo(14.6, 10)

    const inputP6 = {
      member: actorP6,
      eventUsages,
      equipmentExclusions: [],
      potentialEvents: {
        'basic.BasicAttackMoonHunter.hit-0': activePotEvent,
      },
    }
    const beforeP6 = structuredClone(inputP6)
    const resultP6 = evaluateSourceDazeCapacity32(inputP6)
    expect(resultP6.status).toBe('supported')
    expect(inputP6).toEqual(beforeP6)
    const capP6 = resultP6.capacities[0]!
    expect(capP6.value).toBeCloseTo(115 * 0.146, 10)
    expect(capP6.included).toContain('agent-lycaon:potential_off_field_encircle_prey_daze')
    expect(capP6.sourceRefs.some((r) => r.includes('73045858'))).toBe(true)

    const prodResultP6 = evaluateReviewedFunctionalCapacity32(inputP6)
    expect(prodResultP6.status).toBe('supported')
    expect(prodResultP6.capacities[0]!.value).toBeCloseTo(16.79, 10)
    // Potential image level change alters actor identity in contextKey, rejecting cross-potential pairing
    expect(preservesReviewedFunctionalCapacities32(resultP0.capacities, resultP6.capacities)).toBe(
      false,
    )
    // Within the same P6 actor, unobserved state baseline (14.6) vs observed state candidate (16.79) preserves capacity
    const baselineNoStateP6 = evaluateSourceDazeCapacity32({ ...inputP6, potentialEvents: {} })
    expect(
      preservesReviewedFunctionalCapacities32(baselineNoStateP6.capacities, resultP6.capacities),
    ).toBe(true)
    expect(
      preservesReviewedFunctionalCapacities32(resultP6.capacities, baselineNoStateP6.capacities),
    ).toBe(false)
  })

  it('diagnoses and excludes Lycaon potential impact when unobserved, missing states, or outside action scope', () => {
    const actor = member('agent-lycaon')
    actor.potential = 6
    actor.initialStats.impact = 100

    const basicEvent = [
      {
        ownerAgentId: 'agent-lycaon',
        eventId: 'basic.BasicAttackMoonHunter.hit-0',
        skillLevel: 1,
        occurrenceCount: 1,
        evidenceRefs: ['declared-lycaon-basic'],
      },
    ]

    const noStateResult = evaluateSourceDazeCapacity32({
      member: actor,
      eventUsages: basicEvent,
      equipmentExclusions: [],
      potentialEvents: {
        'basic.BasicAttackMoonHunter.hit-0': {
          eventId: 'basic.BasicAttackMoonHunter.hit-0',
          actionFamilies: ['basic'],
          providerStateKeys: [],
          targetStateKeys: [],
          sourceRefs: ['declared:test'],
        },
      },
    })
    expect(noStateResult.capacities[0]!.value).toBeCloseTo(100 * 0.146, 10)
    expect(noStateResult.capacities[0]!.excluded).toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze:Missing required provider state evidence.',
    )

    const omittedResult = evaluateSourceDazeCapacity32({
      member: actor,
      eventUsages: basicEvent,
      equipmentExclusions: [],
    })
    expect(omittedResult.capacities[0]!.value).toBeCloseTo(100 * 0.146, 10)
    expect(omittedResult.capacities[0]!.excluded).toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze:Missing source-backed event evidence.',
    )

    const specialEvent = [
      {
        ownerAgentId: 'agent-lycaon',
        eventId: 'special.SpecialAttackTimeToHunt.hit-0',
        skillLevel: 1,
        occurrenceCount: 1,
        evidenceRefs: ['declared-lycaon-special'],
      },
    ]
    const specialResult = evaluateSourceDazeCapacity32({
      member: actor,
      eventUsages: specialEvent,
      equipmentExclusions: [],
      potentialEvents: {
        'special.SpecialAttackTimeToHunt.hit-0': {
          eventId: 'special.SpecialAttackTimeToHunt.hit-0',
          actionFamilies: ['special'],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          targetStateKeys: [],
          sourceRefs: ['declared:test'],
        },
      },
    })
    expect(specialResult.capacities[0]!.included).not.toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze',
    )
    expect(specialResult.capacities[0]!.excluded).toContain(
      'agent-lycaon:potential_off_field_encircle_prey_daze:Event action family is outside the source effect scope.',
    )
  })

  it.each([
    [
      1,
      0,
      'agent-lycaon:potential_off_field_encircle_prey_daze:Potential image 1 has no value for this effect.',
    ],
    [2, 0.05, null],
    [3, 0.075, null],
    [4, 0.1, null],
    [5, 0.125, null],
    [6, 0.15, null],
  ])(
    'tests Lycaon potential image level %s boundary (bonus %s)',
    (potential, bonus, expectedExclusion) => {
      const actor = member('agent-lycaon')
      actor.potential = potential
      actor.initialStats.impact = 100
      const result = evaluateSourceDazeCapacity32({
        member: actor,
        eventUsages: [
          {
            ownerAgentId: 'agent-lycaon',
            eventId: 'basic.BasicAttackMoonHunter.hit-0',
            skillLevel: 1,
            occurrenceCount: 1,
            evidenceRefs: ['test'],
          },
        ],
        equipmentExclusions: [],
        potentialEvents: {
          'basic.BasicAttackMoonHunter.hit-0': {
            eventId: 'basic.BasicAttackMoonHunter.hit-0',
            actionFamilies: ['basic'],
            providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
            targetStateKeys: [],
            sourceRefs: ['declared:test'],
          },
        },
      })
      const cap = result.capacities[0]!
      expect(cap.value).toBeCloseTo(100 * (1 + bonus) * 0.146, 10)
      if (expectedExclusion) {
        expect(cap.excluded).toContain(expectedExclusion)
      } else {
        expect(cap.included).toContain('agent-lycaon:potential_off_field_encircle_prey_daze')
      }
    },
  )

  it('prevents multiple potential impact aggregation across multiple events', () => {
    const actor = member('agent-lycaon')
    actor.potential = 6
    actor.initialStats.impact = 100
    const result = evaluateSourceDazeCapacity32({
      member: actor,
      eventUsages: [
        {
          ownerAgentId: 'agent-lycaon',
          eventId: 'basic.BasicAttackMoonHunter.hit-0',
          skillLevel: 1,
          occurrenceCount: 1,
          evidenceRefs: ['test:basic'],
        },
        {
          ownerAgentId: 'agent-lycaon',
          eventId: 'special.SpecialAttackTimeToHunt.hit-0',
          skillLevel: 1,
          occurrenceCount: 1,
          evidenceRefs: ['test:special'],
        },
      ],
      equipmentExclusions: [],
      potentialEvents: {
        'basic.BasicAttackMoonHunter.hit-0': {
          eventId: 'basic.BasicAttackMoonHunter.hit-0',
          actionFamilies: ['basic'],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          targetStateKeys: [],
          sourceRefs: ['declared:test'],
        },
        'special.SpecialAttackTimeToHunt.hit-0': {
          eventId: 'special.SpecialAttackTimeToHunt.hit-0',
          actionFamilies: ['special'],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          targetStateKeys: [],
          sourceRefs: ['declared:test'],
        },
      },
    })
    const basicOnly = evaluateSourceDazeCapacity32({
      member: actor,
      eventUsages: [
        {
          ownerAgentId: 'agent-lycaon',
          eventId: 'basic.BasicAttackMoonHunter.hit-0',
          skillLevel: 1,
          occurrenceCount: 1,
          evidenceRefs: ['test:basic'],
        },
      ],
      equipmentExclusions: [],
      potentialEvents: {
        'basic.BasicAttackMoonHunter.hit-0': {
          eventId: 'basic.BasicAttackMoonHunter.hit-0',
          actionFamilies: ['basic'],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          targetStateKeys: [],
          sourceRefs: ['declared:test'],
        },
      },
    })
    const specialOnly = evaluateSourceDazeCapacity32({
      member: actor,
      eventUsages: [
        {
          ownerAgentId: 'agent-lycaon',
          eventId: 'special.SpecialAttackTimeToHunt.hit-0',
          skillLevel: 1,
          occurrenceCount: 1,
          evidenceRefs: ['test:special'],
        },
      ],
      equipmentExclusions: [],
      potentialEvents: {
        'special.SpecialAttackTimeToHunt.hit-0': {
          eventId: 'special.SpecialAttackTimeToHunt.hit-0',
          actionFamilies: ['special'],
          providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
          targetStateKeys: [],
          sourceRefs: ['declared:test'],
        },
      },
    })
    expect(result.capacities[0]!.value).toBeCloseTo(
      basicOnly.capacities[0]!.value! + specialOnly.capacities[0]!.value!,
      10,
    )
  })
}
