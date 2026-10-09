import { afterEach, describe, expect, it, vi } from 'vitest'
import * as contracts from './currentAgentDecisionMechanicContracts'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { evaluateReviewedDialynInitialImpact32 } from './reviewedFunctionalInitialImpact32'
import {
  evaluateReviewedFunctionalCapacity32,
  preservesReviewedFunctionalCapacities32,
} from './reviewedFunctionalCapacity32'
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
})
