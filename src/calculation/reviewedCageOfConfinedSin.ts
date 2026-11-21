import { z } from 'zod'
import {
  calculateWEngineBaseStatExact,
  calculateWEngineSecondaryStat,
} from '../gameDataPacks/panel/wEngineGrowth'
import {
  cageOfConfinedSinStaticRecord,
  getCurrentWEngineStaticData,
} from '../gameDataPacks/currentWEngineStaticCatalog'
import type { CurrentWEnginePassiveEffect } from './currentWEnginePassiveAdapters'

export const CAGE_OF_CONFINED_SIN_STABLE_ID = 'wengine-14163' as const
export const CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS = Object.freeze({
  basicAttackHitWindowActive: 'CageOfConfinedSin:basicAttackHitWindowActive',
} as const)

export const CAGE_OF_CONFINED_SIN_PASSIVE_TABLE: Readonly<
  Record<number, { critRate: number; attackBonus: number; windResIgnore: number }>
> = Object.freeze(
  Object.fromEntries(
    cageOfConfinedSinStaticRecord.passiveParameterTable.map((row) => [
      row.refinement,
      {
        critRate: row.params[0]!,
        attackBonus: row.params[1]!,
        windResIgnore: row.params[2]!,
      },
    ]),
  ),
)

const unsupported = (blockers: string[]) => ({
  status: 'unsupported' as const,
  blockers: [...new Set(blockers)],
})

export const cageOfConfinedSinPassiveInputSchema = z.object({
  stableId: z
    .literal(CAGE_OF_CONFINED_SIN_STABLE_ID)
    .optional()
    .default(CAGE_OF_CONFINED_SIN_STABLE_ID),
  refinement: z.number().int().min(1).max(5),
  specialtyMatches: z.boolean(),
  runtimePolicy: z.enum(['strict', 'exclude_unobserved']).optional(),
  basicAttackHitWindowActive: z.boolean().optional(),
  basicHitAtSeconds: z.number().nonnegative().optional(),
  currentAtSeconds: z.number().nonnegative().optional(),
  refreshedAtSeconds: z.number().nonnegative().optional(),
})

export type CageOfConfinedSinPassiveInput = z.infer<typeof cageOfConfinedSinPassiveInputSchema>

export type CageOfConfinedSinPassiveExclusion = {
  effect: 'basic_attack_hit_atk_and_wind_res_ignore_window'
  effectIndex: 1
  reasons: string[]
}

export type CageOfConfinedSinPassiveResult =
  | {
      status: 'supported'
      active: boolean
      effects: CurrentWEnginePassiveEffect[]
      exclusions: CageOfConfinedSinPassiveExclusion[]
      source: NonNullable<ReturnType<typeof getCurrentWEngineStaticData>>['source']
    }
  | {
      status: 'unsupported'
      blockers: string[]
    }

/**
 * Resolves the Absolute Rule (绝对统治) passive for 14163 (禁罪囚笼).
 * - Attack specialty match: permanent CRIT Rate [0.20, 0.23, 0.26, 0.29, 0.32].
 * - Basic Attack hit window (16s duration, refreshable): conditional ATK% [0.15, 0.1725, 0.195, 0.2175, 0.24]
 *   and Wind RES Ignore [0.15, 0.1725, 0.195, 0.2175, 0.24].
 * - Fail-closed: unknown window state is strictly unsupported unless runtimePolicy === 'exclude_unobserved'.
 */
export function resolveCageOfConfinedSinPassive(input: unknown): CageOfConfinedSinPassiveResult {
  const parsed = cageOfConfinedSinPassiveInputSchema.safeParse(input)
  if (!parsed.success) {
    return unsupported(['禁罪囚笼必须提供有效改装等级(1-5)与特性匹配状态。'])
  }

  const value = parsed.data
  const item = getCurrentWEngineStaticData(CAGE_OF_CONFINED_SIN_STABLE_ID)
  const p = item?.passiveParameterTable.find((row) => row.refinement === value.refinement)?.params
  if (!item || !p || p.length !== 3 || p.some((entry) => !Number.isFinite(entry))) {
    return unsupported(['禁罪囚笼被动参数来源不完整。'])
  }

  if (!value.specialtyMatches) {
    return {
      status: 'supported',
      active: false,
      effects: [],
      exclusions: [],
      source: item.source,
    }
  }

  const hasTimeline =
    value.basicHitAtSeconds !== undefined ||
    value.currentAtSeconds !== undefined ||
    value.refreshedAtSeconds !== undefined
  if (
    hasTimeline &&
    !(typeof value.basicHitAtSeconds === 'number' && typeof value.currentAtSeconds === 'number')
  ) {
    return unsupported(['禁罪囚笼时序不完整：必须同时提供普攻命中时间与当前时间。'])
  }

  let timedWindow: boolean | undefined
  if (typeof value.basicHitAtSeconds === 'number' && typeof value.currentAtSeconds === 'number') {
    if (value.currentAtSeconds < value.basicHitAtSeconds) {
      return unsupported(['禁罪囚笼时序错误：当前时间不能早于普攻命中时间。'])
    }
    let effectiveStart = value.basicHitAtSeconds
    if (typeof value.refreshedAtSeconds === 'number') {
      if (
        value.refreshedAtSeconds < value.basicHitAtSeconds ||
        value.currentAtSeconds < value.refreshedAtSeconds
      ) {
        return unsupported(['禁罪囚笼时序错误：刷新时间必须位于普攻命中与当前时间之间。'])
      }
      effectiveStart = value.refreshedAtSeconds
    }
    timedWindow = value.currentAtSeconds - effectiveStart < 16
  }
  if (
    timedWindow !== undefined &&
    value.basicAttackHitWindowActive !== undefined &&
    timedWindow !== value.basicAttackHitWindowActive
  ) {
    return unsupported(['禁罪囚笼显式普攻窗口状态与已知时序矛盾。'])
  }

  const isWindowActive = timedWindow ?? value.basicAttackHitWindowActive
  if (isWindowActive === undefined && value.runtimePolicy !== 'exclude_unobserved') {
    return unsupported(['禁罪囚笼必须提供普通攻击命中增益窗口状态或有效时序，未知状态不得假设。'])
  }

  const effects: CurrentWEnginePassiveEffect[] = [
    {
      target: 'own',
      stat: 'crit_rate',
      value: p[0]!,
    },
  ]
  if (isWindowActive) {
    effects.push(
      {
        target: 'own',
        stat: 'attack_percent',
        value: p[1]!,
      },
      {
        target: 'own',
        stat: 'resistance_ignore',
        attribute: 'wind',
        value: p[2]!,
      },
    )
  }

  return {
    status: 'supported',
    active: effects.some((e) => e.value !== 0),
    effects,
    exclusions:
      isWindowActive === undefined
        ? [
            {
              effect: 'basic_attack_hit_atk_and_wind_res_ignore_window',
              effectIndex: 1,
              reasons: [CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS.basicAttackHitWindowActive],
            },
          ]
        : [],
    source: item.source,
  }
}

export function calculateCageOfConfinedSinPanel(level: number, ascension: number) {
  if (level < 0 || level > 60 || ascension < 0 || ascension > 5) {
    throw new Error(`Invalid level (${level}) or ascension (${ascension}) for 14163`)
  }
  const baseAttack = Math.floor(calculateWEngineBaseStatExact(48, level, ascension))
  const secondaryValue = calculateWEngineSecondaryStat(0.096, level, ascension)
  return {
    baseAttack,
    secondaryStatKey: 'crit_' as const,
    secondaryValue,
  }
}
