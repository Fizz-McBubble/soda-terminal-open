import { afterEach, describe, expect, it, vi } from 'vitest'
import * as contracts from './currentAgentDecisionMechanicContracts'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { evaluateReviewedDialynInitialImpact32 } from './reviewedFunctionalInitialImpact32'
import {
  evaluateReviewedFunctionalCapacity32,
  preservesReviewedFunctionalCapacities32,
} from './reviewedFunctionalCapacity32'
import { evaluateSourceDazeCapacity32 } from './sourceDazeCapacity32'
import {
  evaluateReviewedPotentialFunctionalEffects32,
  evaluateReviewedBurniceAnomalyMasteryCapacity32,
} from './reviewedPotentialFunctionalEffects32'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'
import { resolvePlanningEffectGraph32 } from './currentPlanningEffectGraph32'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import { projectNormalizedAccountFinalStatsDetailed } from '../decision/normalizedAccountFinalStats'
import { statWeightCalibrationFixture } from '../decision/developmentStatWeights.calibrationFixture'
import { compileCurrentWEnginePersonalPlanningEffects } from './currentWEnginePersonalPlanningEffects'
import { projectTargetTeamWEngineModifiers } from './targetTeamEquipmentModifierProjection'
import { functionalEffectMetadata32 } from './reviewedFunctionalEquipmentDependencies32'

afterEach(() => vi.restoreAllMocks())

function member(agentId: string) {
  const value = createLevel60NeutralEffectRuntimeMember(agentId)
  value.coreLevel = 7
  value.potential = 0
  value.initialStats = { ...value.initialStats, atk: 3000, impact: 100, crit_: 0.6 }
  value.finalStats = { ...value.initialStats, atk: 9000 }
  return value
}
const eventUsages = [
  {
    ownerAgentId: 'agent-dialyn',
    eventId: 'basic.BasicAttackHappyToBeOfService.hit-0',
    skillLevel: 12,
    occurrenceCount: 2,
    evidenceRefs: ['synthetic:declared-source-event-twice'],
  },
]
function evaluate(actor: ReturnType<typeof member>, equipmentExclusions: readonly unknown[] = []) {
  const result = evaluateReviewedFunctionalCapacity32({
    member: actor,
    eventUsages,
    equipmentExclusions,
  })
  if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
  return result.capacities
}
function projectedDialyn() {
  const f = statWeightCalibrationFixture('agent-billy')
  const agent = {
    ...f.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!,
    agentId: 'agent-dialyn',
  }
  const discs = structuredClone(f.discs)
  const first = discs[0]
  const crit = first.subStats.find((row) => row.stat === 'crit_rate')!
  const pen = first.subStats.find((row) => row.stat === 'pen')!
  crit.value = 14.4
  crit.upgrades = 5
  pen.value = 9
  pen.upgrades = 0
  const result = projectNormalizedAccountFinalStatsDetailed({
    agent,
    engineId: agent.wEngineDetails!.id!,
    discs,
  })
  if (result.status !== 'supported') throw new Error(result.reasons.join(';'))
  const actor = {
    ...member('agent-dialyn'),
    initialStats: result.stats.initialStats,
    finalStats: result.stats.finalStats,
  }
  return { agent, discs, actor, stats: result.stats }
}

