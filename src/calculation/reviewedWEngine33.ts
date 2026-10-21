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
  if (isWindowActive === undefined) {
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

/**
 * Checks whether a 3.3 W-Engine is released in the current phase.
 * Strictly prevents 13022 (10/22) and 14163 (11/11) from opening prematurely.
 */
export function is33WEngineReleasedInCurrentPhase(stableId: string): boolean {
  return stableId === FIRST_PLUMAGE_STABLE_ID
}
