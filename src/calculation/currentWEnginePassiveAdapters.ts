import { z } from 'zod'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { planningStaticModifierAuthority } from './planningStaticModifierAuthority'
import {
  currentWEngineMechanicContractIds,
  resolveCurrentWEngineMechanicContract,
} from './currentWEngineMechanicContracts'
import {
  currentFormulaWEngineContractIds,
  resolveCurrentFormulaWEngineContract,
} from './currentFormulaMechanicContracts'

const refinementSchema = z.number().int().min(1).max(5)
const specialtySchema = z.object({
  refinement: refinementSchema,
  specialtyMatches: z.boolean(),
})

export type CurrentWEnginePassiveEffect = {
  target: 'own' | 'team'
  stat:
    | 'attack_percent'
    | 'crit_rate'
    | 'damage_bonus'
    | 'daze_increase'
    | 'energy'
    | 'energy_regen'
    | 'hp_percent'
    | 'impact'
  value: number
  action?: 'basic' | 'dash' | 'dodge_counter' | 'ex_special' | 'ultimate'
  attribute?: 'physical' | 'fire' | 'ice' | 'electric'
}

type SupportedPassiveResult = {
  status: 'supported'
  active: boolean
  effects: CurrentWEnginePassiveEffect[]
  source: NonNullable<ReturnType<typeof getCurrentWEngineStaticData>>['source']
}

const unsupported = (blockers: string[]) => ({
  status: 'unsupported' as const,
  blockers: [...new Set(blockers)],
})

function frozenParams(stableId: string, refinement: number) {
  const item = getCurrentWEngineStaticData(stableId)
  const row = item?.passiveParameterTable[refinement - 1]
  if (!item || !row) return null
  return { item, params: row.params }
}

const unconditionalIds = [
  'wengine-12001',
  'wengine-12007',
  'wengine-12008',
  'wengine-13013',
  'wengine-13142',
] as const
type UnconditionalId = (typeof unconditionalIds)[number]

const unconditionalSchema = specialtySchema.extend({
  stableId: z.enum(unconditionalIds),
  exSpecialOrUltimateHitOccurred: z.boolean().optional(),
  secondsSincePreviousEnergyTrigger: z.number().min(0).nullable().optional(),
})

/**
 * Executes the five complete upstream sheets that have no combat conditional.
 * The semantic map lives here; every P1-P5 number is read from the existing
 * currentWEngineStaticCatalog instead of being copied into another table.
 */
export function resolveCurrentUnconditionalWEnginePassive(
  input: unknown,
): SupportedPassiveResult | ReturnType<typeof unsupported> {
  const parsed = unconditionalSchema.safeParse(input)
  if (!parsed.success) return unsupported(['必须提供已登记音擎、改装等级与特性匹配状态。'])
  const value = parsed.data
  const frozen = frozenParams(value.stableId, value.refinement)
  if (!frozen) return unsupported([`缺少冻结参数：${value.stableId}/P${value.refinement}`])
  if (!value.specialtyMatches)
    return { status: 'supported', active: false, effects: [], source: frozen.item.source }

  const p = frozen.params
  const effects: CurrentWEnginePassiveEffect[] = []
  switch (value.stableId as UnconditionalId) {
    case 'wengine-12001':
      ;(['basic', 'dash', 'dodge_counter'] as const).forEach((action) =>
        effects.push({ target: 'own', stat: 'damage_bonus', action, value: p[0]! }),
      )
      break
    case 'wengine-12007':
      effects.push({ target: 'own', stat: 'daze_increase', action: 'ex_special', value: p[0]! })
      break
    case 'wengine-12008':
      effects.push({ target: 'own', stat: 'daze_increase', value: p[0]! })
      break
    case 'wengine-13013':
      effects.push(
        { target: 'own', stat: 'attack_percent', value: p[0]! / 100 },
        { target: 'own', stat: 'damage_bonus', action: 'ex_special', value: p[1]! },
      )
      break
    case 'wengine-13142': {
      if (
        value.exSpecialOrUltimateHitOccurred === undefined ||
        value.secondsSincePreviousEnergyTrigger === undefined
      )
        return unsupported(['震元奇枢必须提供命中事件与上次能量触发的冷却历史。'])
      effects.push(
        { target: 'own', stat: 'damage_bonus', action: 'ex_special', value: p[0]! },
        { target: 'own', stat: 'damage_bonus', action: 'ultimate', value: p[0]! },
      )
      if (
        value.exSpecialOrUltimateHitOccurred &&
        (value.secondsSincePreviousEnergyTrigger === null ||
          value.secondsSincePreviousEnergyTrigger >= p[2]!)
      )
        effects.push({ target: 'own', stat: 'energy', value: p[1]! })
      break
    }
  }
  return { status: 'supported', active: true, effects, source: frozen.item.source }
}

const stateConditionalIds = [
  'wengine-13006',
  'wengine-13007',
  'wengine-13009',
  'wengine-13010',
  'wengine-13101',
  'wengine-13111',
  'wengine-13113',
  'wengine-14119',
] as const
type StateConditionalId = (typeof stateConditionalIds)[number]