describe('source generation capacity and event daze basis consumed as functional constraints', () => {
  it.each([
    [1, 0.3],
    [2, 0.38],
    [3, 0.46],
    [4, 0.52],
    [5, 0.6],
  ])('projects actual matching Tusks P%s through both shield consumers', (refinement, bonus) => {
    for (const agentId of ['agent-seth', 'agent-caesar']) {
      const f = statWeightCalibrationFixture('agent-billy')
      const sourceActor = f.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!
      const actor = {
        ...sourceActor,
        agentId,
        wEngineDetails: { ...sourceActor.wEngineDetails!, id: 'wengine-14107', refinement },
      }
      const projection = projectNormalizedAccountFinalStatsDetailed({
        agent: actor,
        engineId: 'wengine-14107',
        discs: f.discs,
      })
      if (projection.status !== 'supported') throw new Error(projection.reasons.join(';'))
      const runtimeMember = {
        ...member(agentId),
        initialStats: projection.stats.initialStats,
        finalStats: projection.stats.finalStats,
      }
      const gear = compileCurrentWEnginePersonalPlanningEffects({
        agentId,
        engineId: 'wengine-14107',
        refinement,
        member: runtimeMember,
      })
      expect(gear.status).toBe('supported')
      expect(gear.buckets).toContainEqual(
        expect.objectContaining({
          application: 'shield_percent',
          value: bonus,
          recipientAgentIds: [agentId],
        }),
      )
      // The unrelated unobserved team damage/daze triggers stay in direct coverage.
      expect(gear.exclusions.length).toBeGreaterThan(0)
      const capacity = evaluateReviewedFunctionalCapacity32({
        member: runtimeMember,
        equipmentModifierBuckets: gear.buckets,
        equipmentExclusions: gear.exclusions,
      }).capacities[0]!
      const expectedCore =
        agentId === 'agent-seth'
          ? Math.min(3000, projection.stats.initialStats.atk * 0.8)
          : projection.stats.initialStats.impact * 14 + 1400
      expect(capacity.value).toBeCloseTo(expectedCore * (1 + bonus), 9)
      expect(capacity.included).toContain(gear.buckets[0]!.effectKey)
      expect(capacity.sourceRefs.some((ref) => ref.includes('TusksOfFury.ts'))).toBe(true)
    }
  })

  it('isolates real team unknown writes and refuses relevant Steam Oven impact observations', () => {
    const members = [member('agent-seth'), member('agent-caesar'), member('agent-dialyn')]
    const gear = projectTargetTeamWEngineModifiers({
      memberIds: ['agent-seth', 'agent-caesar', 'agent-dialyn'],
      members,
      parameters: {
        wEngines: [
          { agentId: 'agent-seth', engineId: 'wengine-14107', refinement: 1 },
          { agentId: 'agent-caesar', engineId: 'wengine-14107', refinement: 5 },
          { agentId: 'agent-dialyn', engineId: 'wengine-13005', refinement: 1 },
        ],
      },
    })
    expect(gear.directRuntime.status).toBe('supported')
    for (const actor of members.slice(0, 2)) {
      const result = evaluateReviewedFunctionalCapacity32({
        member: actor,
        members,
        equipmentModifierBuckets: gear.directRuntime.buckets,
        equipmentExclusions: gear.directRuntime.exclusions,
      })
      expect(result.capacities[0]!.value).toBeGreaterThan(0)
    }
    const dialyn = evaluateReviewedFunctionalCapacity32({
      member: members[2]!,
      members,
      eventUsages,
      equipmentModifierBuckets: gear.directRuntime.buckets,
      equipmentExclusions: gear.directRuntime.exclusions,
    })
    expect(dialyn.capacities[0]!.value).toBeNull()
    expect(dialyn.blockers).toContain('functional_equipment_effect_unresolved')
  })

  it('does not lock mutable equipment identity and isolates a shield modifier by recipient and action', () => {
    const actor = member('agent-caesar'),
      baseline = evaluate(actor)
    const template: SourceBackedPlanningEffectBucket = {
      bucketId: 'finite-shield-bonus',
      effectKey: 'finite-shield-bonus',
      providerAgentId: actor.agentId,
      recipientAgentIds: [actor.agentId],
      receiverPath: null,
      damageType: null,
      action: null,
      attribute: null,
      application: 'shield_percent',
      value: 0.3,
      sourceRefs: ['declared-source:test'],
    }
    const capacity = (bucket: SourceBackedPlanningEffectBucket) =>
      evaluateReviewedFunctionalCapacity32({
        member: actor,
        equipmentExclusions: [],
        equipmentModifierBuckets: [bucket],
      }).capacities
    const better = capacity(template)
    expect(better[0]!.contextKey).toBe(baseline[0]!.contextKey)
    expect(preservesReviewedFunctionalCapacities32(baseline, better)).toBe(true)
    expect(capacity({ ...template, action: 'ex_special' })[0]!.value).toBe(baseline[0]!.value)
    expect(capacity({ ...template, recipientAgentIds: ['agent-seth'] })[0]!.value).toBe(
      baseline[0]!.value,
    )
    const inactive = {
      reason: 'static_condition_not_met',
      sourceRefs: ['locked:test'],
      resolvedInactive: true,
    }
    expect(evaluate(actor, [inactive])[0]!.value).toBe(baseline[0]!.value)
    const unknown = {
      sourceRefs: ['locked:test'],
      ...functionalEffectMetadata32('own.combat.shield_', actor.agentId, [actor.agentId]),
    }
    expect(evaluate(actor, [unknown])[0]!.value).toBeNull()
    expect(evaluate(actor, [{ ...unknown, recipientAgentIds: null }])[0]!.value).toBeNull()
    expect(evaluate(actor, [{ ...unknown, action: 'ex_special' }])[0]!.value).toBe(
      baseline[0]!.value,
    )
  })
  it.each([
    [1, 0.4, 3, 200],
    [2, 0.5, 5, 400],
    [3, 0.6, 7, 700],
    [4, 0.68, 9, 900],
    [5, 0.72, 11, 1100],
    [6, 0.76, 13, 1300],
    [7, 0.8, 14, 1400],
  ])(
    'core %s shield amounts independently use initial ATK/impact',
    (core, ratio, impactRatio, flat) => {
      const seth = member('agent-seth'),
        caesar = member('agent-caesar')
      seth.coreLevel = core
      caesar.coreLevel = core
      caesar.finalStats.impact = 500
      expect(evaluate(seth)[0].value).toBeCloseTo(Math.min(3000, 3000 * ratio), 10)
      expect(evaluate(caesar)[0].value).toBe(100 * impactRatio + flat)
      expect(evaluate(seth)[0].excluded).toContain('current_shield_and_holder')
      expect(evaluate(caesar)[0].excluded).toContain('shield_to_damage_conversion')
    },
  )

  it('Seth M1 scales amount and cap, without pricing current shield or team AP', () => {
    const actor = member('agent-seth')
    actor.mindscape = 1
    expect(evaluate(actor)[0].value).toBeCloseTo(3000 * 0.8 * 1.3, 10)
    actor.initialStats.atk = 6000
    expect(evaluate(actor)[0].value).toBe(3900)
    actor.finalStats.atk = 20000
    expect(evaluate(actor)[0].value).toBe(3900)
  })

  it.each([
    [1, 1.4],
    [2, 1.5],
    [3, 1.6],
    [4, 1.7],
    [5, 1.8],
    [6, 1.9],
    [7, 2],
  ])('Dialyn core %s uses the reviewed initial CR expression', (coreLevel, coefficient) => {
    const result = evaluateReviewedDialynInitialImpact32({
      initialCritRate: 0.6,
      coreLevel,
      potential: 0,
    })
    if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
    expect(result.impactIncrease).toBeCloseTo((0.6 - 0.5) * coefficient * 100, 10)
  })

  it('same declared source events consume converted impact once before unobserved enemy factors', () => {
    const actor = member('agent-dialyn')
    const before = structuredClone(actor)
    const unprojected = evaluate(actor)[0]
    // Independent source StunRatio .194 + .009*(skill12-1), twice; initial CR .6 adds 20 impact.
    expect(unprojected.value).toBeCloseTo(120 * (0.194 + 0.009 * 11) * 2, 10)
    const trace = evaluateReviewedDialynInitialImpact32({
      initialCritRate: 0.6,
      coreLevel: 7,
      potential: 0,
    })
    if (trace.status !== 'supported') throw new Error(trace.blockers.join(';'))
    const already = {
      ...actor,
      finalStats: { ...actor.finalStats, impact: 120, initialImpactConversion32: trace },
    }
    expect(evaluate(already)[0].value).toBeCloseTo(unprojected.value!, 10)
    already.finalStats.crit_ = 1.6 // Combat CR never re-enters the initial conversion.
    expect(evaluate(already)[0].value).toBeCloseTo(unprojected.value!, 10)
    expect(unprojected.excluded).toContain('enemy_daze_resistance_and_taken_factors')
    expect(actor).toEqual(before)
  })

  it('real six-disc projection retains initial impact and applies CR conversion only to final impact', () => {
    const f = projectedDialyn()
    const expected = Math.min(100, Math.max(0, f.stats.initialStats.crit_ - 0.5) * 200)
    expect(f.stats.finalStats.impact - f.stats.initialStats.impact).toBeCloseTo(expected, 10)
    expect(f.stats.finalStats.initialImpactConversion32?.impactIncrease).toBeCloseTo(expected, 10)
    const result = evaluate(f.actor)[0]
    expect(result.value).toBeCloseTo(f.stats.finalStats.impact * (0.194 + 0.009 * 11) * 2, 10)
    const after = projectNormalizedAccountFinalStatsDetailed({
      agent: f.agent,
      engineId: f.agent.wEngineDetails!.id!,
      discs: f.discs,
      statProbe: { stat: 'crit_rate', value: 2.4 },
    })
    if (after.status !== 'supported') throw new Error(after.reasons.join(';'))
    const nextExpected = Math.min(100, Math.max(0, after.stats.initialStats.crit_ - 0.5) * 200)
    expect(after.stats.finalStats.impact - f.stats.finalStats.impact).toBeCloseTo(
      nextExpected - expected,
      10,
    )
  })

  it('typed combat impact percentage uses the initial impact base, without rescaling core flat conversion', () => {
    const actor = member('agent-dialyn')
    const bucket: SourceBackedPlanningEffectBucket = {
      bucketId: 'synthetic:known-impact-percent',
      effectKey: 'synthetic:known-impact-percent',
      providerAgentId: actor.agentId,
      recipientAgentIds: [actor.agentId],
      application: 'impact_percent',
      receiverPath: null,
      action: null,
      attribute: null,
      damageType: null,
      value: 0.1,
      sourceRefs: ['synthetic:explicit-known-impact-percent'],
    }
    const result = evaluateReviewedFunctionalCapacity32({
      member: actor,
      eventUsages,
      equipmentModifierBuckets: [bucket],
      equipmentExclusions: [],
    })
    if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
    expect(result.capacities[0].value).toBeCloseTo(
      (100 + 20 + 100 * 0.1) * (0.194 + 0.009 * 11) * 2,
      10,
    )
  })

  it('missing coverage, unknown equipment and missing events remain null and cannot cancel', () => {
    const actor = member('agent-seth')
    const unknown = evaluate(actor, [{ stat: 'shield_', reason: 'unobserved' }])
    expect(unknown[0].value).toBeNull()
    expect(preservesReviewedFunctionalCapacities32(unknown, unknown)).toBe(false)
    const absent = evaluateReviewedFunctionalCapacity32({ member: actor })
    expect(absent.capacities[0].value).toBeNull()
    const noEvents = evaluateReviewedFunctionalCapacity32({
      member: member('agent-dialyn'),
      equipmentExclusions: [],
    })
    expect(noEvents.capacities[0].value).toBeNull()
  })

  it('capacity comparison rejects losses and changed identities, and admits same-action improvement', () => {
    const actor = member('agent-caesar'),
      before = evaluate(actor)
    const better = structuredClone(actor)
    better.initialStats.impact += 10
    expect(preservesReviewedFunctionalCapacities32(before, evaluate(better))).toBe(true)
    const worse = structuredClone(actor)
    worse.initialStats.impact -= 10
    expect(preservesReviewedFunctionalCapacities32(before, evaluate(worse))).toBe(false)
    const otherCore = structuredClone(actor)
    otherCore.coreLevel = 6
    expect(preservesReviewedFunctionalCapacities32(before, evaluate(otherCore))).toBe(false)
    expect(preservesReviewedFunctionalCapacities32(before, [])).toBe(false)
  })

  it('source table drift and stale initial CR/core/potential traces fail closed', () => {
    const f = projectedDialyn()
    for (const change of [
      (actor: typeof f.actor) => {
        actor.initialStats.crit_ += 0.024
      },
      (actor: typeof f.actor) => {
        actor.coreLevel = 6
      },
      (actor: typeof f.actor) => {
        actor.potential = 1
      },
    ]) {
      const actor = structuredClone(f.actor)
      change(actor)
      expect(
        resolvePlanningEffectGraph32({ members: [actor], buckets: [], nodes: [] }).status,
      ).toBe('unsupported')
    }
    const original = contracts.getCurrentAgentDecisionMechanicContract('agent-seth')!
    const drifted = structuredClone(original)
    drifted.effectContract.runtimeDefaults.references['dm.core.max_shield'] = 4000
    const read = contracts.getCurrentAgentDecisionMechanicContract
    vi.spyOn(contracts, 'getCurrentAgentDecisionMechanicContract').mockImplementation((id) =>
      id === 'agent-seth' ? drifted : read(id),
    )
    expect(
      evaluateReviewedFunctionalCapacity32({
        member: member('agent-seth'),
        equipmentExclusions: [],
      }).status,
    ).toBe('unsupported')
  })

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
})
