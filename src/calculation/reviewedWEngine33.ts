import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import {
  calculateWEngineBaseStatExact,
  calculateWEngineSecondaryStat,
} from '../gameDataPacks/panel/wEngineGrowth'
import {
  firstPlumageStaticRecord,
  getCurrentWEngineStaticData,
} from '../gameDataPacks/currentWEngineStaticCatalog'
import type { CurrentWEnginePassiveEffect } from './currentWEnginePassiveAdapters'
import reviewedWEngineData33 from '../gameDataPacks/data/reviewed-wengine.3.3.json' with { type: 'json' }

export {
  CAGE_OF_CONFINED_SIN_STABLE_ID,
  CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS,
  CAGE_OF_CONFINED_SIN_PASSIVE_TABLE,
  cageOfConfinedSinPassiveInputSchema,
  resolveCageOfConfinedSinPassive,
  calculateCageOfConfinedSinPanel,
  type CageOfConfinedSinPassiveInput,
  type CageOfConfinedSinPassiveExclusion,
  type CageOfConfinedSinPassiveResult,
} from './reviewedCageOfConfinedSin'

export const reviewedWEngine33Identity = Object.freeze({
  family: 'reviewed_wengine_33_contracts',
  gameVersion: '3.3',
  sources: reviewedWEngineData33.items.map((item) => ({
    stableId: item.stableId,
    gameId: item.gameId,
    releaseStatus: item.releaseStatus,
    releaseAt: item.releaseAt,
    source: item.source,
  })),
  boundary: reviewedWEngineData33.boundary,
})

export const reviewedWEngine33Hash = stableContentHash(reviewedWEngine33Identity)

export const FIRST_PLUMAGE_STABLE_ID = 'wengine-14164' as const
export const TRICK_OF_CANDLEGLOW_STABLE_ID = 'wengine-13022' as const
export const TRICK_OF_CANDLEGLOW_RUNTIME_INPUT_KEYS = Object.freeze({
  exSpecialCritWindowActive: 'TrickOfCandleglow:exSpecialCritWindowActive',
  enemyHpPercent: 'TrickOfCandleglow:enemyHpPercent',
} as const)

export const FIRST_PLUMAGE_PASSIVE_TABLE: Readonly<
  Record<number, { anomProf: number; fireDamageBonus: number }>
> = Object.freeze(
  Object.fromEntries(
    firstPlumageStaticRecord.passiveParameterTable.map((row) => [
      row.refinement,
      { anomProf: row.params[0]!, fireDamageBonus: row.params[1]! },
    ]),
  ),
)

/** Initial AP is independent of whether the conditional combat window is known. */
export function resolveFirstPlumageInitialStats(input: {
  refinement: unknown
  specialtyMatches: boolean
}) {
  const parsed = z.number().int().min(1).max(5).safeParse(input.refinement)
  const item = getCurrentWEngineStaticData(FIRST_PLUMAGE_STABLE_ID)
  if (!item || !parsed.success) return unsupported(['涅槃初翎初始属性需要有效目录及明确的1至5叠。'])
  const row = item.passiveParameterTable.find((row) => row.refinement === parsed.data)
  if (!row || row.params.length !== 2 || row.params.some((value) => !Number.isFinite(value)))
    return unsupported(['涅槃初翎被动参数来源不完整。'])
  return {
    status: 'supported' as const,
    anomalyProficiency: input.specialtyMatches ? row.params[0]! : 0,
    source: item.source,
  }
}

const unsupported = (blockers: string[]) => ({
  status: 'unsupported' as const,
  blockers: [...new Set(blockers)],
})

export const firstPlumagePassiveInputSchema = z.object({
  stableId: z.literal(FIRST_PLUMAGE_STABLE_ID).optional().default(FIRST_PLUMAGE_STABLE_ID),
  refinement: z.number().int().min(1).max(5),
  specialtyMatches: z.boolean(),
  runtimePolicy: z.enum(['strict', 'exclude_unobserved']).optional(),
  teamAnomalyCritWindowActive: z.boolean().optional(),
  appliedAtSeconds: z.number().nonnegative().optional(),
  currentAtSeconds: z.number().nonnegative().optional(),
  refreshedAtSeconds: z.number().nonnegative().optional(),
  controlledSameEvent: z.boolean().optional(),
})

