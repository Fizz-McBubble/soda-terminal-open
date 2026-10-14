import { getCurrentBangbooNumericData } from '../gameDataPacks/currentBangbooNumericCatalog'
import type { BangbooBaseUtilityOutput } from './currentBangbooBaseUtilityTypes'
import type { AdditionalEffectSpec } from './currentBangbooMechanicDefinitions'

const round = (value: number) => Math.round(value * 1e6) / 1e6

/** Conditional capacity per declared source trigger. Random branches remain separate;
 * no event frequency, pickup distribution, probability or useful resource demand is assumed. */
export function settleBangbooBaseUtilityCapacity(context: {
  baseUtilities: readonly BangbooBaseUtilityOutput[]
  activeEffects: readonly AdditionalEffectSpec[]
  additionalValues: readonly (number | null)[]
  stars: number
}): BangbooBaseUtilityOutput[] {
  const { baseUtilities, activeEffects, additionalValues, stars } = context
  const targets: Readonly<Record<string, string>> = {
    'active:contact': 'active',
    'active:delivery': 'active',
    'active:spectral_bubble': 'spectral_bubble',
    'active:twinkling_star': 'twinkling_star',
  }
  return baseUtilities.flatMap((base) => {
    const item = getCurrentBangbooNumericData(base.sourceEvidence.stableId)
    const skill = item?.skills.find((entry) => entry.role === 'additional_ability')
    const applied: AdditionalEffectSpec[] = []
    let multiplier = 0
    let delta = 0
    let triggerDelta = 0
    const target = targets[base.targetAction] ?? base.targetAction
    for (const effect of activeEffects) {
      if (effect.targetAction !== target) continue
      const values =
        effect.valueIndices?.map((index) => additionalValues[index]) ?? effect.constantValues ?? []
      if (
        values.length !== 1 ||
        values[0] === null ||
        values[0] === undefined ||
        !Number.isFinite(values[0])
      )
        continue
      const value = values[0]
      const ratioOperator =
        base.utilityType === 'hp_restore'
          ? 'hp_recovery_multiplier'
          : base.utilityType === 'shield'
            ? 'shield_generation_multiplier'
            : base.utilityType === 'energy_flat'
              ? 'energy_multiplier'
              : null
      if (effect.operator === ratioOperator) multiplier += value
      else if (base.utilityType === 'energy_regen' && effect.operator === 'energy_regen_flat')
        delta += value
      else if (base.maxTriggersPerBattle !== undefined && effect.operator === 'charge_delta')
        triggerDelta += value
      else continue
      applied.push(effect)
    }
    const value = round(base.value * (1 + multiplier) + delta)
    const output: BangbooBaseUtilityOutput = {
      ...base,
      value,
      values: [value],
      ...(base.absoluteValue !== undefined
        ? { absoluteValue: round(base.absoluteValue * (1 + multiplier)) }
        : {}),
      ...(base.maxTriggersPerBattle !== undefined
        ? { maxTriggersPerBattle: base.maxTriggersPerBattle + triggerDelta }
        : {}),
      ...(applied.length && skill
        ? {
            additionalAbilityEvidence: {
              level: stars,
              parameterPointer: `/skill/b/level/${stars}/param`,
              rawLevelParam: skill.levelParams[stars - 1]!,
              semanticSha256: skill.semanticSha256,
              operators: applied.map((effect) => effect.operator),
            },
          }
        : {}),
    }
    if (base.sourceEvidence.stableId !== 'bangboo-booressure') return [output]
    const extra = activeEffects.find(
      (effect) =>
        effect.operator === 'energy_multiplier' &&
        effect.targetAction === 'active:off_field_agents',
    )
    const index = extra?.valueIndices?.[0]
    const ratio = index === undefined ? null : additionalValues[index]
    if (ratio === null || ratio === undefined || !Number.isFinite(ratio) || !skill) return [output]
    const offFieldValue = round(base.value * ratio)
    return [
      output,
      {
        ...base,
        receiver: 'off_field_agents' as const,
        targetAction: 'active:off_field_agents',
        value: offFieldValue,
        values: [offFieldValue],
        additionalAbilityEvidence: {
          level: stars,
          parameterPointer: `/skill/b/level/${stars}/param`,
          rawLevelParam: skill.levelParams[stars - 1]!,
          semanticSha256: skill.semanticSha256,
          operators: ['energy_multiplier'],
        },
      },
    ]
  })
}
