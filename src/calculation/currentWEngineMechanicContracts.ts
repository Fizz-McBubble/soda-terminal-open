import { z } from 'zod'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import {
  emptyMechanicRuntime,
  evaluateMechanicContract,
  type MechanicContract,
  type MechanicRuntime,
} from './mechanicIr'
import {
  currentWEngineMechanicContractIds,
  flag,
  rawContracts,
  type ContractId,
} from './currentWEngineMechanicDefinitions'

export { currentWEngineMechanicContractIds } from './currentWEngineMechanicDefinitions'

export const currentWEngineMechanicContracts = Object.freeze(
  Object.fromEntries(
    currentWEngineMechanicContractIds.map((stableId) => {
      const source = getCurrentWEngineStaticData(stableId)?.source
      if (!source) throw new Error(`Mechanic Contract 缺少上游来源：${stableId}`)
      return [
        stableId,
        Object.freeze({
          ...rawContracts[stableId],
          sourceRefs: [source.formulaPath, source.dataPath],
        }),
      ]
    }),
  ) as Readonly<Record<ContractId, MechanicContract>>,
)

const inputSchema = z.object({
  stableId: z.enum(currentWEngineMechanicContractIds),
  refinement: z.number().int().min(1).max(5),
  specialtyMatches: z.boolean(),
  enemyHpPercent: z.number().min(0).max(1).optional(),
  equipperHitWindowActive: z.boolean().optional(),
  anomalyPresentOnEnemy: z.boolean().optional(),
  wearerShielded: z.boolean().optional(),
  dodgeCounterOrAssistWindowActive: z.boolean().optional(),
  exSpecialOrChainWindowActive: z.boolean().optional(),
  exSpecialLaunchStacks: z.number().int().min(0).max(4).optional(),
  basicHitWindowActive: z.boolean().optional(),
  iceDashHitWindowActive: z.boolean().optional(),
  exSpecialOrUltimateHitOccurred: z.boolean().optional(),
  secondsSincePreviousEnergyTrigger: z.number().min(0).nullable().optional(),
  energyConsumedStacks: z.number().int().min(0).max(10).optional(),
  hpDecreased: z.boolean().optional(),
  hitFromBehind: z.boolean().optional(),
  triggerOccurred: z.boolean().optional(),
  secondsSincePreviousTrigger: z.number().min(0).nullable().optional(),
  eventKind: z.enum(['dodge_counter', 'ex_special', 'assist_attack', 'chain_attack']).optional(),
  secondsSinceSameKindTrigger: z.number().min(0).nullable().optional(),
  secondsSinceAttacked: z.number().min(0).nullable().optional(),
  memberHpRatio: z.number().min(0).optional(),
  damageAttribute: z
    .enum(['physical', 'fire', 'ice', 'electric', 'ether', 'auric_ink', 'lumiflux'])
    .optional(),
  basicHeavyHitAgeSeconds: z.number().min(0).nullable().optional(),
  exSpecialHeavyHitAgeSeconds: z.number().min(0).nullable().optional(),
})

const conditionalFlagKeys = [
  'equipperHitWindowActive',
  'anomalyPresentOnEnemy',
  'wearerShielded',
  'dodgeCounterOrAssistWindowActive',
  'exSpecialOrChainWindowActive',
  'basicHitWindowActive',
  'iceDashHitWindowActive',
  'exSpecialOrUltimateHitOccurred',
  'hpDecreased',
  'hitFromBehind',
  'triggerOccurred',
] as const

