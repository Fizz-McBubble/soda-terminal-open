import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { arithmetic } from '../upstream/genshinOptimizer/pandoFormula'
import { isDmgAbilityDim } from '../upstream/genshinOptimizer/zzzFormulaMeta'
import { calculationContextSchema, type CalculationContext } from './calculationContext'
import { evaluateCalculationGate } from './damageGate'
import { calculateStandardDirectDamageCore } from './directDamageCore'

export const directDamageEventModelVersion = 'direct-damage-events-v2-r25' as const
export const lockedFormulaCommit = '9617fb58334cfe84e26252041fb9510c34057f62'

const sourcedNumberSchema = z.object({
  value: z.number(),
  evidenceRefs: z.array(z.string().min(1)).min(1),
})

const nonNegativeSourcedNumberSchema = sourcedNumberSchema.extend({
  value: z.number().nonnegative(),
})

const modifierSchema = z.object({
  attackPercent: sourcedNumberSchema,
  attackFlat: sourcedNumberSchema,
  damageBonus: sourcedNumberSchema,
  vulnerability: sourcedNumberSchema,
  critRate: sourcedNumberSchema,
  critDamage: sourcedNumberSchema,
})

export const directDamageEventRotationSchema = z.object({
  modelVersion: z.literal(directDamageEventModelVersion),
  upstreamCommit: z.literal(lockedFormulaCommit),
  contextFingerprint: z.string().min(1),
  actorFinalStatsHash: z.string().min(1),
  actionSequenceHash: z.string().min(1),
  buffWindowHash: z.string().min(1),
  duration: sourcedNumberSchema.extend({ value: z.number().positive() }),
  formulaEvidenceRefs: z.array(z.string().min(1)).min(1),
  contextFieldEvidenceRefs: z.object({
    attackerLevel: z.array(z.string().min(1)).min(1),
    enemyDefense: z.array(z.string().min(1)).min(1),
    enemyResistance: z.array(z.string().min(1)).min(1),
    stunMultiplier: z.array(z.string().min(1)).min(1),
    vulnerability: z.array(z.string().min(1)).min(1),
  }),
  stats: z.object({
    attack: sourcedNumberSchema.extend({ value: z.number().positive() }),
    critRate: sourcedNumberSchema,
    critDamage: nonNegativeSourcedNumberSchema,
    damageBonus: sourcedNumberSchema,
    defenseReduction: sourcedNumberSchema,
    penetrationRatio: sourcedNumberSchema,
    penetrationFlat: nonNegativeSourcedNumberSchema,
    resistanceReduction: sourcedNumberSchema,
  }),
  buffWindows: z.array(
    z.object({
      id: z.string().min(1),
      startSeconds: nonNegativeSourcedNumberSchema,
      endSeconds: nonNegativeSourcedNumberSchema,
      modifiers: modifierSchema,
    }),
  ),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        actionId: z.string().min(1),
        dimension: z.enum(['standardDmg', 'sheerDmg', 'anomalyDmg', 'disorderDmg', 'dazeBuildup']),
        damageType: z.enum(['physical', 'fire', 'ice', 'electric', 'ether']),
        scalingAttribute: z.literal('attack'),
        atSeconds: nonNegativeSourcedNumberSchema,
        multiplier: sourcedNumberSchema.extend({ value: z.number().positive() }),
        hitCount: sourcedNumberSchema.extend({ value: z.number().int().positive() }),
        buffWindowIds: z.array(z.string().min(1)),
      }),
    )
    .min(1),
  rounding: z.literal('nearest-0.01'),
})

export type DirectDamageEventRotation = z.infer<typeof directDamageEventRotationSchema>

export const unsupportedDirectDamageOntology = [
  {
    id: 'anomaly',
    status: 'unsupported',
    reason: '异常积蓄、异常结算与属性异常持续时间尚未闭合。',
  },
  {
    id: 'disorder',
    status: 'unsupported',
    reason: '紊乱归属、触发顺序与多属性时间轴尚未闭合。',
  },
  {
    id: 'daze-and-stun-timeline',
    status: 'unsupported',
    reason: '本切片只消费已给定失衡倍率，不模拟失衡积蓄与失衡窗口。',
  },
] as const

