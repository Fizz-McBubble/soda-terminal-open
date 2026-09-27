import { z } from 'zod'
import { evidenceSourceSchema } from '../gameData/canonicalData'

const sourcedValueSchema = z.object({
  value: z.number(),
  sourceId: z.string().min(1),
})

const buffSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  attackPercent: z.number().default(0),
  attackFlat: z.number().default(0),
  damageBonus: z.number().default(0),
  critRate: z.number().default(0),
  critDamage: z.number().default(0),
  coverage: z.number().min(0).max(1),
})

export const directDamageInputSchema = z.object({
  modelVersion: z.literal('direct-damage-expectation-v1'),
  gameVersion: z.string().min(1),
  agentId: z.string().min(1),
  scenarioId: z.string().min(1),
  baseAttack: sourcedValueSchema.pipe(
    z.object({ value: z.number().positive(), sourceId: z.string() }),
  ),
  attackPercent: sourcedValueSchema,
  attackFlat: sourcedValueSchema,
  skillMultiplier: sourcedValueSchema.pipe(
    z.object({ value: z.number().positive(), sourceId: z.string() }),
  ),
  hitCount: sourcedValueSchema.pipe(
    z.object({ value: z.number().int().positive(), sourceId: z.string() }),
  ),
  critRate: sourcedValueSchema,
  critDamage: sourcedValueSchema,
  damageBonus: sourcedValueSchema,
  buffs: z.array(buffSchema),
  enemy: z.object({
    id: z.string().min(1),
    defenseMultiplier: sourcedValueSchema,
    resistanceMultiplier: sourcedValueSchema,
    stunMultiplier: sourcedValueSchema,
  }),
  cycleSeconds: sourcedValueSchema.pipe(
    z.object({ value: z.number().positive(), sourceId: z.string() }),
  ),
  sources: z.array(evidenceSourceSchema).min(1),
  anomalyOrDisorderRequired: z.boolean(),
})

export type DirectDamageInput = z.infer<typeof directDamageInputSchema>

export type DirectDamageResult =
  | {
      status: 'supported'
      expectedDirectDamage: number
      dps: number
      effectiveAttack: number
      expectedCritMultiplier: number
      factors: Array<{ label: string; value: number; sourceId: string }>
      boundary: string
    }
  | { status: 'unsupported'; missing: string[]; boundary: string }

function round(value: number) {
  return Math.round(value * 100) / 100
}