const stateConditionalSchema = specialtySchema.extend({
  stableId: z.enum(stateConditionalIds),
  enemyHpPercent: z.number().min(0).max(1).optional(),
  equipperHitWindowActive: z.boolean().optional(),
  anomalyPresentOnEnemy: z.boolean().optional(),
  wearerShielded: z.boolean().optional(),
  dodgeCounterOrAssistWindowActive: z.boolean().optional(),
  exSpecialOrChainWindowActive: z.boolean().optional(),
  exSpecialLaunchStacks: z.number().int().min(0).max(4).optional(),
  basicHitWindowActive: z.boolean().optional(),
  iceDashHitWindowActive: z.boolean().optional(),
})

/**
 * Executes the shared conditional-state family from the locked upstream sheets.
 * Callers provide the already-resolved current state/window instead of letting
 * the adapter invent event timing. Numeric values remain owned by the existing
 * P1-P5 catalog.
 */
export function resolveCurrentStateConditionalWEnginePassive(
  input: unknown,
): SupportedPassiveResult | ReturnType<typeof unsupported> {
  const parsed = stateConditionalSchema.safeParse(input)
  if (!parsed.success) return unsupported(['必须提供已登记音擎、改装等级与特性匹配状态。'])
  const value = parsed.data
  const frozen = frozenParams(value.stableId, value.refinement)
  if (!frozen) return unsupported([`缺少冻结参数：${value.stableId}/P${value.refinement}`])
  if (!value.specialtyMatches)
    return { status: 'supported', active: false, effects: [], source: frozen.item.source }

  const p = frozen.params
  const effects: CurrentWEnginePassiveEffect[] = []
  switch (value.stableId as StateConditionalId) {
    case 'wengine-13006':
      if (value.enemyHpPercent === undefined)
        return unsupported(['贵重骨核必须提供当前敌方生命比例。'])
      if (value.enemyHpPercent >= p[0]!) {
        effects.push({
          target: 'own',
          stat: 'daze_increase',
          value: p[1]! + (value.enemyHpPercent >= p[2]! ? p[3]! : 0),
        })
      }
      break
    case 'wengine-13007':
      if (value.equipperHitWindowActive === undefined)
        return unsupported(['正版变身器必须提供受击增益窗口状态。'])
      effects.push({ target: 'own', stat: 'hp_percent', value: p[0]! })
      if (value.equipperHitWindowActive)
        effects.push({ target: 'own', stat: 'impact', value: p[1]! })
      break
    case 'wengine-13009':
      if (value.anomalyPresentOnEnemy === undefined)
        return unsupported(['触电唇彩必须提供敌方异常状态。'])
      if (value.anomalyPresentOnEnemy) {
        effects.push(
          { target: 'own', stat: 'attack_percent', value: p[0]! },
          { target: 'own', stat: 'damage_bonus', value: p[1]! },
        )
      }
      break
    case 'wengine-13010':
      if (value.wearerShielded === undefined) return unsupported(['兔能环必须提供持有护盾状态。'])
      effects.push({ target: 'own', stat: 'hp_percent', value: p[0]! })
      if (value.wearerShielded)
        effects.push({ target: 'own', stat: 'attack_percent', value: p[1]! })
      break
    case 'wengine-13101':
      if (value.dodgeCounterOrAssistWindowActive === undefined)
        return unsupported(['德玛拉电池Ⅱ型必须提供闪避反击或支援攻击增益窗口。'])
      effects.push({ target: 'own', stat: 'damage_bonus', attribute: 'electric', value: p[0]! })
      if (value.dodgeCounterOrAssistWindowActive)
        effects.push({ target: 'own', stat: 'energy_regen', value: p[1]! })
      break
    case 'wengine-13111':
      if (value.exSpecialOrChainWindowActive === undefined)
        return unsupported(['旋钻机-赤轴必须提供强化特殊技或连携技增益窗口。'])
      if (value.exSpecialOrChainWindowActive) {
        effects.push(
          {
            target: 'own',
            stat: 'damage_bonus',
            action: 'basic',
            attribute: 'electric',
            value: p[0]!,
          },
          {
            target: 'own',
            stat: 'damage_bonus',
            action: 'dash',
            attribute: 'electric',
            value: p[0]!,
          },
        )
      }
      break
    case 'wengine-13113':
      if (value.exSpecialLaunchStacks === undefined)
        return unsupported(['含羞恶面必须提供强化特殊技发动层数。'])
      effects.push({ target: 'own', stat: 'damage_bonus', attribute: 'ice', value: p[0]! })
      if (value.exSpecialLaunchStacks > 0)
        effects.push({
          target: 'team',
          stat: 'attack_percent',
          value: p[1]! * value.exSpecialLaunchStacks,
        })
      break
    case 'wengine-14119':
      if (value.basicHitWindowActive === undefined || value.iceDashHitWindowActive === undefined)
        return unsupported(['深海访客必须提供普攻命中与冰属性冲刺命中增益窗口。'])
      effects.push({ target: 'own', stat: 'damage_bonus', attribute: 'ice', value: p[0]! })
      if (value.basicHitWindowActive)
        effects.push({ target: 'own', stat: 'crit_rate', value: p[1]! })
      if (value.iceDashHitWindowActive)
        effects.push({ target: 'own', stat: 'crit_rate', value: p[3]! })
      break
  }
  return {
    status: 'supported',
    active: effects.some((effect) => effect.value !== 0),
    effects,
    source: frozen.item.source,
  }
}