export type FirstPlumagePassiveInput = z.infer<typeof firstPlumagePassiveInputSchema>

export type FirstPlumagePassiveResult =
  | {
      status: 'supported'
      active: boolean
      effects: CurrentWEnginePassiveEffect[]
      exclusions: Array<{ effectIndex: 1; reasons: string[] }>
      source: NonNullable<ReturnType<typeof getCurrentWEngineStaticData>>['source']
    }
  | {
      status: 'unsupported'
      blockers: string[]
    }

const trickOfCandleglowPassiveInputSchema = z.object({
  stableId: z
    .literal(TRICK_OF_CANDLEGLOW_STABLE_ID)
    .optional()
    .default(TRICK_OF_CANDLEGLOW_STABLE_ID),
  refinement: z.number().int().min(1).max(5),
  specialtyMatches: z.boolean(),
  runtimePolicy: z.enum(['strict', 'exclude_unobserved']).optional(),
  exSpecialCritWindowActive: z.boolean().optional(),
  exSpecialActivatedAtSeconds: z.number().nonnegative().optional(),
  currentAtSeconds: z.number().nonnegative().optional(),
  refreshedAtSeconds: z.number().nonnegative().optional(),
  enemyHpPercent: z.number().min(0).max(1).optional(),
})

export type TrickOfCandleglowPassiveInput = z.infer<typeof trickOfCandleglowPassiveInputSchema>

export type TrickOfCandleglowPassiveExclusion = {
  effect: 'ex_special_crit_rate_window' | 'enemy_below_half_hp_damage_bonus'
  effectIndex: 0 | 1
  reasons: string[]
}

export type TrickOfCandleglowPassiveResult =
  | {
      status: 'supported'
      active: boolean
      effects: CurrentWEnginePassiveEffect[]
      exclusions: TrickOfCandleglowPassiveExclusion[]
      source: NonNullable<ReturnType<typeof getCurrentWEngineStaticData>>['source']
    }
  | {
      status: 'unsupported'
      blockers: string[]
    }

/**
 * Resolves the Hatch Day (破壳日) passive for 14164 (涅槃初翎).
 * - Anomaly specialty match: permanent Anomaly Proficiency [90, 99, 108, 117, 126].
 * - Team anomaly crit window: conditional Fire DMG bonus [0.40, 0.44, 0.48, 0.52, 0.56] (20s duration).
 * - Fail-closed: unknown window state is strictly unsupported (not assumed false or active true).
 * - Target is strictly 'own', never erroneously given to team.
 */
