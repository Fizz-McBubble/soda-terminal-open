import { z } from 'zod'
import { currentBangbooNumericCatalog } from '../gameDataPacks/currentBangbooNumericCatalog'
import {
  definitionsByGameId,
  type AdditionalContractDefinition,
  type AdditionalEffectSpec,
} from './currentBangbooMechanicDefinitions'
import { normalizeCurrentBangbooComposition } from './currentBangbooCompositionIdentity'

const byStableId = new Map(
  currentBangbooNumericCatalog.items.map((item) => {
    const definition = definitionsByGameId[item.gameId]
    if (!definition) throw new Error(`缺少邦布附加能力声明式合同：${item.gameId}`)
    return [item.stableId, { item, definition }] as const
  }),
)

if (Object.keys(definitionsByGameId).length !== 41 || byStableId.size !== 41)
  throw new Error('邦布 Mechanic Contract 必须覆盖 41 个 3.1 Phase II 实体。')

export const currentBangbooMechanicContractIds = Object.freeze([...byStableId.keys()])

export function getCurrentBangbooContractRequirements(stableId: string) {
  const contract = byStableId.get(stableId)
  if (!contract) return null
  const { definition } = contract
  return {
    compositionKeys: [
      ...(definition.allOf?.map((entry) => entry.key) ?? []),
      ...(definition.anyOf?.map((entry) => entry.key) ?? []),
      ...(definition.agentPresent ? [definition.agentPresent] : []),
    ],
    flags: definition.effects.flatMap((entry) => (entry.requiresFlag ? [entry.requiresFlag] : [])),
    accumulators: definition.effects.flatMap((entry) =>
      entry.accumulatorKey ? [entry.accumulatorKey] : [],
    ),
  }
}

function parseParameterToken(token: string, bangbooLevel: number) {
  const normalized = token.replaceAll('[', '').replaceAll(']', '').trim()
  const formula = normalized.match(/([\d.]+)\s*\+\s*Bangboo Level\s*×\s*([\d.]+)/i)
  if (formula) return Number(formula[1]) + bangbooLevel * Number(formula[2])
  const number = Number(normalized.match(/[\d.]+/)?.[0])
  if (!Number.isFinite(number)) return null
  return normalized.includes('%') ? number / 100 : number
}

const inputSchema = z.object({
  stableId: z.string(),
  skillLevel: z.number().int().min(1).max(10),
  additionalAbilityLevel: z.number().int().min(1).max(5),
  bangbooLevel: z.number().int().min(1).max(60),
  composition: z.record(z.string(), z.number().int().nonnegative()),
  flags: z.record(z.string(), z.boolean()).default({}),
  accumulators: z.record(z.string(), z.number().nonnegative()).default({}),
})
const activationInputSchema = inputSchema.pick({
  stableId: true,
  additionalAbilityLevel: true,
  composition: true,
})

const unsupported = (...blockers: string[]) => ({
  status: 'unsupported' as const,
  blockers: [...new Set(blockers)],
})

function sharedOperatorFor(spec: AdditionalEffectSpec) {
  if (
    [
      'duration_delta',
      'charge_delta',
      'cooldown_delta',
      'extra_hits',
      'summon_count',
      'guarantee',
    ].includes(spec.operator)
  )
    return 'event_schedule_mutate' as const
  if (
    [
      'hp_recovery_multiplier',
      'shield_generation_multiplier',
      'energy_multiplier',
      'energy_flat',
      'energy_regen_flat',
      'shield_percent_bangboo_hp',
      'hp_restore_percent_target_hp',
    ].includes(spec.operator)
  )
    return 'resource_and_sustain_apply' as const
  return 'scoped_modifier_apply' as const
}

function compositionActive(
  definition: AdditionalContractDefinition,
  composition: Readonly<Record<string, number>>,
  minimumOverride?: number,
) {
  if (definition.agentPresent && (composition[definition.agentPresent] ?? 0) < 1) return false
  if (
    definition.allOf?.some(
      (requirement) =>
        (composition[requirement.key] ?? 0) < (minimumOverride ?? requirement.minimum),
    )
  )
    return false
  if (
    definition.anyOf &&
    !definition.anyOf.some(
      (requirement) => (composition[requirement.key] ?? 0) >= requirement.minimum,
    )
  )
    return false
  return true
}

