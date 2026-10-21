import { describe, expect, it } from 'vitest'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import {
  evaluateReviewedPreparedAnomalyObjective32,
  reviewedPreparedAnomalyObjectiveHash32,
  reviewedPreparedAnomalyPreparation32,
} from './reviewedPreparedAnomalyObjective32'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import { currentAgentEventContracts } from './currentAgentMechanicContracts'
import type { PreparedYanagiPolarity32 } from './reviewedPreparedPolarityObjective32'
import { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from '../decision/developmentPreparedAnomalyBenchmark32'

const baseline = {
  ...currentNormalizedPlanningBaseline,
  enemy: {
    id: 'independent-neutral-fixture',
    defense: 0,
    resistance: 0,
    stunMultiplier: 1,
    vulnerability: 0,
  },
}
function member(id = 'agent-piper') {
  const row = createLevel60NeutralEffectRuntimeMember(id)
  row.coreLevel = 7
  row.finalStats = {
    ...row.finalStats,
    atk: 3000,
    anomProf: 300,
    anomMas: 200,
    damageBonus: 0,
    pen_: 0,
  }
  row.initialStats = { ...row.finalStats, atk: 2000 }
  return row
}
function bucket(stat: string, value: number): SourceBackedPlanningEffectBucket {
  return {
    bucketId: stat,
    effectKey: `fixture:${stat}`,
    providerAgentId: 'agent-piper',
    recipientAgentIds: ['agent-piper'],
    receiverPath: `ownBuff.${stat}`,
    damageType: null,
    action: null,
    attribute: null,
    value,
    application: 'outside_direct_event_formula',
    sourceRefs: ['independent-declared-fixture'],
  }
}
function value(id = 'agent-piper') {
  const result = evaluateReviewedPreparedAnomalyObjective32({ member: member(id), baseline })
  expect(result.status).toBe('supported')
  if (result.status !== 'supported') throw new Error(result.blockers.join(','))
  return result
}

function polarityFixture(ownerId = 'agent-alice') {
  const actor = member('agent-yanagi')
  actor.skillLevels = { ...actor.skillLevels, special: 12 }
  const original = ownerId === actor.agentId ? actor : member(ownerId)
  original.finalStats.atk = 2000
  original.initialStats.atk = 2000
  if (original !== actor) original.finalStats.anomProf = 400
  const preparation: PreparedYanagiPolarity32 = {
    kind: 'yanagi_ex_single_polarity',
    acceptedSingleOwnerOriginalAnomaly: true,
    snapshotBasis: 'current_declared_panels',
    originalOwnerAgentId: ownerId,
    applicationAtSeconds: 0,
    triggerAtSeconds: 2.5,
    activeUntilSeconds: 20,
    endedAtSeconds: null,
    sourceRefs: ['independent-prepared-single-owner-state'],
  }
  return {
    member: actor,
    members:
      original === actor
        ? [actor, member('agent-astra'), member('agent-nicole')]
        : [actor, original, member('agent-astra')],
    baseline,
    preparation,
    ...(original === actor ? {} : { originalEquipment: {} }),
  }
}

describe('declared original snapshot and Yanagi EX polarity settlement', () => {
  const wind = currentAgentEventContracts.find((row) => row.identity.attribute === 'wind')!.stableId
  it.each([
    ['agent-alice', 94950],
    ['agent-burnice', 111600],
    ['agent-grace', 116100],
    ['agent-nicole', 116100],
    ['agent-ellen', 94950],
    ['agent-miyabi', 128700],
    [wind, 85200],
  ])(
    'settles one %s original using independently expanded original and Yanagi AP terms',
    (id, expected) => {
      const input = polarityFixture(String(id))
      const before = structuredClone(input)
      const result = evaluateReviewedPreparedAnomalyObjective32(input)
      expect(result.status).toBe('supported')
      if (result.status !== 'supported') throw Error(result.blockers.join(','))
      // Physical: [(2000*(4.5+2.5+7.5*.075)*.15) + (300*32)] * (400/100) * 2.
      expect(result.settlementDamage).toBeCloseTo(Number(expected), 8)
      expect(result.planningDps).toBeNull()
      expect(result.modeledDirectDamage).toBeNull()
      expect(result.formalCycleReady).toBe(false)
      expect(input).toEqual(before)
    },
  )

  it('keeps source AP ownership distinct from the original ATK and snapshot AP factors', () => {
    const atk = polarityFixture(),
      trigger = polarityFixture(),
      originalAP = polarityFixture()
    atk.members[1]!.finalStats.atk *= 2
    trigger.member.finalStats.anomProf *= 2
    originalAP.members[1]!.finalStats.anomProf *= 2
    expect(evaluateReviewedPreparedAnomalyObjective32(atk).totalDamage).toBeCloseTo(113100, 8)
    expect(evaluateReviewedPreparedAnomalyObjective32(trigger).totalDamage).toBeCloseTo(171750, 8)
    expect(evaluateReviewedPreparedAnomalyObjective32(originalAP).totalDamage).toBeCloseTo(
      189900,
      8,
    )
  })

  it('does not borrow ordinary-anomaly buff, ordinary crit or anomaly-only AP into the EX trigger', () => {
    const input = polarityFixture()
    input.members[1]!.finalStats.crit_ = 1
    input.members[1]!.finalStats.crit_dmg_ = 100
    const buff = {
      ...bucket('combat.buff_', 2),
      recipientAgentIds: ['agent-alice'],
      damageType: 'anomaly',
    }
    const ap = {
      ...bucket('combat.anomProf', 100),
      recipientAgentIds: ['agent-yanagi'],
      damageType: 'anomaly',
    }
    const result = evaluateReviewedPreparedAnomalyObjective32({
      ...input,
      effectBuckets: [buff, ap],
    })
    expect(result.totalDamage).toBeCloseTo(94950, 8)
    if (result.status === 'supported')
      expect(
        result.excluded.some((row) => row.reason === 'outside_polarity_trigger_AP_scope'),
      ).toBe(true)
    expect(
      evaluateReviewedPreparedAnomalyObjective32({
        ...input,
        effectBuckets: [{ ...buff, damageType: 'disorder', value: 0.3 }],
      }).totalDamage,
    ).toBeCloseTo(123435, 8)
  })

  it('closes the expired or explicitly ended original state without a phantom proc', () => {
    for (const changed of [{ activeUntilSeconds: 2.5 }, { endedAtSeconds: 2 }]) {
      const input = polarityFixture()
      Object.assign(input.preparation, changed)
      const result = evaluateReviewedPreparedAnomalyObjective32(input)
      expect(result.status).toBe('supported')
      expect(result.totalDamage).toBe(0)
      if (result.status === 'supported') expect(result.triggered).toBe(false)
    }
  })

  it('rejects invalid ownership, time, source identity and reserved actor overrides', () => {
    const cases = [
      { preparation: { ...polarityFixture().preparation, originalOwnerAgentId: 'agent-billy' } },
      { preparation: { ...polarityFixture().preparation, applicationAtSeconds: 3 } },
      {
        preparation: {
          ...polarityFixture().preparation,
          activeUntilSeconds: 40,
          triggerAtSeconds: 31,
        },
      },
      { sourceIdentityHash: 'obsolete' },
      { baselineReferencesByAgentId: { 'agent-yanagi': { 'own.final.anomProf': 99999 } } },
      { baselineReferencesByAgentId: { 'agent-yanagi': { anomTimePassed: 30 } } },
      { baselineReferencesByAgentId: { 'agent-yanagi': { thrusts: -1 } } },
      { baselineReferencesByAgentId: { 'agent-yanagi': { thrusts: 0.5 } } },
      { baselineReferencesByAgentId: { 'agent-yanagi': { exSpecial_used: false } } },
    ]
    for (const changed of cases)
      expect(
        evaluateReviewedPreparedAnomalyObjective32({ ...polarityFixture(), ...changed }).status,
      ).toBe('unsupported')
  })

  it('never defaults the original owner/equipment or a two-owner state into a self snapshot', () => {
    const input = polarityFixture()
    Reflect.deleteProperty(input, 'originalEquipment')
    expect(evaluateReviewedPreparedAnomalyObjective32(input).status).toBe('unsupported')
    const same = polarityFixture('agent-yanagi')
    expect(evaluateReviewedPreparedAnomalyObjective32(same).totalDamage).toBeCloseTo(87075, 8)
    expect(
      evaluateReviewedPreparedAnomalyObjective32({ ...same, originalEquipment: {} }).status,
    ).toBe('unsupported')
  })

  it('reuses the actual prepared benchmark consumer with the same source and declaration context', () => {
    const input = polarityFixture()
    const result = evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
      ...input,
      discs: [],
      wEngine: {
        engineId: 'wengine-13008',
        refinement: 1,
        runtime: { accumulators: { 'WeepingGemini:anomaly_stack': 0 } },
      },
      engineKey: 'declared-gemini-zero-stacks',
      discLoadoutKey: 'declared-panel',
      subjectKey: 'yanagi-source-fixture',
    })
    expect(result.state).toBe('supported')
    expect(result.totalDamage).toBeCloseTo(94950, 8)
    expect(result.planningDps).toBeNull()
    expect(result.dimensions.event_set).toBe('yanagi_ex_single_polarity')
    expect(result.coverage?.domain).toBe('prepared_anomaly_settlement')
  })
})
describe('prepared actual actor anomaly objective', () => {
  it('Piper once: independent 3000 * 7.13 * 3 AP * level60 2 =128340, never DPS', () => {
    const result = value()
    expect(result.settlementDamage).toBeCloseTo(128340, 8)
    expect(result.modeledDirectDamage).toBeNull()
    expect(result.planningDps).toBeNull()
    expect(result.formalCycleReady).toBe(false)
    expect(result.identity.frequency).toBeNull()
    expect(result.identity.preparation).toEqual(reviewedPreparedAnomalyPreparation32('agent-piper'))
  })
  it('AP is multiplicative and diluted by existing AP, AM never substitutes for AP', () => {
    const base = member(),
      ap = member(),
      mastery = member()
    ap.finalStats.anomProf += 30
    mastery.finalStats.anomMas += 90
    const a = evaluateReviewedPreparedAnomalyObjective32({ member: base, baseline })
    const b = evaluateReviewedPreparedAnomalyObjective32({ member: ap, baseline })
    const c = evaluateReviewedPreparedAnomalyObjective32({ member: mastery, baseline })
    expect(a.totalDamage).toBeCloseTo(128340, 8)
    expect(b.totalDamage).toBeCloseTo(141174, 8)
    expect(c.totalDamage).toBeCloseTo(128340, 8)
    expect(b.totalDamage! / a.totalDamage!).toBeCloseTo(1.1, 10)
  })
  it('combat ATK% uses initial attack, so 50% is 1000 and not 1500', () => {
    const result = evaluateReviewedPreparedAnomalyObjective32({
      member: member(),
      baseline,
      effectBuckets: [bucket('combat.atk_', 0.5)],
    })
    expect(result.totalDamage).toBeCloseTo(171120, 8) // 4000 *7.13 *3 *2.
  })
  it('consumes explicit AP and ignores explicit AM only with a named exclusion', () => {
    const result = evaluateReviewedPreparedAnomalyObjective32({
      member: member(),
      baseline,
      effectBuckets: [bucket('combat.anomProf', 60), bucket('combat.anomMas', 100)],
    })
    expect(result.totalDamage).toBeCloseTo(154008, 8)
    if (result.status === 'supported')
      expect(
        result.excluded.some((row) => row.reason === 'buildup_not_inferred_into_damage_or_AP'),
      ).toBe(true)
  })
  it('Alice polarized assault is physical 100%, never wind polarity disorder', () => {
    const result = value('agent-alice')
    expect(result.totalDamage).toBeCloseTo(128340, 8)
    expect(result.identity.preparation.kind).toBe('alice_single_polarized_assault')
    if ('motionValueMultiplier' in result) expect(result.motionValueMultiplier).toBe(1)
  })
  it('Alice team activation binds mastery conversion: (200-140)*1.6=96 AP', () => {
    const alice = member('agent-alice'),
      lucy = member('agent-lucy')
    const result = evaluateReviewedPreparedAnomalyObjective32({
      member: alice,
      members: [alice, lucy],
      baseline,
    })
    expect(result.totalDamage).toBeCloseTo(169408.8, 7) //3000*7.13*3.96*2.
  })
  it('Alice M2 uses anomaly 15% buff, M4 resistance-ignore, no periodic 2.5% leak', () => {
    const alice = member('agent-alice')
    alice.mindscape = 4
    const result = evaluateReviewedPreparedAnomalyObjective32({
      member: alice,
      baseline: { ...baseline, enemy: { ...baseline.enemy, resistance: 0.2 } },
    })
    // core arithmetic GO: resistance factor 1-.2+.1=.9; source M2 buff=1.15.
    expect(result.totalDamage).toBeCloseTo(132831.9, 7)
  })
  it('Promeia own ice abloom consumes initial mastery conversion before core7 635% settlement', () => {
    const result = value('agent-promeia')
    // InitialAM200 -> +75AP; AP300 becomes375. Buildup itself adds no damage.
    expect(result.totalDamage).toBeCloseTo(3000 * 5 * 6.35 * 3.75 * 2, 8)
    expect(result.included).toContain('agent-promeia:reviewed_initial_mastery_proficiency32')
    expect(result.sourceRefs.some((ref) => ref.includes('fact-promeia-core-levels'))).toBe(true)
  })
  it('Promeia absent base is proven zero; unknown core1/resource/preparation refuses', () => {
    const promeia = member('agent-promeia')
    expect(
      evaluateReviewedPreparedAnomalyObjective32({
        member: promeia,
        baseline,
        preparation: {
          kind: 'promeia_single_self_ice_abloom',
          acceptedSingleOwnerSettlement: true,
          trialByCold: 1,
          ownIceAnomalyPresent: false,
        },
      }).totalDamage,
    ).toBe(0)
    promeia.coreLevel = 1
    expect(evaluateReviewedPreparedAnomalyObjective32({ member: promeia, baseline }).status).toBe(
      'unsupported',
    )
    expect(
      evaluateReviewedPreparedAnomalyObjective32({
        member: member('agent-alice'),
        baseline,
        preparation: {
          kind: 'piper_single_assault',
          acceptedSingleOwnerSettlement: true,
          powerStacks: 0,
        },
      }).status,
    ).toBe('unsupported')
  })
  it('includes target defense independently with K60=794; penetration comes from actual panel', () => {
    const piper = member()
    piper.finalStats.pen_ = 0.2
    piper.finalStats.pen = 50
    const result = evaluateReviewedPreparedAnomalyObjective32({
      member: piper,
      baseline: { ...baseline, enemy: { ...baseline.enemy, defense: 700, resistance: 0.2 } },
    })
    expect(result.totalDamage).toBeCloseTo(((128340 * 794) / (794 + 700 * 0.8 - 50)) * 0.8, 8)
  })
  it('real Weeping Gemini sourced P1 2 stacks adds 60 AP; unknown stacks stay excluded', () => {
    const unknown = evaluateReviewedPreparedAnomalyObjective32({
      member: member(),
      baseline,
      wEngine: { engineId: 'wengine-13008', refinement: 1 },
    })
    expect(unknown.totalDamage).toBeCloseTo(128340, 8)
    if (unknown.status === 'supported')
      expect(
        unknown.excluded.some((row) => row.fields.some((field) => field.includes('anomaly_stack'))),
      ).toBe(true)
    const known = evaluateReviewedPreparedAnomalyObjective32({
      member: member(),
      baseline,
      wEngine: {
        engineId: 'wengine-13008',
        refinement: 1,
        runtime: { accumulators: { 'WeepingGemini:anomaly_stack': 2 } },
      },
    })
    expect(known.totalDamage).toBeCloseTo(154008, 8)
    expect(
      evaluateReviewedPreparedAnomalyObjective32({
        member: member(),
        baseline,
        wEngine: {
          engineId: 'wengine-13008',
          refinement: 1,
          runtime: { accumulators: { 'WeepingGemini:anomaly_stack': 5 } },
        },
      }).status,
    ).toBe('unsupported')
  })
  it('same-condition identity excludes changing panel but includes team, source and preparation', () => {
    const piper = member(),
      altered = member()
    altered.finalStats.anomProf += 30
    const a = evaluateReviewedPreparedAnomalyObjective32({ member: piper, baseline })
    const b = evaluateReviewedPreparedAnomalyObjective32({ member: altered, baseline })
    expect(a.status).toBe('supported')
    expect(b.status).toBe('supported')
    if (a.status === 'supported' && b.status === 'supported') {
      expect(a.contextHash).toBe(b.contextHash)
      expect(a.runtimeHash).not.toBe(b.runtimeHash)
    }
    expect(
      evaluateReviewedPreparedAnomalyObjective32({
        member: piper,
        baseline,
        sourceIdentityHash: 'old-adapter',
      }).status,
    ).toBe('unsupported')
    expect(reviewedPreparedAnomalyObjectiveHash32).not.toBe('old-adapter')
  })
  it('reads no account and leaves all caller objects unchanged, including skill and preparation', () => {
    const input = {
      member: member(),
      baseline,
      preparation: reviewedPreparedAnomalyPreparation32('agent-piper')!,
    }
    const before = structuredClone(input)
    evaluateReviewedPreparedAnomalyObjective32(input)
    expect(input).toEqual(before)
  })
  it('Aria once: core 7 ratio 0.275, 200 initial mastery, core passive 90 AP: 3000 * 0.625 * 5.5 * 3.9 * 2 = 80437.5', () => {
    const aria = member('agent-aria')
    const result = evaluateReviewedPreparedAnomalyObjective32({ member: aria, baseline })
    expect(result.status).toBe('supported')
    expect(result).toHaveProperty('triggered', true)
    if (result.status === 'supported' && result.triggered) {
      expect(result.settlementDamage).toBeCloseTo(80437.5, 8)
      expect(result.totalDamage).toBeCloseTo(80437.5, 8)
      expect(result.modeledDirectDamage).toBeNull()
      expect(result.planningDps).toBeNull()
      expect(result.formalCycleReady).toBe(false)
      expect(result.identity.preparation.kind).toBe('aria_single_self_ether_abloom')
      expect(result.motionValueMultiplier).toBeCloseTo(5.5, 8)
      expect(result.snapshot.anomalyProficiency).toBe(390)
      expect(result.included).toContain('agent-aria:reviewed_core_proficiency32')
    }
  })
  it('Aria initial anomaly mastery directly scales the core abloom motion value ratio', () => {
    const a100 = member('agent-aria')
    a100.initialStats.anomMas = 100
    const a200 = member('agent-aria')
    a200.initialStats.anomMas = 200
    const res100 = evaluateReviewedPreparedAnomalyObjective32({ member: a100, baseline })
    const res200 = evaluateReviewedPreparedAnomalyObjective32({ member: a200, baseline })
    expect(res100.status).toBe('supported')
    expect(res200.status).toBe('supported')
    expect(res100).toHaveProperty('triggered', true)
    expect(res200).toHaveProperty('triggered', true)
    if (
      res100.status === 'supported' &&
      res100.triggered &&
      res200.status === 'supported' &&
      res200.triggered
    ) {
      expect(res100.motionValueMultiplier).toBeCloseTo(2.75, 8)
      expect(res200.motionValueMultiplier).toBeCloseTo(5.5, 8)
      expect(res200.totalDamage! / res100.totalDamage!).toBeCloseTo(2.0, 8)
    }
  })
  it('Aria normal vs stun: contains source extra 50% and enemy stun 1.5 without duplication (total 2.25x)', () => {
    const aria = member('agent-aria')
    const stunBaseline = {
      ...baseline,
      enemy: { ...baseline.enemy, stunMultiplier: 1.5 },
    }
    const normal = evaluateReviewedPreparedAnomalyObjective32({
      member: aria,
      baseline,
      preparation: {
        kind: 'aria_single_self_ether_abloom',
        acceptedSingleOwnerSettlement: true,
        perfectPitchHit3Heavy: true,
        ownEtherAnomalyPresent: true,
        fandomPowerPrepared: true,
        enemyStunned: false,
      },
    })
    const stunned = evaluateReviewedPreparedAnomalyObjective32({
      member: aria,
      baseline: stunBaseline,
      preparation: {
        kind: 'aria_single_self_ether_abloom',
        acceptedSingleOwnerSettlement: true,
        perfectPitchHit3Heavy: true,
        ownEtherAnomalyPresent: true,
        fandomPowerPrepared: true,
        enemyStunned: true,
      },
    })
    expect(normal.status).toBe('supported')
    expect(stunned.status).toBe('supported')
    expect(normal).toHaveProperty('triggered', true)
    expect(stunned).toHaveProperty('triggered', true)
    if (
      normal.status === 'supported' &&
      normal.triggered &&
      stunned.status === 'supported' &&
      stunned.triggered
    ) {
      expect(normal.motionValueMultiplier).toBeCloseTo(5.5, 8)
      expect(stunned.motionValueMultiplier).toBeCloseTo(8.25, 8) // 5.5 * 1.5
      expect(normal.totalDamage).toBeCloseTo(80437.5, 8)
      expect(stunned.totalDamage).toBeCloseTo(180984.375, 8) // 80437.5 * 1.5 (source) * 1.5 (enemy)
      expect(stunned.totalDamage! / normal.totalDamage!).toBeCloseTo(2.25, 8)
    }
  })
  it('Aria M0 vs M1 vs M2: distinguishes crit activation and progressive DEF ignore with delusion', () => {
    const m0 = member('agent-aria')
    m0.mindscape = 0
    const m1 = member('agent-aria')
    m1.mindscape = 1
    const m2NoDelusion = member('agent-aria')
    m2NoDelusion.mindscape = 2
    const m2Delusion = member('agent-aria')
    m2Delusion.mindscape = 2

    const defBaseline = {
      ...baseline,
      enemy: { ...baseline.enemy, defense: 700 },
    }
    const rM0 = evaluateReviewedPreparedAnomalyObjective32({ member: m0, baseline: defBaseline })
    const rM1 = evaluateReviewedPreparedAnomalyObjective32({ member: m1, baseline: defBaseline })
    const rM2No = evaluateReviewedPreparedAnomalyObjective32({
      member: m2NoDelusion,
      baseline: defBaseline,
      preparation: {
        kind: 'aria_single_self_ether_abloom',
        acceptedSingleOwnerSettlement: true,
        perfectPitchHit3Heavy: true,
        ownEtherAnomalyPresent: true,
        fandomPowerPrepared: true,
        enemyStunned: false,
        momentOfDelusion: false,
      },
    })
    const rM2Yes = evaluateReviewedPreparedAnomalyObjective32({
      member: m2Delusion,
      baseline: defBaseline,
      preparation: {
        kind: 'aria_single_self_ether_abloom',
        acceptedSingleOwnerSettlement: true,
        perfectPitchHit3Heavy: true,
        ownEtherAnomalyPresent: true,
        fandomPowerPrepared: true,
        enemyStunned: false,
        momentOfDelusion: true,
      },
    })

    expect(rM0.status).toBe('supported')
    expect(rM1.status).toBe('supported')
    expect(rM2No.status).toBe('supported')
    expect(rM2Yes.status).toBe('supported')
    for (const result of [rM0, rM1, rM2No, rM2Yes]) expect(result).toHaveProperty('triggered', true)
    if (
      rM0.status === 'supported' &&
      rM0.triggered &&
      rM1.status === 'supported' &&
      rM1.triggered &&
      rM2No.status === 'supported' &&
      rM2No.triggered &&
      rM2Yes.status === 'supported' &&
      rM2Yes.triggered
    ) {
      // M0 has 0 anomaly crit rate and 0 DEF ignore
      expect(rM0.snapshot.anomalyCritRate).toBe(0)
      expect(rM0.snapshot.defenseIgnore).toBe(0)
      // M1 has 25% + (200-100)*0.5% = 75% crit rate, 25% crit dmg -> expected crit factor 1 + 0.75*0.25 = 1.1875
      expect(rM1.snapshot.anomalyCritRate).toBeCloseTo(0.75, 8)
      expect(rM1.snapshot.anomalyCritDamage).toBeCloseTo(0.25, 8)
      expect(rM1.totalDamage! / rM0.totalDamage!).toBeCloseTo(1.1875, 8)
      // M2 without Delusion has 16% def ignore
      expect(rM2No.snapshot.defenseIgnore).toBeCloseTo(0.16, 8)
      // M2 with Delusion has 24% def ignore
      expect(rM2Yes.snapshot.defenseIgnore).toBeCloseTo(0.24, 8)
      expect(rM2Yes.totalDamage!).toBeGreaterThan(rM2No.totalDamage!)
      expect(rM2No.totalDamage!).toBeGreaterThan(rM1.totalDamage!)
    }
  })
  it('Aria absent base yields zero; preparation/domain mismatches and foreign states reject', () => {
    const aria = member('agent-aria')
    const zero = evaluateReviewedPreparedAnomalyObjective32({
      member: aria,
      baseline,
      preparation: {
        kind: 'aria_single_self_ether_abloom',
        acceptedSingleOwnerSettlement: true,
        perfectPitchHit3Heavy: true,
        ownEtherAnomalyPresent: false,
        fandomPowerPrepared: true,
        enemyStunned: false,
      },
    })
    expect(zero.status).toBe('supported')
    expect(zero.totalDamage).toBe(0)
    expect(zero.settlementDamage).toBe(0)
    expect((zero as { triggered?: boolean }).triggered).toBe(false)

    // Stun state mismatch with baseline
    expect(
      evaluateReviewedPreparedAnomalyObjective32({
        member: aria,
        baseline,
        preparation: {
          kind: 'aria_single_self_ether_abloom',
          acceptedSingleOwnerSettlement: true,
          perfectPitchHit3Heavy: true,
          ownEtherAnomalyPresent: true,
          fandomPowerPrepared: true,
          enemyStunned: true, // baseline stunMultiplier is 1.0!
        },
      }).status,
    ).toBe('unsupported')

    // Invalid heavy hit
    expect(
      evaluateReviewedPreparedAnomalyObjective32({
        member: aria,
        baseline,
        preparation: {
          kind: 'aria_single_self_ether_abloom',
          acceptedSingleOwnerSettlement: true,
          perfectPitchHit3Heavy: false as unknown as true,
          ownEtherAnomalyPresent: true,
          fandomPowerPrepared: true,
          enemyStunned: false,
        },
      }).status,
    ).toBe('unsupported')

    // Invalid core domain
    const badCore = member('agent-aria')
    badCore.coreLevel = 0
    expect(evaluateReviewedPreparedAnomalyObjective32({ member: badCore, baseline }).status).toBe(
      'unsupported',
    )
    const badMindscape = member('agent-aria')
    badMindscape.mindscape = 7
    expect(
      evaluateReviewedPreparedAnomalyObjective32({ member: badMindscape, baseline }).status,
    ).toBe('unsupported')
  })
  it('Aria M4 and M6 effects are explicitly excluded without rotation synthesis', () => {
    const m6Aria = member('agent-aria')
    m6Aria.mindscape = 6
    const result = evaluateReviewedPreparedAnomalyObjective32({ member: m6Aria, baseline })
    expect(result.status).toBe('supported')
    if (result.status === 'supported') {
      const excludedKeys = result.excluded.map((item) => item.effectKey)
      expect(excludedKeys).toContain('agent-aria:m4_mechanical_angel')
      expect(excludedKeys).toContain('agent-aria:m6_constructs_dream')
    }
  })
  it('Aria M2 unknown Delusion is rejected; the standard comparison explicitly declares false', () => {
    const aria = member('agent-aria')
    aria.mindscape = 2
    const preparation = reviewedPreparedAnomalyPreparation32('agent-aria')!
    expect(preparation).toMatchObject({ momentOfDelusion: false })
    const unknown = { ...preparation, momentOfDelusion: undefined } as Extract<
      NonNullable<ReturnType<typeof reviewedPreparedAnomalyPreparation32>>,
      { kind: 'aria_single_self_ether_abloom' }
    >
    expect(
      evaluateReviewedPreparedAnomalyObjective32({ member: aria, baseline, preparation: unknown })
        .status,
    ).toBe('unsupported')
    expect(
      evaluateReviewedPreparedAnomalyObjective32({ member: aria, baseline, preparation }).status,
    ).toBe('supported')
  })
})