export type DirectDamageEventWhitebox = {
  eventId: string
  actionId: string
  dimension: 'standardDmg'
  damageType: 'physical' | 'fire' | 'ice' | 'electric' | 'ether'
  nonCriticalDamage: number
  criticalDamage: number
  expectedDamage: number
  factors: {
    effectiveAttack: number
    skillMultiplier: number
    hitCount: number
    damageBonusMultiplier: number
    vulnerabilityMultiplier: number
    expectedCritMultiplier: number
    defenseMultiplier: number
    resistanceMultiplier: number
    stunMultiplier: number
  }
  evidenceRefs: string[]
}

export type DirectDamageEventWhiteboxInput = {
  eventId: string
  actionId: string
  damageType: DirectDamageEventWhitebox['damageType']
  multiplier: number
  hitCount: number
  attack: number
  critRate: number
  critDamage: number
  damageBonus: number
  defenseReduction: number
  penetrationRatio: number
  penetrationFlat: number
  resistanceReduction: number
  attackerLevel: number
  enemyDefense: number
  enemyResistance: number
  enemyStunMultiplier: number
  enemyVulnerability: number
  buffs: Array<{
    id: string
    modifiers: Record<keyof DirectDamageEventRotation['buffWindows'][number]['modifiers'], number>
  }>
  evidenceRefs: string[]
}

export type DirectDamageRotationResult =
  | {
      status: 'formal' | 'candidate_estimated'
      contextFingerprint: string
      comparabilityKey: string
      modelVersion: typeof directDamageEventModelVersion
      upstreamCommit: typeof lockedFormulaCommit
      inputHash: string
      totalDamage: number
      dps: number
      displayProjection: {
        totalDamage: number
        dps: number
        precision: 2
        gameEquivalenceClaim: false
      }
      events: Array<
        DirectDamageEventWhitebox & { atSeconds: number; activeBuffWindowIds: string[] }
      >
      boundary: string
      unsupportedMechanics: typeof unsupportedDirectDamageOntology
    }
  | {
      status: 'unsupported'
      gaps: string[]
      boundary: string
      unsupportedMechanics: typeof unsupportedDirectDamageOntology
    }

function round(value: number) {
  return Math.round(value * 100) / 100
}

function collectEvidenceRefs(rotation: DirectDamageEventRotation) {
  const refs = new Set(rotation.formulaEvidenceRefs)
  Object.values(rotation.contextFieldEvidenceRefs)
    .flat()
    .forEach((ref) => refs.add(ref))
  const add = (value: { evidenceRefs: string[] }) =>
    value.evidenceRefs.forEach((ref) => refs.add(ref))
  add(rotation.duration)
  Object.values(rotation.stats).forEach(add)
  rotation.buffWindows.forEach((window) => {
    add(window.startSeconds)
    add(window.endSeconds)
    Object.values(window.modifiers).forEach(add)
  })
  rotation.events.forEach((event) => {
    add(event.atSeconds)
    add(event.multiplier)
    add(event.hitCount)
  })
  return [...refs]
}