/** Additional-ability composition only; base skill damage and event flags are not activation proof. */
export function resolveCurrentBangbooAdditionalActivation(input: {
  stableId: string
  additionalAbilityLevel: number
  composition: Readonly<Record<string, number>>
}) {
  const parsed = activationInputSchema.safeParse(input)
  if (!parsed.success) return unsupported('邦布星级或队伍构成未完整提供。')
  const contract = byStableId.get(parsed.data.stableId)
  if (!contract) return unsupported(`未登记邦布：${parsed.data.stableId}`)
  const { item, definition } = contract
  const row = item.skills.find((skill) => skill.role === 'additional_ability')?.levelParams[
    parsed.data.additionalAbilityLevel - 1
  ]
  if (row === undefined) return unsupported(`缺少邦布附加能力参数：${item.stableId}`)
  const minimum =
    definition.conditionMinimumIndex === undefined
      ? undefined
      : parseParameterToken(row.split('|')[definition.conditionMinimumIndex] ?? '', 60)
  if (minimum === null) return unsupported(`邦布附加能力条件无法解析：${item.stableId}`)
  return {
    status: 'supported' as const,
    active: compositionActive(
      definition,
      normalizeCurrentBangbooComposition(parsed.data.composition),
      minimum,
    ),
    source: item.source,
  }
}

export function resolveCurrentBangbooMechanicContract(input: unknown) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return unsupported('必须提供邦布等级、技能等级、附加能力等级与队伍构成。')
  const contract = byStableId.get(parsed.data.stableId)
  if (!contract) return unsupported(`未登记邦布：${parsed.data.stableId}`)
  const { item, definition } = contract
  const skillOutputs = item.skills.flatMap((skill) => {
    if (skill.role === 'additional_ability') return []
    return skill.paramRefs.flatMap((skillId) => {
      const props = item.skillProps.find((entry) => entry.skillId === skillId)
      if (!props) return []
      const damage = props.properties.find((entry) => entry.key === '1001')
      const daze = props.properties.find((entry) => entry.key === '1002')
      return [
        ...(damage
          ? [
              {
                operator: 'damage_event_emit' as const,
                owner: 'bangboo' as const,
                action: skill.role,
                scalingStat: 'attack' as const,
                multiplier: (damage.main + damage.growth * (parsed.data.skillLevel - 1)) / 10000,
              },
            ]
          : []),
        ...(daze
          ? [
              {
                operator: 'scoped_modifier_apply' as const,
                target: 'enemy' as const,
                stat: 'daze',
                action: skill.role,
                value: (daze.main + daze.growth * (parsed.data.skillLevel - 1)) / 10000,
              },
            ]
          : []),
        {
          operator: 'scoped_modifier_apply' as const,
          target: 'enemy' as const,
          stat: 'anomaly_buildup',
          action: skill.role,
          value: props.elementAccumulationValue / 10000,
        },
      ]
    })
  })
  const additionalSkill = item.skills.find((skill) => skill.role === 'additional_ability')
  const parameterRow = additionalSkill?.levelParams[parsed.data.additionalAbilityLevel - 1]
  if (!additionalSkill || parameterRow === undefined)
    return unsupported(`缺少邦布附加能力参数：${item.stableId}`)
  const values = parameterRow
    .split('|')
    .map((token) => parseParameterToken(token, parsed.data.bangbooLevel))
  if (values.some((value) => value === null))
    return unsupported(`邦布附加能力参数无法解析：${item.stableId}`)
  const minimumOverride =
    definition.conditionMinimumIndex === undefined
      ? undefined
      : (values[definition.conditionMinimumIndex] ?? undefined)
  const composition = normalizeCurrentBangbooComposition(parsed.data.composition)
  if (!compositionActive(definition, composition, minimumOverride))
    return {
      status: 'supported' as const,
      active: skillOutputs.length > 0,
      outputs: skillOutputs,
      source: item.source,
    }
  const blockers: string[] = []
  const additionalOutputs = definition.effects.flatMap((spec) => {
    if (spec.requiresFlag && parsed.data.flags[spec.requiresFlag] === undefined) {
      blockers.push(`缺少邦布事件 flag：${spec.requiresFlag}`)
      return []
    }
    if (spec.requiresFlag && !parsed.data.flags[spec.requiresFlag]) return []
    if (spec.accumulatorKey && parsed.data.accumulators[spec.accumulatorKey] === undefined) {
      blockers.push(`缺少邦布累计量：${spec.accumulatorKey}`)
      return []
    }
    return [
      {
        operator: sharedOperatorFor(spec),
        mechanic: spec.operator,
        targetAction: spec.targetAction,
        values: [
          ...(spec.valueIndices ?? []).map((index) => values[index]!),
          ...(spec.constantValues ?? []),
        ],
        ...(spec.chance === undefined ? {} : { chance: spec.chance }),
        ...(spec.maximum === undefined ? {} : { maximum: spec.maximum }),
        ...(spec.intervalSeconds === undefined ? {} : { intervalSeconds: spec.intervalSeconds }),
        ...(spec.accumulatorKey
          ? { accumulator: parsed.data.accumulators[spec.accumulatorKey] }
          : {}),
      },
    ]
  })
  if (blockers.length) return unsupported(...blockers)
  return {
    status: 'supported' as const,
    active: skillOutputs.length + additionalOutputs.length > 0,
    outputs: [...skillOutputs, ...additionalOutputs],
    source: item.source,
  }
}
