import { z } from 'zod'
import { currentBangbooNumericCatalog } from '../gameDataPacks/currentBangbooNumericCatalog'
import {
  definitionsByGameId,
  type AdditionalContractDefinition,
  type AdditionalEffectSpec,
} from './currentBangbooMechanicDefinitions'
import { normalizeCurrentBangbooComposition } from './currentBangbooCompositionIdentity'
import { resolveBangbooBaseUtilityOutputs } from './currentBangbooBaseUtilityContracts'
import { settleBangbooBaseUtilityCapacity } from './currentBangbooBaseUtilityCapacity'
import { evaluateBangbooSourcePropertyFormula } from './currentBangbooSourceFormula'

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
  const formula = normalized.match(/([\d.]+)\s*\+\s*(?:Bangboo\s*)?Level\s*×\s*([\d.]+)/i)
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
  ascensionLevelCap: z
    .union([
      z.literal(10),
      z.literal(20),
      z.literal(30),
      z.literal(40),
      z.literal(50),
      z.literal(60),
    ])
    .optional(),
  composition: z.record(z.string(), z.number().int().nonnegative()),
  flags: z.record(z.string(), z.boolean()).default({}),
  accumulators: z.record(z.string(), z.number().nonnegative()).default({}),
  additionalAbilityEnabled: z.boolean().default(true),
  unresolvedEventPolicy: z.enum(['reject', 'exclude']).default('reject'),
})
const activationInputSchema = inputSchema.pick({
  stableId: true,
  additionalAbilityLevel: true,
  composition: true,
})
const activationSelectionSchema = activationInputSchema.omit({ composition: true })

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
  return resolveValidatedAdditionalActivation(
    parsed.data,
    normalizeCurrentBangbooComposition(parsed.data.composition),
  )
}

/** One validated, private composition snapshot for a synchronous option batch. */
export function prepareCurrentBangbooAdditionalActivation(
  composition: Readonly<Record<string, number>>,
) {
  const parsed = activationInputSchema.shape.composition.safeParse(composition)
  const normalized = parsed.success ? normalizeCurrentBangbooComposition(parsed.data) : null
  return (selection: { stableId: string; additionalAbilityLevel: number }) => {
    const selected = activationSelectionSchema.safeParse(selection)
    if (!normalized || !selected.success) return unsupported('邦布星级或队伍构成未完整提供。')
    return resolveValidatedAdditionalActivation(selected.data, normalized)
  }
}

function resolveValidatedAdditionalActivation(
  selection: { stableId: string; additionalAbilityLevel: number },
  composition: Readonly<Record<string, number>>,
) {
  const contract = byStableId.get(selection.stableId)
  if (!contract) return unsupported(`未登记邦布：${selection.stableId}`)
  const { item, definition } = contract
  const row = item.skills.find((skill) => skill.role === 'additional_ability')?.levelParams[
    selection.additionalAbilityLevel - 1
  ]
  if (row === undefined) return unsupported(`缺少邦布附加能力参数：${item.stableId}`)
  const minimum =
    definition.conditionMinimumIndex === undefined
      ? undefined
      : parseParameterToken(row.split('|')[definition.conditionMinimumIndex] ?? '', 60)
  if (minimum === null) return unsupported(`邦布附加能力条件无法解析：${item.stableId}`)
  return {
    status: 'supported' as const,
    active: compositionActive(definition, composition, minimum),
    source: item.source,
  }
}

