import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { arithmetic } from '../upstream/genshinOptimizer/pandoFormula'
import {
  calculationContextSchema,
  generalAdapterCalculationContextSchema,
} from './calculationContext'
import {
  calculateDirectDamageEventWhitebox,
  calculateGeneralDirectDamageEvent,
  generalDirectDamageEventSchema,
} from './directDamageEvents'
import { evaluateCalculationGate } from './damageGate'

export const unsupportedFormalEventSetMechanics = [
  'anomaly',
  'disorder',
  'rotation',
  'simulation',
] as const

const sourced = z.object({ value: z.number(), evidenceRefs: z.array(z.string().min(1)).min(1) })
const positiveSourced = sourced.extend({ value: z.number().positive() })
const nonNegativeSourced = sourced.extend({ value: z.number().nonnegative() })
const modifiers = z.object({
  attackPercent: sourced,
  attackFlat: sourced,
  damageBonus: sourced,
  vulnerability: sourced,
  critRate: sourced,
  critDamage: sourced,
})

const eventSchema = z.object({
  id: z.string().min(1),
  actionId: z.string().min(1),
  formula: z.literal('standard_direct_damage'),
  damageType: z.enum(['physical', 'fire', 'ice', 'electric', 'ether']),
  count: positiveSourced.extend({ value: z.number().int().positive() }),
  weight: positiveSourced,
  state: z.literal('static'),
  multiplier: positiveSourced,
  buffIds: z.array(z.string().min(1)).default([]),
  sourceRefs: z.array(z.string().min(1)).min(1),
  version: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
})

export const formalEventSetSchema = z.object({
  context: calculationContextSchema,
  formulaEvidenceRefs: z.array(z.string().min(1)).min(1),
  contextFieldEvidenceRefs: z.object({
    attackerLevel: z.array(z.string().min(1)).min(1),
    enemyDefense: z.array(z.string().min(1)).min(1),
    enemyResistance: z.array(z.string().min(1)).min(1),
    stunMultiplier: z.array(z.string().min(1)).min(1),
    vulnerability: z.array(z.string().min(1)).min(1),
  }),
  stats: z.object({
    attack: positiveSourced,
    critRate: sourced,
    critDamage: nonNegativeSourced,
    damageBonus: sourced,
    defenseReduction: sourced,
    penetrationRatio: sourced,
    penetrationFlat: nonNegativeSourced,
    resistanceReduction: sourced,
  }),
  buffs: z.array(z.object({ id: z.string().min(1), modifiers })),
  uncertaintyBand: z.object({
    value: z.number().nonnegative(),
    unit: z.literal('damage'),
    evidenceRefs: z.array(z.string().min(1)).min(1),
  }),
  events: z.array(eventSchema).min(1),
})
export type FormalEventSetInput = z.infer<typeof formalEventSetSchema>
const round = (value: number) => Math.round(value * 100) / 100

function evidenceGaps(input: FormalEventSetInput) {
  const declared = new Set(input.context.evidence.map((item) => item.fieldId))
  const refs = new Set<string>([
    ...input.formulaEvidenceRefs,
    ...Object.values(input.contextFieldEvidenceRefs).flat(),
    ...input.uncertaintyBand.evidenceRefs,
  ])
  Object.values(input.stats).forEach((value) => value.evidenceRefs.forEach((ref) => refs.add(ref)))
  input.buffs.forEach((buff) =>
    Object.values(buff.modifiers).forEach((value) =>
      value.evidenceRefs.forEach((ref) => refs.add(ref)),
    ),
  )
  input.events.forEach((event) => {
    event.count.evidenceRefs.forEach((ref) => refs.add(ref))
    event.weight.evidenceRefs.forEach((ref) => refs.add(ref))
    event.multiplier.evidenceRefs.forEach((ref) => refs.add(ref))
    event.evidence.forEach((ref) => refs.add(ref))
  })
  return [...refs]
    .filter((ref) => !declared.has(ref))
    .map((ref) => `数值引用“${ref}”未在 CalculationContext evidence 中声明。`)
}

function eventContractGaps(input: FormalEventSetInput) {
  const evidenceById = new Map(input.context.evidence.map((item) => [item.fieldId, item]))
  return input.events.flatMap((event) => {
    const gaps: string[] = []
    if (event.version !== input.context.gameVersion)
      gaps.push(
        `事件“${event.id}”版本 ${event.version} 与 CalculationContext ${input.context.gameVersion} 不一致。`,
      )
    const declaredSources = new Set(
      event.evidence.flatMap((ref) => evidenceById.get(ref)?.sourceRefs ?? []),
    )
    event.sourceRefs
      .filter((sourceRef) => !declaredSources.has(sourceRef))
      .forEach((sourceRef) =>
        gaps.push(`事件“${event.id}”来源“${sourceRef}”未由该事件引用的 Context evidence 解析。`),
      )
    return gaps
  })
}