export function calculateDirectDamageExpectation(input: unknown): DirectDamageResult {
  const parsed = directDamageInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: 'unsupported',
      missing: parsed.error.issues.map((issue) => issue.path.join('.') || issue.message),
      boundary: '输入不完整或不合法，不能生成伤害结果。',
    }
  }
  const value = parsed.data
  if (value.anomalyOrDisorderRequired) {
    return {
      status: 'unsupported',
      missing: ['anomaly_or_disorder_model'],
      boundary: '异常/紊乱公式尚未进入本模型，不能用直接伤害公式代替。',
    }
  }
  const weightedBuff = value.buffs.reduce(
    (sum, buff) => ({
      attackPercent: sum.attackPercent + buff.attackPercent * buff.coverage,
      attackFlat: sum.attackFlat + buff.attackFlat * buff.coverage,
      damageBonus: sum.damageBonus + buff.damageBonus * buff.coverage,
      critRate: sum.critRate + buff.critRate * buff.coverage,
      critDamage: sum.critDamage + buff.critDamage * buff.coverage,
    }),
    { attackPercent: 0, attackFlat: 0, damageBonus: 0, critRate: 0, critDamage: 0 },
  )
  const effectiveAttack =
    value.baseAttack.value * (1 + value.attackPercent.value + weightedBuff.attackPercent) +
    value.attackFlat.value +
    weightedBuff.attackFlat
  const critRate = Math.min(1, Math.max(0, value.critRate.value + weightedBuff.critRate))
  const critDamage = Math.max(0, value.critDamage.value + weightedBuff.critDamage)
  const expectedCritMultiplier = 1 + critRate * critDamage
  const expectedDirectDamage =
    effectiveAttack *
    value.skillMultiplier.value *
    value.hitCount.value *
    expectedCritMultiplier *
    (1 + value.damageBonus.value + weightedBuff.damageBonus) *
    value.enemy.defenseMultiplier.value *
    value.enemy.resistanceMultiplier.value *
    value.enemy.stunMultiplier.value

  return {
    status: 'supported',
    expectedDirectDamage: round(expectedDirectDamage),
    dps: round(expectedDirectDamage / value.cycleSeconds.value),
    effectiveAttack: round(effectiveAttack),
    expectedCritMultiplier: round(expectedCritMultiplier),
    factors: [
      { label: '基础攻击力', value: value.baseAttack.value, sourceId: value.baseAttack.sourceId },
      {
        label: '技能倍率',
        value: value.skillMultiplier.value,
        sourceId: value.skillMultiplier.sourceId,
      },
      {
        label: '敌人防御倍率',
        value: value.enemy.defenseMultiplier.value,
        sourceId: value.enemy.defenseMultiplier.sourceId,
      },
      {
        label: '敌人抗性倍率',
        value: value.enemy.resistanceMultiplier.value,
        sourceId: value.enemy.resistanceMultiplier.sourceId,
      },
    ],
    boundary: '仅比较声明循环中的直接伤害期望，不含异常、紊乱、危局计分或未声明触发。',
  }
}

export const guideCandidateSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  gameVersion: z.string().min(1),
  scene: z.string().min(1),
  author: z.string().min(1).nullable(),
  publishedAt: z.string().datetime().nullable(),
  popularity: z.string().min(1).nullable(),
  assumptions: z.array(z.string().min(1)),
  conflicts: z.array(z.string().min(1)),
  sourceIds: z.array(z.string().min(1)).min(1),
  contentHash: z.string().min(1),
  calculationInput: directDamageInputSchema.nullable(),
})

export function compareGuideCandidates(candidates: unknown[]) {
  return candidates
    .map((candidate) => guideCandidateSchema.parse(candidate))
    .map((candidate) => ({
      candidate,
      result: candidate.calculationInput
        ? calculateDirectDamageExpectation(candidate.calculationInput)
        : ({
            status: 'unsupported',
            missing: ['calculationInput'],
            boundary: '攻略候选缺少可复算输入。',
          } as const),
    }))
    .sort((left, right) => {
      if (left.result.status !== 'supported') return 1
      if (right.result.status !== 'supported') return -1
      return right.result.expectedDirectDamage - left.result.expectedDirectDamage
    })
}

/** Test-only callers may compare fully sourced direct-damage vectors; unsupported entries never rank. */
export function compareDirectDamageCandidates(candidates: Array<{ id: string; input: unknown }>) {
  const resolved = candidates.map(({ id, input }) => ({
    id,
    result: calculateDirectDamageExpectation(input),
  }))
  const ranked = resolved
    .filter(
      (
        item,
      ): item is typeof item & { result: Extract<DirectDamageResult, { status: 'supported' }> } =>
        item.result.status === 'supported',
    )
    .sort((left, right) => right.result.expectedDirectDamage - left.result.expectedDirectDamage)
  const first = ranked[0]
  return resolved.map((item) => {
    if (item.result.status !== 'supported' || !first)
      return { ...item, rank: null, delta: null, percent: null, primaryFactor: null }
    const delta = first.result.expectedDirectDamage - item.result.expectedDirectDamage
    return {
      ...item,
      rank: ranked.findIndex((rankedItem) => rankedItem.id === item.id) + 1,
      delta: round(delta),
      percent: round((delta / first.result.expectedDirectDamage) * 100),
      primaryFactor: item.result.factors[1]?.label ?? null,
    }
  })
}