export function resolveCurrentBangbooMechanicContract(input: unknown) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return unsupported('必须提供邦布等级、技能等级、附加能力等级与队伍构成。')
  const ascensionLevelCap =
    parsed.data.ascensionLevelCap ?? (parsed.data.bangbooLevel === 60 ? 60 : undefined)
  if (ascensionLevelCap !== undefined && ascensionLevelCap < parsed.data.bangbooLevel)
    return unsupported('邦布突破上限不能低于当前等级。')
  const contract = byStableId.get(parsed.data.stableId)
  if (!contract) return unsupported(`未登记邦布：${parsed.data.stableId}`)
  const { item, definition } = contract
  const sourceFormulaBlockers: string[] = []
  const skillOutputs = item.skills.flatMap((skill) => {
    if (skill.role === 'additional_ability') return []
    const row = skill.levelParams[parsed.data.skillLevel - 1]
    const evaluateProperty = (propertyId: string, skillId: string) => {
      const expressions =
        row
          ?.split('|')
          .filter(
            (token) =>
              token.includes(`Prop:${propertyId}`) || token.includes(`Prop: ${propertyId}`),
          ) ?? []
      if (!expressions.length) {
        const property = item.skillProps
          .find((entry) => entry.skillId === skillId)
          ?.properties.find((entry) => entry.key === propertyId)
        if (property && (property.main !== 0 || property.growth !== 0))
          sourceFormulaBlockers.push(
            `邦布来源技能算式缺失：${item.stableId}/${skill.role}/${propertyId}`,
          )
        return null
      }
      const parts = expressions.map((expression) =>
        evaluateBangbooSourcePropertyFormula(expression, (ref, property) => {
          const value = item.skillProps
            .find((entry) => entry.skillId === ref)
            ?.properties.find((entry) => entry.key === property)
          if (!value) return null
          return ref !== skillId
            ? 0
            : (value.main + value.growth * (parsed.data.skillLevel - 1)) / 10000
        }),
      )
      if (parts.some((part) => part === null)) {
        sourceFormulaBlockers.push(
          `邦布来源技能算式无法解析：${item.stableId}/${skill.role}/${propertyId}`,
        )
        return null
      }
      return parts.reduce<number>((total, value) => total + value!, 0)
    }
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
                multiplier: evaluateProperty('1001', skillId) ?? 0,
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
                value: evaluateProperty('1002', skillId) ?? 0,
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
  if (sourceFormulaBlockers.length) return unsupported(...sourceFormulaBlockers)
  const baseUtilityOutputs = resolveBangbooBaseUtilityOutputs({
    stableId: item.stableId,
    skillLevel: parsed.data.skillLevel,
    bangbooLevel: parsed.data.bangbooLevel,
    ...(ascensionLevelCap !== undefined ? { ascensionLevelCap } : {}),
  })
  const baseOutputs = [...skillOutputs, ...baseUtilityOutputs]
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
  if (
    !parsed.data.additionalAbilityEnabled ||
    !compositionActive(definition, composition, minimumOverride)
  )
    return {
      status: 'supported' as const,
      active: baseOutputs.length > 0,
      outputs: baseOutputs,
      effectiveUtilities: baseUtilityOutputs,
      source: item.source,
    }
  const blockers: string[] = []
  const unresolvedOutputs: Array<{ mechanic: string; targetAction: string; reason: string }> = []
  const additionalOutputs = definition.effects.flatMap((spec) => {
    if (spec.requiresFlag && parsed.data.flags[spec.requiresFlag] === undefined) {
      const reason = `缺少邦布事件 flag：${spec.requiresFlag}`
      blockers.push(reason)
      unresolvedOutputs.push({ mechanic: spec.operator, targetAction: spec.targetAction, reason })
      return []
    }
    if (spec.requiresFlag && !parsed.data.flags[spec.requiresFlag]) return []
    if (spec.accumulatorKey && parsed.data.accumulators[spec.accumulatorKey] === undefined) {
      const reason = `缺少邦布累计量：${spec.accumulatorKey}`
      blockers.push(reason)
      unresolvedOutputs.push({ mechanic: spec.operator, targetAction: spec.targetAction, reason })
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
  if (blockers.length && parsed.data.unresolvedEventPolicy === 'reject')
    return unsupported(...blockers)
  return {
    status: 'supported' as const,
    active: baseOutputs.length + additionalOutputs.length > 0,
    outputs: [...baseOutputs, ...additionalOutputs],
    effectiveUtilities: settleBangbooBaseUtilityCapacity({
      baseUtilities: baseUtilityOutputs,
      activeEffects: definition.effects.filter((effect) =>
        additionalOutputs.some(
          (output) =>
            output.mechanic === effect.operator && output.targetAction === effect.targetAction,
        ),
      ),
      additionalValues: values,
      stars: parsed.data.additionalAbilityLevel,
    }),
    unresolvedOutputs,
    source: item.source,
  }
}