export function calculateFormalEventSet(input: unknown, subjectAgentId?: string) {
  const parsed = formalEventSetSchema.safeParse(input)
  if (!parsed.success)
    return {
      status: 'unsupported' as const,
      gaps: ['CalculationContext 或无时间轴事件集合输入不完整。'],
      unsupported: unsupportedFormalEventSetMechanics,
    }
  const value = parsed.data
  const gate = evaluateCalculationGate(value.context)
  const gaps = [
    ...evidenceGaps(value),
    ...eventContractGaps(value),
    ...gate.capabilities.formalEventSet.blockers.map((blocker) => blocker.reason),
  ]
  if (!gate.capabilities.formalEventSet.allowed || gaps.length)
    return {
      status: 'unsupported' as const,
      gaps: [...new Set(gaps)],
      unsupported: unsupportedFormalEventSetMechanics,
    }
  const buffsById = new Map(value.buffs.map((buff) => [buff.id, buff]))
  const unknownBuffs = value.events.flatMap((event) =>
    event.buffIds
      .filter((id) => !buffsById.has(id))
      .map((id) => `事件“${event.id}”引用不存在的静态 Buff“${id}”。`),
  )
  if (unknownBuffs.length)
    return {
      status: 'unsupported' as const,
      gaps: unknownBuffs,
      unsupported: unsupportedFormalEventSetMechanics,
    }
  const enemy = value.context.scenario.enemy
  const actor = subjectAgentId
    ? value.context.actors.find((item) => item.agentId === subjectAgentId)
    : value.context.actors[0]
  const actorLevel = actor?.level
  if (
    !enemy ||
    enemy.defense === null ||
    enemy.resistance === null ||
    enemy.stunMultiplier === null ||
    enemy.vulnerability === null ||
    actorLevel === null ||
    actorLevel === undefined
  )
    return {
      status: 'unsupported' as const,
      gaps: [
        subjectAgentId && !actor
          ? `CalculationContext 缺少伤害归属成员“${subjectAgentId}”。`
          : '缺少正式事件所需的角色等级或敌人上下文。',
      ],
      unsupported: unsupportedFormalEventSetMechanics,
    }
  const enemyVulnerability = enemy.vulnerability
  const events = value.events.map((event) => {
    const activeBuffs = event.buffIds.map((id) => buffsById.get(id)!)
    const trace = calculateDirectDamageEventWhitebox({
      eventId: event.id,
      actionId: event.actionId,
      damageType: event.damageType,
      multiplier: event.multiplier.value * event.weight.value,
      hitCount: event.count.value,
      attack: value.stats.attack.value,
      critRate: value.stats.critRate.value,
      critDamage: value.stats.critDamage.value,
      damageBonus: value.stats.damageBonus.value,
      defenseReduction: value.stats.defenseReduction.value,
      penetrationRatio: value.stats.penetrationRatio.value,
      penetrationFlat: value.stats.penetrationFlat.value,
      resistanceReduction: value.stats.resistanceReduction.value,
      attackerLevel: actorLevel,
      enemyDefense: enemy.defense!,
      enemyResistance: enemy.resistance!,
      enemyStunMultiplier: enemy.stunMultiplier!,
      enemyVulnerability,
      buffs: activeBuffs.map((buff) => ({
        id: buff.id,
        modifiers: Object.fromEntries(
          Object.entries(buff.modifiers).map(([key, stat]) => [key, stat.value]),
        ) as Parameters<typeof calculateDirectDamageEventWhitebox>[0]['buffs'][number]['modifiers'],
      })),
      evidenceRefs: [...event.sourceRefs, ...event.evidence],
    })
    return {
      id: event.id,
      actionId: event.actionId,
      formula: event.formula,
      count: event.count.value,
      weight: event.weight.value,
      expectedDamage: trace.expectedDamage,
      trace,
    }
  })
  return {
    status: 'formal' as const,
    contextFingerprint: value.context.fingerprint,
    totalDamage: arithmetic.sum(events.map((event) => event.expectedDamage)),
    displayProjection: {
      value: round(arithmetic.sum(events.map((event) => event.expectedDamage))),
      precision: 2 as const,
      gameEquivalenceClaim: false as const,
    },
    events,
    uncertaintyBand: value.uncertaintyBand,
    unsupported: unsupportedFormalEventSetMechanics,
  }
}

export function compareFormalEventSets(left: unknown, right: unknown) {
  const a = calculateFormalEventSet(left),
    b = calculateFormalEventSet(right)
  if (a.status === 'unsupported' || b.status === 'unsupported')
    return { status: 'unsupported' as const }
  const delta = a.totalDamage - b.totalDamage,
    band = Math.max(a.uncertaintyBand.value, b.uncertaintyBand.value)
  return {
    status:
      Math.abs(delta) <= band
        ? ('same_tier' as const)
        : delta > 0
          ? ('left' as const)
          : ('right' as const),
    delta,
    uncertaintyBand: { value: band, unit: 'damage' as const },
  }
}

const generalFixedEventSetSchema = z.object({
  context: generalAdapterCalculationContextSchema,
  events: z
    .array(
      z.object({
        definition: generalDirectDamageEventSchema,
        explicitSkillLevel: z.number().int().positive(),
        weight: z.literal(1),
      }),
    )
    .min(1),
})

/** R16 candidate-only fixed set. It cannot emit a Formal readiness conclusion. */
export function calculateGeneralFixedEventSet(input: unknown) {
  const parsed = generalFixedEventSetSchema.parse(input)
  const eventIds = parsed.events.map((event) => event.definition.eventId)
  if (new Set(eventIds).size !== eventIds.length) throw new Error('duplicate fixed event')
  const policyEventIds = parsed.context.policy.fixedEventSet.map((event) => event.eventId)
  if (stableContentHash(eventIds) !== stableContentHash(policyEventIds))
    throw new Error('fixed event set does not match explicit policy')
  const events = parsed.events.map((event) => ({
    eventId: event.definition.eventId,
    weight: event.weight,
    result: calculateGeneralDirectDamageEvent({
      context: parsed.context,
      event: event.definition,
      explicitSkillLevel: event.explicitSkillLevel,
    }),
  }))
  const rawValue = arithmetic.sum(events.map((event) => event.result.rawValue))
  return {
    status: 'implementation_candidate' as const,
    rawValue,
    displayProjection: {
      value: Math.round(rawValue * 100) / 100,
      precision: 2 as const,
      gameEquivalenceClaim: false as const,
    },
    events,
    formalPromotion: false as const,
  }
}