function validateRotationAgainstContext(
  context: CalculationContext,
  rotation: DirectDamageEventRotation,
) {
  const gaps: string[] = []
  if (rotation.contextFingerprint !== context.fingerprint)
    gaps.push('事件输入与 CalculationContext 指纹不一致。')
  if (rotation.actorFinalStatsHash !== context.actors[0]?.finalStatsHash)
    gaps.push('事件最终属性与 CalculationContext 角色盘面快照不一致。')
  if (rotation.actionSequenceHash !== stableContentHash(rotation.events))
    gaps.push('动作序列内容与声明哈希不一致。')
  if (rotation.buffWindowHash !== stableContentHash(rotation.buffWindows))
    gaps.push('Buff 窗口内容与声明哈希不一致。')
  if (context.scope.kind !== 'agent')
    gaps.push('R1C 只实现单角色固定循环；队伍伤害聚合仍未进入本切片。')
  if (context.objective !== 'formal_damage' && context.objective !== 'formal_dps')
    gaps.push('当前 CalculationContext 目标不是伤害或 DPS。')
  if (!context.cycle) gaps.push('CalculationContext 缺少固定循环。')
  else {
    if (context.cycle.durationSeconds !== rotation.duration.value)
      gaps.push('固定时长与 CalculationContext 不一致。')
    if (context.cycle.actionSequenceHash !== rotation.actionSequenceHash)
      gaps.push('动作序列哈希与 CalculationContext 不一致。')
    if (context.cycle.buffWindowHash !== rotation.buffWindowHash)
      gaps.push('Buff 窗口哈希与 CalculationContext 不一致。')
    const totalHits = arithmetic.sum(rotation.events.map((event) => event.hitCount.value))
    if (context.cycle.hitCount !== totalHits)
      gaps.push('循环命中总数与 CalculationContext 不一致。')
  }

  const windowIds = new Set(rotation.buffWindows.map((window) => window.id))
  rotation.buffWindows.forEach((window) => {
    if (window.endSeconds.value < window.startSeconds.value)
      gaps.push(`Buff 窗口“${window.id}”结束时间早于开始时间。`)
    if (window.endSeconds.value > rotation.duration.value)
      gaps.push(`Buff 窗口“${window.id}”超出固定循环时长。`)
  })
  rotation.events.forEach((event) => {
    if (event.atSeconds.value > rotation.duration.value)
      gaps.push(`事件“${event.id}”超出固定循环时长。`)
    if (!isDmgAbilityDim(event.dimension) || event.dimension !== 'standardDmg')
      gaps.push(`事件“${event.id}”不是本切片支持的标准直接伤害。`)
    event.buffWindowIds.forEach((id) => {
      if (!windowIds.has(id)) gaps.push(`事件“${event.id}”引用了不存在的 Buff 窗口“${id}”。`)
    })
  })

  const evidenceById = new Map(context.evidence.map((evidence) => [evidence.fieldId, evidence]))
  for (const ref of collectEvidenceRefs(rotation)) {
    const evidence = evidenceById.get(ref)
    if (!evidence) {
      gaps.push(`数值引用“${ref}”未在 CalculationContext evidence 中声明。`)
      continue
    }
    if (
      !evidence.requiredFor.includes('formal_damage') &&
      !evidence.requiredFor.includes('formal_dps')
    )
      gaps.push(`数值引用“${ref}”未声明为伤害能力依赖。`)
  }
  return gaps
}

function activeBuffs(
  rotation: DirectDamageEventRotation,
  event: DirectDamageEventRotation['events'][number],
) {
  const requested = new Set(event.buffWindowIds)
  return rotation.buffWindows.filter(
    (window) =>
      requested.has(window.id) &&
      event.atSeconds.value >= window.startSeconds.value &&
      event.atSeconds.value <= window.endSeconds.value,
  )
}

function eventEvidenceRefs(
  rotation: DirectDamageEventRotation,
  event: DirectDamageEventRotation['events'][number],
  buffs: DirectDamageEventRotation['buffWindows'],
) {
  const refs = new Set([
    ...rotation.formulaEvidenceRefs,
    ...Object.values(rotation.contextFieldEvidenceRefs).flat(),
    ...event.atSeconds.evidenceRefs,
    ...event.multiplier.evidenceRefs,
    ...event.hitCount.evidenceRefs,
  ])
  Object.values(rotation.stats).forEach((value) =>
    value.evidenceRefs.forEach((ref) => refs.add(ref)),
  )
  buffs.forEach((window) => {
    window.startSeconds.evidenceRefs.forEach((ref) => refs.add(ref))
    window.endSeconds.evidenceRefs.forEach((ref) => refs.add(ref))
    Object.values(window.modifiers).forEach((value) =>
      value.evidenceRefs.forEach((ref) => refs.add(ref)),
    )
  })
  return [...refs]
}