const steelCushionSchema = specialtySchema.extend({ hitFromBehind: z.boolean() })
export function resolveSteelCushionPassive(input: unknown) {
  const parsed = steelCushionSchema.safeParse(input)
  if (!parsed.success) return unsupported(['钢铁肉垫必须提供改装等级、特性匹配和背后命中状态。'])
  const value = parsed.data
  const refinement =
    value.refinement as keyof typeof planningStaticModifierAuthority.nekomata.steelCushionPhysicalDamageByRefinement
  const authority = planningStaticModifierAuthority.nekomata
  const effects: CurrentWEnginePassiveEffect[] = value.specialtyMatches
    ? [
        {
          target: 'own',
          stat: 'damage_bonus',
          attribute: 'physical',
          value: authority.steelCushionPhysicalDamageByRefinement[refinement] / 100,
        },
        ...(value.hitFromBehind
          ? [
              {
                target: 'own' as const,
                stat: 'damage_bonus' as const,
                value: authority.steelCushionBehindDamageByRefinement[refinement] / 100,
              },
            ]
          : []),
      ]
    : []
  return { status: 'supported' as const, active: effects.length > 0, effects }
}

const grillOWispSchema = specialtySchema.extend({ hpDecreased: z.boolean() })
export function resolveGrillOWispPassive(input: unknown) {
  const parsed = grillOWispSchema.safeParse(input)
  if (!parsed.success)
    return unsupported(["Grill O'Wisp 必须提供改装等级、特性匹配和生命降低状态。"])
  const value = parsed.data
  const refinement =
    value.refinement as keyof typeof planningStaticModifierAuthority.manato.grillOWispFireDamageByRefinement
  const authority = planningStaticModifierAuthority.manato
  const effects: CurrentWEnginePassiveEffect[] = value.specialtyMatches
    ? [
        {
          target: 'own',
          stat: 'damage_bonus',
          attribute: 'fire',
          value: authority.grillOWispFireDamageByRefinement[refinement] / 100,
        },
        ...(value.hpDecreased
          ? [
              {
                target: 'own' as const,
                stat: 'crit_rate' as const,
                value: authority.grillOWispCritRateByRefinement[refinement] / 100,
              },
            ]
          : []),
      ]
    : []
  return { status: 'supported' as const, active: effects.length > 0, effects }
}

const rainforestSchema = specialtySchema.extend({
  energyConsumedStacks: z.number().int().min(0).max(10),
})
export function resolveRainforestGourmetPassive(input: unknown) {
  const parsed = rainforestSchema.safeParse(input)
  if (!parsed.success) return unsupported(['雨林饮客必须提供改装等级、特性匹配和能量消耗层数。'])
  const value = parsed.data
  const refinement =
    value.refinement as keyof typeof planningStaticModifierAuthority.piper.rainforestAttackPercentPerStackByRefinement
  const perStack =
    planningStaticModifierAuthority.piper.rainforestAttackPercentPerStackByRefinement[refinement]
  const effects: CurrentWEnginePassiveEffect[] = value.specialtyMatches
    ? [
        {
          target: 'own',
          stat: 'attack_percent',
          value: (perStack * value.energyConsumedStacks) / 100,
        },
      ]
    : []
  return {
    status: 'supported' as const,
    active: effects.some((effect) => effect.value !== 0),
    effects,
  }
}

export const currentWEnginePassiveAdapterRegistry = Object.freeze(
  Object.fromEntries(
    currentFormulaWEngineContractIds.map((stableId) => [
      stableId,
      {
        contract: 'soda-mechanic-contract/v1',
        resolver: currentWEngineMechanicContractIds.includes(
          stableId as (typeof currentWEngineMechanicContractIds)[number],
        )
          ? resolveCurrentWEngineMechanicContract
          : resolveCurrentFormulaWEngineContract,
      },
    ]),
  ),
)

export const currentWEnginePassiveAdapterIds = Object.freeze(
  Object.keys(currentWEnginePassiveAdapterRegistry),
)

export function resolveCurrentWEnginePassive(stableId: string, input: unknown) {
  const entry = currentWEnginePassiveAdapterRegistry[stableId]
  return entry
    ? entry.resolver(typeof input === 'object' && input !== null ? { ...input, stableId } : input)
    : unsupported([`音擎 ${stableId} 尚未进入本地被动适配注册表。`])
}