export function resolveCurrentWEngineMechanicContract(inputValue: unknown) {
  const parsed = inputSchema.safeParse(inputValue)
  if (!parsed.success)
    return {
      status: 'unsupported' as const,
      blockers: ['必须提供已登记音擎、改装等级与特性匹配状态。'],
    }
  const value = parsed.data
  const item = getCurrentWEngineStaticData(value.stableId)
  const params = item?.passiveParameterTable[value.refinement - 1]?.params
  if (!item || !params)
    return {
      status: 'unsupported' as const,
      blockers: [`缺少冻结参数：${value.stableId}/P${value.refinement}`],
    }

  const flags = Object.fromEntries(
    conditionalFlagKeys.flatMap((key) => (value[key] === undefined ? [] : [[key, value[key]]])),
  ) as Record<string, boolean>
  if (value.secondsSincePreviousEnergyTrigger !== undefined)
    flags.firstEnergyTrigger = value.secondsSincePreviousEnergyTrigger === null
  if (value.secondsSincePreviousTrigger !== undefined)
    flags.firstTrigger = value.secondsSincePreviousTrigger === null
  if (value.secondsSinceSameKindTrigger !== undefined)
    flags.firstSameKindTrigger = value.secondsSinceSameKindTrigger === null
  if (value.eventKind !== undefined) {
    for (const eventKind of ['dodge_counter', 'ex_special', 'assist_attack', 'chain_attack'])
      flags[`eventKind:${eventKind}`] = value.eventKind === eventKind
  }
  if (value.secondsSinceAttacked !== undefined)
    flags.hasAttackerHitAge = value.secondsSinceAttacked !== null
  if (value.basicHeavyHitAgeSeconds !== undefined)
    flags.hasBasicHeavyHitAge = value.basicHeavyHitAgeSeconds !== null
  if (value.exSpecialHeavyHitAgeSeconds !== undefined)
    flags.hasExSpecialHeavyHitAge = value.exSpecialHeavyHitAgeSeconds !== null
  if (value.damageAttribute !== undefined)
    flags.damageAttributeIce = value.damageAttribute === 'ice'
  const runtime: MechanicRuntime = {
    ...emptyMechanicRuntime,
    flags: { specialtyMatches: value.specialtyMatches, ...flags },
    numbers: {
      ...(value.enemyHpPercent === undefined ? {} : { enemyHpPercent: value.enemyHpPercent }),
      ...(value.secondsSincePreviousEnergyTrigger === undefined ||
      value.secondsSincePreviousEnergyTrigger === null
        ? {}
        : { secondsSincePreviousEnergyTrigger: value.secondsSincePreviousEnergyTrigger }),
      ...(value.secondsSincePreviousTrigger === undefined ||
      value.secondsSincePreviousTrigger === null
        ? {}
        : { secondsSincePreviousTrigger: value.secondsSincePreviousTrigger }),
      ...(value.secondsSinceSameKindTrigger === undefined ||
      value.secondsSinceSameKindTrigger === null
        ? {}
        : { secondsSinceSameKindTrigger: value.secondsSinceSameKindTrigger }),
      ...(value.secondsSinceAttacked === undefined || value.secondsSinceAttacked === null
        ? {}
        : { secondsSinceAttacked: value.secondsSinceAttacked }),
      ...(value.memberHpRatio === undefined ? {} : { memberHpRatio: value.memberHpRatio }),
      ...(value.basicHeavyHitAgeSeconds === undefined || value.basicHeavyHitAgeSeconds === null
        ? {}
        : { basicHeavyHitAgeSeconds: value.basicHeavyHitAgeSeconds }),
      ...(value.exSpecialHeavyHitAgeSeconds === undefined ||
      value.exSpecialHeavyHitAgeSeconds === null
        ? {}
        : { exSpecialHeavyHitAgeSeconds: value.exSpecialHeavyHitAgeSeconds }),
    },
    accumulators: {
      ...(value.exSpecialLaunchStacks === undefined
        ? {}
        : { exSpecialLaunchStacks: { value: value.exSpecialLaunchStacks } }),
      ...(value.energyConsumedStacks === undefined
        ? {}
        : { energyConsumedStacks: { value: value.energyConsumedStacks } }),
    },
  }
  return evaluateMechanicContract({
    contract: {
      ...currentWEngineMechanicContracts[value.stableId],
      applicableWhen: flag('specialtyMatches'),
    },
    runtime,
    params,
  })
}