/** Shared white-box core for a standard direct event. Rotation and event-set
 * consumers intentionally call this exact function. */
export function calculateDirectDamageEventWhitebox(
  input: DirectDamageEventWhiteboxInput,
): DirectDamageEventWhitebox {
  const sumModifier = (key: keyof DirectDamageEventRotation['buffWindows'][number]['modifiers']) =>
    arithmetic.sum(input.buffs.map((buff) => buff.modifiers[key]))
  const raw = calculateStandardDirectDamageCore({
    attackerLevel: input.attackerLevel,
    attack: input.attack,
    attackPercent: sumModifier('attackPercent'),
    attackFlat: sumModifier('attackFlat'),
    multiplier: input.multiplier,
    hitCount: input.hitCount,
    critRate: input.critRate + sumModifier('critRate'),
    critDamage: input.critDamage + sumModifier('critDamage'),
    damageBonus: input.damageBonus + sumModifier('damageBonus'),
    vulnerability: input.enemyVulnerability + sumModifier('vulnerability'),
    defenseReduction: input.defenseReduction,
    penetrationRatio: input.penetrationRatio,
    penetrationFlat: input.penetrationFlat,
    resistance: input.enemyResistance,
    resistanceReduction: input.resistanceReduction,
    stunMultiplier: input.enemyStunMultiplier,
    enemyDefense: input.enemyDefense,
  })
  return {
    eventId: input.eventId,
    actionId: input.actionId,
    dimension: 'standardDmg',
    damageType: input.damageType,
    nonCriticalDamage: raw.nonCriticalDamage,
    criticalDamage: raw.criticalDamage,
    expectedDamage: raw.expectedDamage,
    factors: raw.factors,
    evidenceRefs: input.evidenceRefs,
  }
}

export {
  calculateGeneralDirectDamageEvent,
  generalDirectDamageCoreApi,
  generalDirectDamageEventSchema,
  resolveGeneralSkillMultiplier,
  type GeneralDirectDamageEvent,
  type GeneralDirectDamageResult,
} from '../gameDataPacks/general-event-mapping-core'

function calculateEvent(
  context: CalculationContext,
  rotation: DirectDamageEventRotation,
  event: DirectDamageEventRotation['events'][number],
): DirectDamageEventWhitebox & { atSeconds: number; activeBuffWindowIds: string[] } {
  const buffs = activeBuffs(rotation, event)
  const actorLevel = context.actors[0]?.level
  const enemy = context.scenario.enemy
  if (
    actorLevel === null ||
    actorLevel === undefined ||
    actorLevel < 1 ||
    actorLevel > 60 ||
    !enemy ||
    enemy.defense === null ||
    enemy.resistance === null ||
    enemy.stunMultiplier === null ||
    enemy.vulnerability === null
  )
    throw new Error('direct damage context is incomplete')
  return {
    ...calculateDirectDamageEventWhitebox({
      eventId: event.id,
      actionId: event.actionId,
      damageType: event.damageType,
      multiplier: event.multiplier.value,
      hitCount: event.hitCount.value,
      attack: rotation.stats.attack.value,
      critRate: rotation.stats.critRate.value,
      critDamage: rotation.stats.critDamage.value,
      damageBonus: rotation.stats.damageBonus.value,
      defenseReduction: rotation.stats.defenseReduction.value,
      penetrationRatio: rotation.stats.penetrationRatio.value,
      penetrationFlat: rotation.stats.penetrationFlat.value,
      resistanceReduction: rotation.stats.resistanceReduction.value,
      attackerLevel: actorLevel,
      enemyDefense: enemy.defense,
      enemyResistance: enemy.resistance,
      enemyStunMultiplier: enemy.stunMultiplier,
      enemyVulnerability: enemy.vulnerability,
      buffs: buffs.map((buff) => ({
        id: buff.id,
        modifiers: Object.fromEntries(
          Object.entries(buff.modifiers).map(([key, value]) => [key, value.value]),
        ) as DirectDamageEventWhiteboxInput['buffs'][number]['modifiers'],
      })),
      evidenceRefs: eventEvidenceRefs(rotation, event, buffs),
    }),
    atSeconds: event.atSeconds.value,
    activeBuffWindowIds: buffs.map((buff) => buff.id),
  }
}

