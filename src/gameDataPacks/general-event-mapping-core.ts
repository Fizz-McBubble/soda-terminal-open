import { z } from 'zod'
import { generalAdapterCalculationContextSchema } from '../calculation/calculationContext'
import { calculateStandardDirectDamageCore } from '../calculation/directDamageCore'

export const generalDirectDamageEventSchema = z.object({
  eventId: z.string().min(1),
  actorId: z.string().min(1),
  sourceVersion: z.string().min(1),
  targetVersion: z.string().min(1),
  actionId: z.string().min(1),
  hitIndex: z.number().int().nonnegative(),
  formulaFamily: z.literal('attack_scaled_direct_damage'),
  multiplier: z.object({
    base: z.number().nonnegative(),
    growthPerSkillLevel: z.number().nonnegative(),
    unit: z.literal('ratio'),
  }),
  hitCount: z.object({ value: z.number().int().positive(), unit: z.literal('count') }),
  damageType: z.enum(['physical', 'fire', 'ice', 'electric', 'ether', 'lumiflux']),
  conditionRefs: z.array(z.string().min(1)),
  evidenceRefs: z.array(z.string().min(1)).min(1),
})

export type GeneralDirectDamageEvent = z.infer<typeof generalDirectDamageEventSchema>
export type GeneralDirectDamageResult = {
  rawValue: number
  displayProjection: { value: number; precision: 2; gameEquivalenceClaim: false }
  trace: Array<{ operation: string; value: number }>
  appliedConditions: string[]
  sourceEvidenceRefs: string[]
  policyEvidenceRefs: string[]
  warnings: string[]
}

export const generalDirectDamageCoreApi = Object.freeze({
  coreId: 'soda_general_calculation_engine',
  version: 1,
  operations: ['resolve_skill_multiplier', 'evaluate_single_direct_event'] as const,
})

/** MIT GO linear skill algebra, exposed by the existing directDamageEvents boundary. */
export function resolveGeneralSkillMultiplier(
  multiplier: GeneralDirectDamageEvent['multiplier'],
  explicitSkillLevel: number,
) {
  if (!Number.isInteger(explicitSkillLevel) || explicitSkillLevel < 1)
    throw new Error('explicit positive skill level is required')
  return multiplier.base + multiplier.growthPerSkillLevel * (explicitSkillLevel - 1)
}

/** Fail-closed single-event evaluator; all policy and source inputs are explicit. */
export function calculateGeneralDirectDamageEvent(input: {
  context: unknown
  event: unknown
  explicitSkillLevel: number
}): GeneralDirectDamageResult {
  const context = generalAdapterCalculationContextSchema.parse(input.context)
  const event = generalDirectDamageEventSchema.parse(input.event)
  if (event.actorId !== context.actor.stableId) throw new Error('event actor mismatch')
  if (event.sourceVersion !== context.sourceVersion)
    throw new Error('event source version mismatch')
  if (event.targetVersion !== context.targetVersion)
    throw new Error('event target version mismatch')
  if (!context.policy.fixedEventSet.some((entry) => entry.eventId === event.eventId))
    throw new Error('event is absent from the explicit fixed event set')

  const modifier = (name: string) =>
    context.buffs.reduce((total, buff) => {
      const value = buff.modifiers[name]
      if (!value || value.conditionRefs.some((ref) => !event.conditionRefs.includes(ref)))
        return total
      return total + value.value
    }, 0)
  const stats = context.actor.finalStats
  const skillMultiplier = resolveGeneralSkillMultiplier(event.multiplier, input.explicitSkillLevel)
  const result = calculateStandardDirectDamageCore({
    attackerLevel: context.actor.level,
    attack: stats.attack,
    attackPercent: modifier('attackPercent'),
    attackFlat: modifier('attackFlat'),
    multiplier: skillMultiplier,
    hitCount: event.hitCount.value,
    critRate: stats.critRate + modifier('critRate'),
    critDamage: stats.critDamage + modifier('critDamage'),
    damageBonus: stats.damageBonus + modifier('damageBonus'),
    vulnerability: context.enemy.vulnerability + modifier('vulnerability'),
    defenseReduction: stats.defenseReduction,
    penetrationRatio: stats.penetrationRatio,
    penetrationFlat: stats.penetrationFlat,
    resistance: context.enemy.resistance,
    resistanceReduction: stats.resistanceReduction,
    stunMultiplier: context.enemy.stunState,
    enemyDefense: context.enemy.defense,
  })
  const factors = Object.values(result.factors)
  const rawValue = result.expectedDamage
  const operations = [
    'effective_attack',
    'skill_multiplier',
    'hit_count',
    'damage_bonus_multiplier',
    'vulnerability_multiplier',
    'expected_crit_multiplier',
    'defense_multiplier',
    'resistance_multiplier',
    'stun_multiplier',
  ]
  return {
    rawValue,
    displayProjection: {
      value: Math.round(rawValue * 100) / 100,
      precision: 2,
      gameEquivalenceClaim: false,
    },
    trace: operations.map((operation, index) => ({ operation, value: factors[index]! })),
    appliedConditions: [...event.conditionRefs],
    sourceEvidenceRefs: [...event.evidenceRefs],
    policyEvidenceRefs: [...context.policy.evidenceRefs],
    warnings: ['Final 0.01 projection does not claim game-rounding equivalence.'],
  }
}
