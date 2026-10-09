import { describe, expect, it } from 'vitest'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import {
  evaluateReviewedPreparedAnomalyObjective32,
  reviewedPreparedAnomalyObjectiveHash32,
  reviewedPreparedAnomalyPreparation32,
} from './reviewedPreparedAnomalyObjective32'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'

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
  it('Promeia own ice abloom uses archived core7 635%, independent 3000*5*6.35*3*2', () => {
    const result = value('agent-promeia')
    expect(result.totalDamage).toBeCloseTo(571500, 8)
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
})
