import { expect, it } from 'vitest'
import { preservesReviewedFunctionalCapacities32 } from './reviewedFunctionalCapacity32'
import {
  evaluateReviewedPotentialFunctionalEffects32,
  evaluateReviewedBurniceAnomalyMasteryCapacity32,
} from './reviewedPotentialFunctionalEffects32'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'
import { member } from './reviewedFunctionalCapacity32.testFixture'
export function registerBurniceFunctionalCapacityTests32() {
  it('evaluates Burnice Anomaly Mastery functional capacity from initial stats and potential events with zero mutation', () => {
    const actorP0 = member('agent-burnice')
    actorP0.potential = 0
    actorP0.initialStats.anomMas = 118
    actorP0.initialStats.enerRegen = 2.8

    const actorP6 = member('agent-burnice')
    actorP6.potential = 6
    actorP6.initialStats.anomMas = 118
    actorP6.initialStats.enerRegen = 2.8

    const activePotEvent: PotentialApplicationEvent = {
      eventId: 'declared-burnice-event',
      actionFamilies: ['basic'],
      providerStateKeys: ['burnice_energy_regen_threshold_met'],
      targetStateKeys: [],
      sourceRefs: ['declared-burnice-source'],
    }

    const inputP0 = {
      member: actorP0,
      equipmentExclusions: [],
      potentialEvents: { 'agent-burnice': activePotEvent },
    }
    const beforeP0 = structuredClone(inputP0)
    const resultP0 = evaluateReviewedBurniceAnomalyMasteryCapacity32(inputP0)
    expect(resultP0.status).toBe('supported')
    expect(inputP0).toEqual(beforeP0)
    const capP0 = resultP0.capacities[0]!
    expect(capP0.value).toBe(118)
    expect(capP0.included).toEqual(['completed_initial_anomaly_mastery'])
    expect(capP0.excluded).toContain(
      'agent-burnice:potential_energy_regen_to_anomaly_mastery:Potential image is level 0; this source effect is disabled.',
    )

    const inputP6 = {
      member: actorP6,
      equipmentExclusions: [],
      potentialEvents: { 'agent-burnice': activePotEvent },
    }
    const beforeP6 = structuredClone(inputP6)
    const resultP6 = evaluateReviewedBurniceAnomalyMasteryCapacity32(inputP6)
    expect(resultP6.status).toBe('supported')
    expect(inputP6).toEqual(beforeP6)
    const capP6 = resultP6.capacities[0]!
    expect(capP6.value).toBe(143)
    expect(capP6.included).toContain('agent-burnice:potential_energy_regen_to_anomaly_mastery')
    expect(capP6.sourceRefs.some((r) => r.includes('Burnice'))).toBe(true)
    expect(capP6.excluded).toContain('enemy_anomaly_resistance_and_buildup_threshold')
    expect(capP6.excluded).toContain('anomaly_buildup_frequency_and_damage_cycle')

    const dispatchResult = evaluateReviewedPotentialFunctionalEffects32(inputP6)
    expect(dispatchResult.status).toBe('supported')
    expect(dispatchResult.capacities[0]!.value).toBe(143)

    // Potential level changes actor identity in contextKey, rejecting cross-potential pairing
    expect(preservesReviewedFunctionalCapacities32(resultP0.capacities, resultP6.capacities)).toBe(
      false,
    )
    // Within the same P6 actor, unobserved state baseline (null) vs active candidate (143) rejects preservation
    const baselineNoStateP6 = evaluateReviewedBurniceAnomalyMasteryCapacity32({
      ...inputP6,
      potentialEvents: {},
    })
    expect(baselineNoStateP6.capacities[0]!.value).toBeNull()
    expect(baselineNoStateP6.blockers).toContain('burnice_potential_event_missing')
    expect(
      preservesReviewedFunctionalCapacities32(baselineNoStateP6.capacities, resultP6.capacities),
    ).toBe(false)
    expect(
      preservesReviewedFunctionalCapacities32(resultP6.capacities, baselineNoStateP6.capacities),
    ).toBe(false)
    expect(preservesReviewedFunctionalCapacities32(resultP6.capacities, resultP6.capacities)).toBe(
      true,
    )

    // Gear operands must not become context identity: compare completed AM
    // under the same actor and event while accepting gains and rejecting losses.
    const changedGear = structuredClone(inputP6)
    changedGear.member.initialStats.anomMas = 130
    changedGear.member.initialStats.enerRegen = 2.3
    const improved = evaluateReviewedBurniceAnomalyMasteryCapacity32(changedGear)
    expect(improved.capacities[0]!.value).toBe(142.5)
    expect(improved.capacities[0]!.contextKey).toBe(capP6.contextKey)
    expect(preservesReviewedFunctionalCapacities32(resultP6.capacities, improved.capacities)).toBe(
      false,
    )
    changedGear.member.initialStats.anomMas = 140
    const stronger = evaluateReviewedBurniceAnomalyMasteryCapacity32(changedGear)
    expect(stronger.capacities[0]!.value).toBe(152.5)
    expect(preservesReviewedFunctionalCapacities32(resultP6.capacities, stronger.capacities)).toBe(
      true,
    )
    expect(
      capP6.sourceRefs.some((ref) => ref.includes('formula/src/data/char/sheets/Burnice.ts')),
    ).toBe(false)
  })

  it('verifies Burnice below 1.8 threshold, cap at 25, untrusted provenance, and illegal boundary guards', () => {
    const actor = member('agent-burnice')
    actor.potential = 6
    actor.initialStats.anomMas = 118

    const potEvent: PotentialApplicationEvent = {
      eventId: 'declared-burnice-event',
      actionFamilies: ['basic'],
      providerStateKeys: ['burnice_energy_regen_threshold_met'],
      targetStateKeys: [],
      sourceRefs: ['declared-burnice-source'],
    }

    actor.initialStats.enerRegen = 1.7
    const belowResult = evaluateReviewedBurniceAnomalyMasteryCapacity32({
      member: actor,
      equipmentExclusions: [],
      potentialEvents: { 'agent-burnice': potEvent },
    })
    expect(belowResult.capacities[0]!.value).toBe(118)
    expect(belowResult.capacities[0]!.excluded).toContain(
      'agent-burnice:potential_energy_regen_to_anomaly_mastery:Initial stat does not reach the source conversion threshold.',
    )

    actor.initialStats.enerRegen = 3.5
    const capResult = evaluateReviewedBurniceAnomalyMasteryCapacity32({
      member: actor,
      equipmentExclusions: [],
      potentialEvents: { 'agent-burnice': potEvent },
    })
    expect(capResult.capacities[0]!.value).toBe(143)

    actor.potential = 2
    actor.initialStats.enerRegen = 2.3
    const p2Result = evaluateReviewedBurniceAnomalyMasteryCapacity32({
      member: actor,
      equipmentExclusions: [],
      potentialEvents: { 'agent-burnice': potEvent },
    })
    expect(p2Result.capacities[0]!.value).toBe(123)

    actor.potential = 6
    actor.initialStats.enerRegen = 2.8
    const nontrustedResult = evaluateReviewedBurniceAnomalyMasteryCapacity32({
      member: actor,
      equipmentExclusions: [],
      potentialEvents: { 'agent-burnice': potEvent },
      initialStatsProvenance: 'synthetic_fixture',
    })
    expect(nontrustedResult.capacities[0]!.value).toBeNull()
    expect(nontrustedResult.blockers).toContain(
      'agent-burnice:potential_energy_regen_to_anomaly_mastery:Initial-stat conversion lacks account or CalculationContext provenance.',
    )
    expect(nontrustedResult.capacities[0]!.excluded).toContain(
      'agent-burnice:potential_energy_regen_to_anomaly_mastery:Initial-stat conversion lacks account or CalculationContext provenance.',
    )

    for (const mutate of [
      (m: typeof actor) => {
        m.potential = -1
      },
      (m: typeof actor) => {
        m.potential = 7
      },
      (m: typeof actor) => {
        m.potential = 2.5
      },
      (m: typeof actor) => {
        m.coreLevel = 0
      },
      (m: typeof actor) => {
        m.coreLevel = 8
      },
      (m: typeof actor) => {
        m.initialStats.enerRegen = -1
      },
      (m: typeof actor) => {
        m.initialStats.anomMas = Number.NaN
      },
    ]) {
      const invalidActor = structuredClone(actor)
      mutate(invalidActor)
      const res = evaluateReviewedBurniceAnomalyMasteryCapacity32({
        member: invalidActor,
        equipmentExclusions: [],
      })
      expect(res.status).toBe('unsupported')
      expect(res.blockers.length).toBeGreaterThan(0)
    }

    const otherMember = member('agent-dialyn')
    const otherResult = evaluateReviewedPotentialFunctionalEffects32({
      member: otherMember,
      equipmentExclusions: [],
    })
    expect(otherResult.status).toBe('supported')
    expect(otherResult.capacities).toHaveLength(0)
  })

  it('guards Burnice against other member events, mismatched eventIds, and foreign provider threshold states', () => {
    const actor = member('agent-burnice')
    actor.potential = 6
    actor.initialStats.anomMas = 118
    actor.initialStats.enerRegen = 2.8

    // 1. Foreign member's event key does not activate Burnice
    const ellenEvent: PotentialApplicationEvent = {
      eventId: 'ellen.dash',
      actionFamilies: [],
      targetStateKeys: [],
      providerStateKeys: ['burnice_energy_regen_threshold_met'],
      sourceRefs: ['declared-ellen-source'],
    }
    const foreignInput = {
      member: actor,
      equipmentExclusions: [],
      potentialEvents: { 'agent-ellen:potential': ellenEvent },
    }
    const foreignBefore = structuredClone(foreignInput)
    const foreignResult = evaluateReviewedBurniceAnomalyMasteryCapacity32(foreignInput)
    expect(foreignInput).toEqual(foreignBefore)
    expect(foreignResult.capacities[0]!.value).toBeNull()
    expect(foreignResult.blockers).toContain('burnice_potential_event_missing')
    expect(foreignResult.capacities[0]!.excluded).toContain('burnice_potential_event_missing')

    // 2. Foreign declared owner mismatch on Burnice key
    const foreignOwnerInput = {
      member: actor,
      equipmentExclusions: [],
      potentialEvents: {
        'agent-burnice:potential': {
          ...ellenEvent,
          ownerAgentId: 'agent-ellen',
        } as PotentialApplicationEvent,
      },
    }
    const foreignOwnerBefore = structuredClone(foreignOwnerInput)
    const foreignOwnerResult = evaluateReviewedBurniceAnomalyMasteryCapacity32(foreignOwnerInput)
    expect(foreignOwnerInput).toEqual(foreignOwnerBefore)
    expect(foreignOwnerResult.capacities[0]!.value).toBeNull()
    expect(foreignOwnerResult.blockers).toContain(
      'burnice_potential_event_owner_mismatch:agent-ellen',
    )

    // 3. EventId mismatch against eventUsages blocks Burnice and records diagnosis
    const mismatchedEvent: PotentialApplicationEvent = {
      eventId: 'burnice.special_wrong',
      actionFamilies: [],
      targetStateKeys: [],
      providerStateKeys: ['burnice_energy_regen_threshold_met'],
      sourceRefs: ['declared-burnice-source'],
    }
    const mismatchInput = {
      member: actor,
      equipmentExclusions: [],
      eventUsages: [
        {
          ownerAgentId: 'agent-burnice',
          eventId: 'burnice.basic',
          skillLevel: 1,
          occurrenceCount: 1,
          evidenceRefs: ['declared-burnice-event'],
        },
      ],
      potentialEvents: { 'agent-burnice:potential': mismatchedEvent },
    }
    const mismatchBefore = structuredClone(mismatchInput)
    const mismatchResult = evaluateReviewedBurniceAnomalyMasteryCapacity32(mismatchInput)
    expect(mismatchInput).toEqual(mismatchBefore)
    expect(mismatchResult.capacities[0]!.value).toBeNull()
    expect(mismatchResult.blockers).toContain(
      'burnice_potential_event_id_mismatch:burnice.special_wrong',
    )
    expect(mismatchResult.capacities[0]!.excluded).toContain(
      'burnice_potential_event_id_mismatch:burnice.special_wrong',
    )

    // 4. Other provider's threshold state without burnice state does not activate Burnice
    const foreignStateEvent: PotentialApplicationEvent = {
      eventId: 'burnice.basic',
      actionFamilies: [],
      targetStateKeys: [],
      providerStateKeys: ['lycaon_encircle_prey', 'provider_non_active'],
      sourceRefs: ['declared-burnice-source'],
    }
    const foreignStateInput = {
      member: actor,
      equipmentExclusions: [],
      potentialEvents: { 'agent-burnice': foreignStateEvent },
    }
    const foreignStateBefore = structuredClone(foreignStateInput)
    const foreignStateResult = evaluateReviewedBurniceAnomalyMasteryCapacity32(foreignStateInput)
    expect(foreignStateInput).toEqual(foreignStateBefore)
    expect(foreignStateResult.capacities[0]!.value).toBeNull()
    expect(foreignStateResult.blockers).toContain(
      'agent-burnice:potential_energy_regen_to_anomaly_mastery:Missing required provider state evidence.',
    )
    expect(foreignStateResult.capacities[0]!.excluded).toContain(
      'agent-burnice:potential_energy_regen_to_anomaly_mastery:Missing required provider state evidence.',
    )

    // 5. Missing eventId or empty event does not activate Burnice
    const emptyEventInput = {
      member: actor,
      equipmentExclusions: [],
      potentialEvents: {
        'agent-burnice': {
          eventId: '',
          actionFamilies: [],
          targetStateKeys: [],
          providerStateKeys: ['burnice_energy_regen_threshold_met'],
          sourceRefs: ['declared-burnice-source'],
        },
      },
    }
    const emptyResult = evaluateReviewedBurniceAnomalyMasteryCapacity32(emptyEventInput)
    expect(emptyResult.capacities[0]!.value).toBeNull()
    expect(emptyResult.blockers).toContain('burnice_potential_event_id_empty')
  })
}
