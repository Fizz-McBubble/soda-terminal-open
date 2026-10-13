import { describe, expect, it } from 'vitest'
import {
  reviewedTemplateMechanicEffectBlueprints32 as entries,
  isReviewedTemplateMechanicEffect32,
  validateReviewedTemplateMechanicObservations32,
  bindReviewedLuciaHarmonyFinalHit32,
} from './reviewedTemplateMechanicEffects32'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'
import { effectReceiverMetadata } from './currentPlanningEffectExpressions'
import { applicationForReceiver } from './currentPlanningDamageModifiers'
import { compileAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { compileCurrentPlanningSelfEffects32 } from './currentPlanningSelfEffects32'
import { evaluateSourceBackedPersonalPlanningDps } from './currentPlanningTeamDpsRuntime'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'

const entry = (key: string) => entries.find((row) => row.effectId === key)!
function value(key: string, refs: Record<string, unknown>, ability = true, anomaly = 3) {
  const expression = extractUpstreamEffectValueIr(entry(key).numericExpression.expressionIr)
  if (expression.status !== 'supported') throw new Error('missing source expression')
  const result = evaluateUpstreamExpressionIr(
    expression.value as UpstreamExpressionIR,
    createPlanningExpressionDomainRuntime({
      references: refs,
      gates: { ability },
      teamCounts: { specialty: { anomaly } },
    }),
  )
  return result.status === 'supported' ? result.value : null
}

describe('reviewed concrete components replacing generic skill templates', () => {
  it.each([
    ['agent-aria', 'reviewed_core_proficiency32', 'anomaly_proficiency_flat', 90],
    ['agent-promeia', 'reviewed_initial_mastery_proficiency32', 'anomaly_proficiency_flat', 120],
    ['agent-velina', 'reviewed_initial_regen_mastery32', 'anomaly_mastery_flat', 50],
  ] as const)(
    'consumes %s sourced anomaly component through real self and event runtimes',
    (agentId, effectId, application, expected) => {
      const neutral = createLevel60NeutralEffectRuntimeMember(agentId)
      const stats = { ...neutral.initialStats, anomMas: 230, enerRegen: 2.2 }
      const actor = { ...neutral, coreLevel: 7, initialStats: stats, finalStats: stats }
      const self = compileCurrentPlanningSelfEffects32({ member: actor })
      expect(self.status).toBe('supported')
      if (self.status !== 'supported') throw new Error(JSON.stringify(self))
      const bucket = self.buckets.find((row) => row.effectId === effectId)!
      if (!bucket) throw new Error(JSON.stringify(self))
      expect(bucket.application).toBe(application)
      expect(bucket.value).toBeCloseTo(expected)
      const event = getCurrentAgentEventContract(agentId)!.eventContract.events.find(
        (row) => row.skill === 'basic',
      )!
      const result = evaluateSourceBackedPersonalPlanningDps({
        member: actor,
        baseline: { ...currentNormalizedPlanningBaseline, gameVersion: '3.2' },
        eventUsages: [
          {
            ownerAgentId: agentId,
            eventId: event.eventId,
            skillLevel: 1,
            occurrenceCount: 1,
            evidenceRefs: ['explicit-runtime-test-event'],
          },
        ],
      })
      expect(result.status).toBe('supported')
      if (result.status !== 'supported') throw new Error(JSON.stringify(result))
      expect(result.effectBuckets.find((row) => row.effectId === effectId)?.value).toBeCloseTo(
        expected,
      )
      expect(Number.isFinite(result.totalDamage)).toBe(true)
    },
  )
  it('consumes Lucia FINALHP Harmony only with explicit final-hit observation in personal damage', () => {
    const neutral = createLevel60NeutralEffectRuntimeMember('agent-lucia')
    const stats = {
      ...neutral.initialStats,
      hp: 10000,
      atk: 1000,
      crit_: 0,
      crit_dmg_: 0,
      pen_: 0,
      damageBonus: 0,
    }
    const actor = {
      ...neutral,
      level: 1,
      coreLevel: 7,
      initialStats: stats,
      finalStats: stats,
      skillLevels: { ...neutral.skillLevels, special: 5 },
    }
    const finalEvent = 'special.EXSpecialAttackSymphonyOfTheReaperDaybreak.hit-0'
    const evaluate = (observed?: unknown, eventId = finalEvent) =>
      evaluateSourceBackedPersonalPlanningDps({
        member: actor,
        baseline: {
          ...currentNormalizedPlanningBaseline,
          gameVersion: '3.2',
          enemy: {
            ...currentNormalizedPlanningBaseline.enemy,
            defense: 50,
            resistance: 0,
            stunMultiplier: 1,
            vulnerability: 0,
          },
        },
        baselineReferences: {
          ...(observed === undefined ? {} : { luciaHarmonyFinalHit32: observed }),
        },
        eventUsages: [
          {
            ownerAgentId: actor.agentId,
            eventId,
            skillLevel: 5,
            occurrenceCount: 1,
            evidenceRefs: ['explicit-runtime-test-event'],
          },
        ],
      })
    const on = evaluate(true)
    const off = evaluate(false)
    expect(on.status).toBe('supported')
    expect(off.status).toBe('supported')
    if (on.status !== 'supported' || off.status !== 'supported')
      throw new Error(JSON.stringify({ on, off }))
    // UI skill Lv5 binds the source's zero-based char.special index 4.
    expect(
      on.effectBuckets.find((row) => row.effectId === 'exSpecial_harmony_dmg_')?.value,
    ).toBeCloseTo(10000 * (0.34 + 0.03 * 4))
    expect(on.totalDamage - off.totalDamage).toBeCloseTo(2300)
    expect(evaluate().status).toBe('unsupported')
    expect(evaluate(1).status).toBe('unsupported')
    const wrong = evaluate(true, 'chain.UltimateChargeGreatArmor.hit-1')
    expect(wrong.status).toBe('supported')
    if (wrong.status !== 'supported') throw new Error(JSON.stringify(wrong))
    expect(
      wrong.effectBuckets
        .filter((row) => row.effectId === 'exSpecial_harmony_dmg_')
        .every((row) => row.value === 0),
    ).toBe(true)
  })
  it('binds exact source evidence and rejects modified local expressions', () => {
    expect(new Set(entries.map((row) => row.effectKey)).size).toBe(entries.length)
    for (const row of entries) {
      expect(isReviewedTemplateMechanicEffect32(row)).toBe(true)
      expect(
        row.sourceRefs.some(
          (source) => source.includes('#sha256=') && /[A-F0-9]{64}$/.test(source),
        ),
      ).toBe(true)
      expect(isReviewedTemplateMechanicEffect32({ ...row, providerAgentId: 'agent-billy' })).toBe(
        false,
      )
    }
    expect(new Set(entries.map((row) => row.providerAgentId)).size).toBe(12)
  })
  it('Sigrid resolves actual core levels, known off, unknown, and invalid observations separately', () => {
    expect(
      value('reviewed_aerial_patrol_crit32', {
        'char.core': 0,
        sigridAerialPatrolCritWindow32: true,
      }),
    ).toBe(0.33)
    expect(
      value('reviewed_aerial_patrol_crit32', {
        'char.core': 6,
        sigridAerialPatrolCritWindow32: true,
      }),
    ).toBe(0.66)
    expect(
      value('reviewed_aerial_patrol_crit32', {
        'char.core': 6,
        sigridAerialPatrolCritWindow32: false,
      }),
    ).toBe(0)
    expect(value('reviewed_aerial_patrol_crit32', { 'char.core': 6 })).toBeNull()
    expect(
      value('reviewed_aerial_patrol_crit32', {
        'char.core': 7,
        sigridAerialPatrolCritWindow32: true,
      }),
    ).toBeNull()
    expect(
      validateReviewedTemplateMechanicObservations32({
        entry: entry('reviewed_aerial_patrol_crit32'),
        references: { sigridAerialPatrolCritWindow32: 1 },
      }).status,
    ).toBe('unsupported')
  })
  it('Sunna uses initial ATK and actual core cap without reading final ATK', () => {
    const refs = {
      'own.initial.atk': 3000,
      'own.final.atk': 9000,
      'char.core': 6,
      sunnaAngelicChordination32: true,
    }
    expect(value('reviewed_angelic_chord_attack32', refs)).toBe(900)
    expect(value('reviewed_angelic_chord_attack32', { ...refs, 'own.initial.atk': 4000 })).toBe(
      1050,
    )
    expect(value('reviewed_angelic_chord_attack32', { ...refs, 'char.core': 0 })).toBe(525)
    expect(
      applicationForReceiver(
        effectReceiverMetadata(
          entry('reviewed_angelic_chord_attack32').numericExpression.expressionIr,
        ).receiverPath,
      ),
    ).toBe('attack_flat')
  })
  it('additional effects retain the real team activation gate and self/team recipient separation', () => {
    const refs = { cissiaVenomBuffWindow32: true }
    expect(value('reviewed_venom_team_crit_damage32', refs, true)).toBe(0.4)
    expect(value('reviewed_venom_self_crit_damage32', refs, true)).toBe(0.1)
    expect(value('reviewed_venom_team_crit_damage32', refs, false)).toBe(0)
    expect(entry('reviewed_venom_self_crit_damage32').targetKinds).toEqual(['self'])
    expect(entry('reviewed_venom_team_crit_damage32').targetKinds).toEqual(['team'])
    expect(value('reviewed_delusion_stun32', { sunnaDelusionStunWindow32: true }, false)).toBe(0)
  })
  it('Nangong converts initial mastery to impact and keeps the observed damage window distinct', () => {
    expect(
      value('reviewed_initial_mastery_impact32', {
        'own.initial.anomMas': 190,
        'own.final.anomMas': 300,
      }),
    ).toBe(80)
    expect(value('reviewed_initial_mastery_impact32', { 'own.initial.anomMas': 100 })).toBe(0)
    expect(
      value('reviewed_core_team_damage32', { 'char.core': 6, nangongCoreHitWindow32: true }),
    ).toBe(0.25)
    expect(
      value('reviewed_core_team_damage32', { 'char.core': 0, nangongCoreHitWindow32: true }),
    ).toBe(0.13)
  })
  it('Ye Unity and Pyrois Sunflare keep their source-specific actor states and core values', () => {
    expect(value('reviewed_unity_crit32', { 'char.core': 6, yeShunguangUnity32: true })).toBe(0.3)
    expect(value('reviewed_unity_damage32', { 'char.core': 0, yeShunguangUnity32: true })).toBe(0.1)
    expect(value('reviewed_sunflare_damage32', { 'char.core': 2, pyroisSunflare32: true })).toBe(
      0.268,
    )
    expect(value('reviewed_ability_crit_damage32', {}, false)).toBe(0)
  })
  it('Norma separates initial CR conversion from final sheer-force attack dependency', () => {
    expect(
      value('reviewed_initial_crit_conversion32', {
        'char.core': 6,
        'own.initial.crit_': 0.7,
        'own.final.crit_': 1,
      }),
    ).toBeCloseTo(0.34)
    expect(
      value('reviewed_initial_crit_conversion32', { 'char.core': 6, 'own.initial.crit_': 1.2 }),
    ).toBe(0.85)
    expect(value('reviewed_sheer_force_attack32', { 'own.final.sheerForce': 600 })).toBe(750)
    expect(value('reviewed_sheer_force_attack32', { 'own.final.sheerForce': 1200 })).toBe(1200)
    expect(value('reviewed_sheer_force_attack32', { 'own.initial.sheerForce': 600 })).toBeNull()
  })
  it('Aria and Promeia compute sourced proficiency and Velina uses initial regen, retaining distinct caps', () => {
    expect(value('reviewed_core_proficiency32', { 'char.core': 6 })).toBe(90)
    expect(value('reviewed_initial_mastery_proficiency32', { 'own.initial.anomMas': 230 })).toBe(
      120,
    )
    expect(
      value('reviewed_initial_regen_damage32', {
        'own.initial.enerRegen': 2.2,
        'own.final.enerRegen': 7,
      }),
    ).toBeCloseTo(0.21)
    expect(value('reviewed_initial_regen_damage32', { 'own.initial.enerRegen': 2.9 })).toBe(0.35)
    expect(value('reviewed_initial_regen_mastery32', { 'own.initial.enerRegen': 2.9 })).toBe(84)
  })
  it('Zhao attack window and Remielle actual party counts do not reuse unrelated states', () => {
    expect(
      value('reviewed_wellspring_attack32', { 'char.core': 6, zhaoWellspringAttackWindow32: true }),
    ).toBe(1000)
    expect(
      value('reviewed_wellspring_attack32', { 'char.core': 0, zhaoWellspringAttackWindow32: true }),
    ).toBe(100)
    for (const [count, expected] of [
      [1, 0.06],
      [2, 0.12],
      [3, 0.35],
    ])
      expect(value('reviewed_phase_flow_daze32', { remiellePhaseFlow32: true }, true, count)).toBe(
        expected,
      )
  })
  it('Lucia binds only her source-marked final Harmony event and requires an actual event observation', () => {
    const blueprint = compileAgentPlanningEffectBlueprints('agent-lucia').find(
      (row) => row.effectId === 'exSpecial_harmony_dmg_',
    )!
    const events = getCurrentAgentEventContract('agent-lucia')!.eventContract.events
    const final = events.find(
      (row) => row.eventId === 'special.EXSpecialAttackSymphonyOfTheReaperDaybreak.hit-0',
    )!
    const input = { entry: blueprint, ownerAgentId: 'agent-lucia', event: final }
    expect(bindReviewedLuciaHarmonyFinalHit32(input).status).toBe('unsupported')
    expect(
      bindReviewedLuciaHarmonyFinalHit32({ ...input, references: { luciaHarmonyFinalHit32: true } })
        .status,
    ).toBe('supported')
    const off = bindReviewedLuciaHarmonyFinalHit32({
      ...input,
      references: { luciaHarmonyFinalHit32: false },
    })
    expect(off.status === 'supported' && off.valueOverride).toBe(0)
    const otherActor = bindReviewedLuciaHarmonyFinalHit32({
      ...input,
      ownerAgentId: 'agent-billy',
      references: { luciaHarmonyFinalHit32: true },
    })
    expect(otherActor.status === 'supported' && otherActor.valueOverride).toBe(0)
    const notFinal = events.find((row) => row.eventId === 'chain.UltimateChargeGreatArmor.hit-1')!
    const early = bindReviewedLuciaHarmonyFinalHit32({
      ...input,
      event: notFinal,
      references: { luciaHarmonyFinalHit32: true },
    })
    expect(early.status === 'supported' && early.valueOverride).toBe(0)
  })
})
