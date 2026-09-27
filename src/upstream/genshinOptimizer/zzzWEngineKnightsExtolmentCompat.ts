import { z } from 'zod'

export const knightsExtolmentCompatibilitySource = Object.freeze({
  repository: 'frzyc/genshin-optimizer',
  commit: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  license: 'MIT',
  rawPath: 'libs/zzz/stats/Data/Wengine/KnightsExtolment.json',
  stableId: 'wengine-14159',
  gameId: 14159,
  releaseVersion: '3.1-phase-ii',
  releaseDate: '2026-08-19',
})

export const knightsExtolmentStaticStats = Object.freeze({
  level: 60,
  rarity: 'S',
  specialty: 'damage',
  baseAttack: 713,
  critDamage: 0.48,
})

const critDamagePerStack = Object.freeze({ 1: 0.32, 2: 0.368, 3: 0.416, 4: 0.464, 5: 0.512 })
const iceResistanceIgnore = Object.freeze({ 1: 0.2, 2: 0.23, 3: 0.26, 4: 0.29, 5: 0.32 })
const durationSeconds = 25

const inputSchema = z.object({
  refinement: z.number().int().min(1).max(5),
  damageAttribute: z.enum([
    'physical',
    'fire',
    'ice',
    'electric',
    'ether',
    'auric_ink',
    'lumiflux',
  ]),
  basicHeavyHitAgeSeconds: z.number().min(0).nullable(),
  exSpecialHeavyHitAgeSeconds: z.number().min(0).nullable(),
})

export type KnightsExtolmentModifierResult =
  | {
      status: 'supported'
      activeStacks: 0 | 1 | 2
      critDamage: number
      resistanceIgnore: number
      durationSeconds: 25
      source: typeof knightsExtolmentCompatibilitySource
    }
  | { status: 'unsupported'; blockers: string[] }

/**
 * Stable local adapter for the two independently triggered 25-second stacks.
 * The caller must provide ages from its frozen event bundle; this function
 * never invents hits, refresh timing, or an Ice-damage event.
 */
export function resolveKnightsExtolmentModifiers(input: unknown): KnightsExtolmentModifierResult {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success)
    return {
      status: 'unsupported',
      blockers: ['改装等级、伤害属性和两类重击的最近触发时间必须完整且合法。'],
    }
  const value = parsed.data
  const refinement = value.refinement as keyof typeof critDamagePerStack
  const activeStacks = [value.basicHeavyHitAgeSeconds, value.exSpecialHeavyHitAgeSeconds].filter(
    (age) => age !== null && age <= durationSeconds,
  ).length as 0 | 1 | 2
  return {
    status: 'supported',
    activeStacks,
    critDamage: critDamagePerStack[refinement] * activeStacks,
    resistanceIgnore:
      activeStacks === 2 && value.damageAttribute === 'ice' ? iceResistanceIgnore[refinement] : 0,
    durationSeconds,
    source: knightsExtolmentCompatibilitySource,
  }
}