/**
 * Deterministic R1C calculation seam. It consumes the R1B context and gate,
 * executes only standard direct-damage events, and has no repository access.
 */
export function calculateDirectDamageRotation(
  contextInput: unknown,
  rotationInput: unknown,
): DirectDamageRotationResult {
  const contextParsed = calculationContextSchema.safeParse(contextInput)
  const rotationParsed = directDamageEventRotationSchema.safeParse(rotationInput)
  if (!contextParsed.success || !rotationParsed.success)
    return {
      status: 'unsupported',
      gaps: ['CalculationContext 或直接伤害事件输入不完整。'],
      boundary: '输入不完整时不输出任何伤害数值。',
      unsupportedMechanics: unsupportedDirectDamageOntology,
    }
  const context = contextParsed.data
  const rotation = rotationParsed.data
  const gaps = validateRotationAgainstContext(context, rotation)
  const gate = evaluateCalculationGate(context)
  const softCandidateBlockers = new Set(['candidate-field', 'canonical-not-formal'])
  const candidateEligible =
    gate.context !== null &&
    gate.blockers.length > 0 &&
    gate.blockers.every((blocker) => softCandidateBlockers.has(blocker.code))
  if (gate.status !== 'formal_damage_reproducible' && !candidateEligible)
    gaps.push(...gate.blockers.map((blocker) => blocker.reason))
  if (gaps.length)
    return {
      status: 'unsupported',
      gaps: [...new Set(gaps)],
      boundary: '缺口、跨版本、冲突或未支持机制存在时不输出伤害数值。',
      unsupportedMechanics: unsupportedDirectDamageOntology,
    }

  const actorLevel = context.actors[0]?.level
  const enemy = context.scenario.enemy
  if (
    actorLevel === null ||
    actorLevel === undefined ||
    actorLevel < 1 ||
    actorLevel > 60 ||
    !enemy ||
    enemy.defense === null ||
    enemy.resistance === null ||
    enemy.stunMultiplier === null ||
    enemy.vulnerability === null
  )
    return {
      status: 'unsupported',
      gaps: ['缺少直接伤害所需的角色等级或完整敌人上下文。'],
      boundary: '必要上下文字段缺失时不输出任何伤害数值。',
      unsupportedMechanics: unsupportedDirectDamageOntology,
    }

  const events = rotation.events.map((event) => calculateEvent(context, rotation, event))
  const totalDamage = arithmetic.sum(events.map((event) => event.expectedDamage))
  const status = gate.status === 'formal_damage_reproducible' ? 'formal' : 'candidate_estimated'
  return {
    status,
    contextFingerprint: context.fingerprint,
    comparabilityKey: context.comparabilityKey,
    modelVersion: directDamageEventModelVersion,
    upstreamCommit: lockedFormulaCommit,
    inputHash: stableContentHash(rotation),
    totalDamage,
    dps: totalDamage / rotation.duration.value,
    displayProjection: {
      totalDamage: round(totalDamage),
      dps: round(totalDamage / rotation.duration.value),
      precision: 2,
      gameEquivalenceClaim: false,
    },
    events,
    boundary:
      status === 'formal'
        ? '同一 formal CalculationContext 下的标准直接伤害固定循环；不包含异常、紊乱或失衡积蓄时间轴。'
        : '同一候选版本与固定假设下的直接伤害估算；不是正式精确伤害、最高伤害或正式最优。',
    unsupportedMechanics: unsupportedDirectDamageOntology,
  }
}