export function resolveFirstPlumagePassive(input: unknown): FirstPlumagePassiveResult {
  const parsed = firstPlumagePassiveInputSchema.safeParse(input)
  if (!parsed.success) {
    return unsupported(['涅槃初翎必须提供有效改装等级(1-5)与特性匹配状态。'])
  }

  const value = parsed.data
  const item = getCurrentWEngineStaticData(FIRST_PLUMAGE_STABLE_ID)
  if (!item) {
    return unsupported([`当前目录中缺少音擎静态数据：${FIRST_PLUMAGE_STABLE_ID}`])
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

  const initial = resolveFirstPlumageInitialStats(value)
  if (initial.status !== 'supported') return initial
  const p = item.passiveParameterTable.find((row) => row.refinement === value.refinement)?.params
  if (!p || p.length !== 2) return unsupported(['涅槃初翎被动参数来源不完整。'])

  let timedWindow: boolean | undefined
  const hasTimeline =
    value.appliedAtSeconds !== undefined ||
    value.currentAtSeconds !== undefined ||
    value.refreshedAtSeconds !== undefined
  if (
    hasTimeline &&
    !(typeof value.appliedAtSeconds === 'number' && typeof value.currentAtSeconds === 'number')
  )
    return unsupported(['时序不完整：必须同时提供 appliedAtSeconds 与 currentAtSeconds。'])
  if (typeof value.appliedAtSeconds === 'number' && typeof value.currentAtSeconds === 'number') {
    if (value.currentAtSeconds < value.appliedAtSeconds) {
      return unsupported(['时序错误：currentAtSeconds 不能早于 appliedAtSeconds。'])
    }
    let effectiveStart = value.appliedAtSeconds
    if (typeof value.refreshedAtSeconds === 'number') {
      if (
        value.refreshedAtSeconds < value.appliedAtSeconds ||
        value.currentAtSeconds < value.refreshedAtSeconds
      ) {
        return unsupported(['时序错误：refreshedAtSeconds 必须在 applied 和 current 之间。'])
      }
      effectiveStart = value.refreshedAtSeconds
    }
    const elapsed = value.currentAtSeconds - effectiveStart
    timedWindow = elapsed < 20
  }
  if (
    timedWindow !== undefined &&
    value.teamAnomalyCritWindowActive !== undefined &&
    timedWindow !== value.teamAnomalyCritWindowActive
  )
    return unsupported(['显式窗口状态与已知时序矛盾。'])
  if (timedWindow === false && value.controlledSameEvent === true)
    return unsupported(['同事件标识不能覆盖已知过期的窗口。'])
  if (value.controlledSameEvent === true && value.teamAnomalyCritWindowActive === false)
    return unsupported(['同事件标识与显式未激活状态矛盾。'])
  const isWindowActive =
    timedWindow ??
    value.teamAnomalyCritWindowActive ??
    (value.controlledSameEvent === true ? true : undefined)
  if (isWindowActive === undefined && value.runtimePolicy !== 'exclude_unobserved') {
    return unsupported(['涅槃初翎必须提供队伍异常暴击窗口状态或有效时序，未知状态不得假设。'])
  }

  const effects: CurrentWEnginePassiveEffect[] = [
    {
      target: 'own',
      stat: 'anomaly_proficiency',
      value: initial.anomalyProficiency,
    },
  ]

  if (isWindowActive) {
    effects.push({
      target: 'own',
      stat: 'damage_bonus',
      attribute: 'fire',
      value: p[1]!,
    })
  }

  return {
    status: 'supported',
    active: effects.some((e) => e.value !== 0),
    effects,
    exclusions:
      isWindowActive === undefined
        ? [{ effectIndex: 1, reasons: ['FirstPlumage:teamAnomalyCritWindowActive'] }]
        : [],
    source: item.source,
  }
}

/**
 * Resolves the Scare Hour (惊吓时刻) passive for 13022 (烛光诡计).
 * - Armorer match: the equipper gains CRIT Rate for 40s after activating EX Special.
 * - The equipper gains DMG against enemies below 50% HP; this is not a team buff.
 * - Unknown combat state is rejected or explicitly excluded by runtime policy.
 */
export function resolveTrickOfCandleglowPassive(input: unknown): TrickOfCandleglowPassiveResult {
  const parsed = trickOfCandleglowPassiveInputSchema.safeParse(input)
  if (!parsed.success) {
    return unsupported(['烛光诡计必须提供有效改装等级(1-5)与装备角色特性匹配状态。'])
  }

  const value = parsed.data
  const item = getCurrentWEngineStaticData(TRICK_OF_CANDLEGLOW_STABLE_ID)
  const p = item?.passiveParameterTable.find((row) => row.refinement === value.refinement)?.params
  if (!item || !p || p.length !== 2 || p.some((entry) => !Number.isFinite(entry))) {
    return unsupported(['烛光诡计被动参数来源不完整。'])
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
    value.exSpecialActivatedAtSeconds !== undefined ||
    value.currentAtSeconds !== undefined ||
    value.refreshedAtSeconds !== undefined
  if (
    hasTimeline &&
    !(
      typeof value.exSpecialActivatedAtSeconds === 'number' &&
      typeof value.currentAtSeconds === 'number'
    )
  ) {
    return unsupported(['烛光诡计时序不完整：必须同时提供强化特殊技发动与当前时间。'])
  }

  let timedWindow: boolean | undefined
  if (
    typeof value.exSpecialActivatedAtSeconds === 'number' &&
    typeof value.currentAtSeconds === 'number'
  ) {
    if (value.currentAtSeconds < value.exSpecialActivatedAtSeconds) {
      return unsupported(['烛光诡计时序错误：当前时间不能早于强化特殊技发动时间。'])
    }
    let effectiveStart = value.exSpecialActivatedAtSeconds
    if (typeof value.refreshedAtSeconds === 'number') {
      if (
        value.refreshedAtSeconds < value.exSpecialActivatedAtSeconds ||
        value.currentAtSeconds < value.refreshedAtSeconds
      ) {
        return unsupported(['烛光诡计时序错误：刷新时间必须位于强化特殊技发动与当前时间之间。'])
      }
      effectiveStart = value.refreshedAtSeconds
    }
    timedWindow = value.currentAtSeconds - effectiveStart < 40
  }
  if (
    timedWindow !== undefined &&
    value.exSpecialCritWindowActive !== undefined &&
    timedWindow !== value.exSpecialCritWindowActive
  ) {
    return unsupported(['烛光诡计显式暴击率窗口状态与已知时序矛盾。'])
  }

  const critWindowActive = timedWindow ?? value.exSpecialCritWindowActive
  const enemyHpPercent = value.enemyHpPercent
  const blockers = [
    ...(critWindowActive === undefined
      ? ['烛光诡计必须提供强化特殊技暴击率窗口状态或发动/当前时序。']
      : []),
    ...(enemyHpPercent === undefined ? ['烛光诡计必须提供本次伤害目标的当前生命比例。'] : []),
  ]
  if (blockers.length > 0 && value.runtimePolicy !== 'exclude_unobserved') {
    return unsupported(blockers)
  }

  const effects: CurrentWEnginePassiveEffect[] = []
  if (critWindowActive) {
    effects.push({ target: 'own', stat: 'crit_rate', value: p[0]! })
  }
  if (enemyHpPercent !== undefined && enemyHpPercent < 0.5) {
    effects.push({ target: 'own', stat: 'damage_bonus', value: p[1]! })
  }

  const exclusions: TrickOfCandleglowPassiveExclusion[] = []
  if (critWindowActive === undefined) {
    exclusions.push({
      effect: 'ex_special_crit_rate_window',
      effectIndex: 0,
      reasons: blockers.filter((blocker) => blocker.includes('暴击率窗口')),
    })
  }
  if (enemyHpPercent === undefined) {
    exclusions.push({
      effect: 'enemy_below_half_hp_damage_bonus',
      effectIndex: 1,
      reasons: blockers.filter((blocker) => blocker.includes('生命比例')),
    })
  }

  return {
    status: 'supported',
    active: effects.length > 0,
    effects,
    exclusions,
    source: item.source,
  }
}

/**
 * Calculates exact legal panel numbers for 14164 at level and ascension.
 */
export function calculateFirstPlumagePanel(level: number, ascension: number) {
  if (level < 0 || level > 60 || ascension < 0 || ascension > 5) {
    throw new Error(`Invalid level (${level}) or ascension (${ascension}) for 14164`)
  }
  const baseAttack = Math.floor(calculateWEngineBaseStatExact(48, level, ascension))
  const secondaryValue = calculateWEngineSecondaryStat(0.12, level, ascension)
  return {
    baseAttack,
    secondaryStatKey: 'anomMas_' as const,
    secondaryValue,
  }
}

/** Data-backed release gate for the 2026-11-11 current catalogue. */
export function is33WEngineReleasedInCurrentPhase(stableId: string): boolean {
  const releaseStatus = getCurrentWEngineStaticData(stableId)?.releaseStatus
  return (
    releaseStatus === 'released_first_half' ||
    releaseStatus === 'released_second_half' ||
    releaseStatus === 'released_event'
  )
}
