import {
  onFieldSpecialties,
  triggerLabels,
  primaryPurposeByGameId,
} from './currentBangbooUtilityProjectionTypes'
import type {
  BangbooComparableSlice,
  BangbooUtilityProjectionInput,
  BangbooUtilityProjection,
  BangbooUtilityPurpose,
} from './currentBangbooUtilityProjectionTypes'
import { presentBangbooBaseUtilities } from './currentBangbooBaseUtilityPresentation'
import { projectBangbooFixedUtilityCapacity } from './currentBangbooFixedUtilityCapacity'
import { parseBangbooParameterToken as parseSourceParameter } from './currentBangbooBaseUtilityContracts'
export const parseBangbooParameterToken = (token: string, level = 60) =>
  parseSourceParameter(token, level)
export type * from './currentBangbooUtilityProjectionTypes'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  definitionsByGameId,
  type AdditionalContractDefinition,
  type AdditionalEffectSpec,
} from './currentBangbooMechanicDefinitions'
import { getCurrentBangbooNumericData } from '../gameDataPacks/currentBangbooNumericCatalog'
import { getAgentName } from '../assault/catalog'
import { resolveBangbooBaseUtilityOutputs } from './currentBangbooBaseUtilityContracts'

export function projectBangbooUtility(
  input: BangbooUtilityProjectionInput,
): BangbooUtilityProjection {
  const numeric = getCurrentBangbooNumericData(input.bangbooId)
  const definition: AdditionalContractDefinition | undefined = numeric
    ? definitionsByGameId[numeric.gameId]
    : undefined
  const identities = input.memberIds.map((id) => getCurrentAgentEventContract(id)?.identity)

  if (
    !numeric ||
    !definition ||
    !Number.isInteger(input.stars) ||
    input.stars < 1 ||
    input.stars > 5 ||
    identities.length !== 3 ||
    new Set(input.memberIds).size !== 3 ||
    identities.some((identity) => !identity)
  ) {
    return {
      stableId: input.bangbooId,
      primaryPurpose: 'utility_general',
      secondaryPurposes: [],
      baseUtilities: [],
      recipientFit: 'unknown',
      recommendationReason: '额外能力的适用条件待核实。',
    }
  }

  const primaryPurpose = primaryPurposeByGameId[numeric.gameId] ?? 'utility_general'
  const specialties = new Set(identities.map((identity) => identity!.specialty))
  const baseUtilities = resolveBangbooBaseUtilityOutputs({
    stableId: input.bangbooId,
    skillLevel: 10,
    bangbooLevel: 60,
  })

  const additionalSkill = numeric.skills.find((skill) => skill.role === 'additional_ability')
  const paramRow = additionalSkill?.levelParams[input.stars - 1] ?? ''
  const additionalTokens = paramRow ? paramRow.split('|') : []
  const additionalValues = additionalTokens.map((t) => parseBangbooParameterToken(t, 60))

  const activeEffects: AdditionalEffectSpec[] =
    input.activationStatus === 'active'
      ? definition.effects.filter((eff) => {
          const req = onFieldSpecialties[eff.requiresFlag ?? '']
          return !req || specialties.has(req)
        })
      : []

  const operators = new Set<string>(activeEffects.map((e) => e.operator))

  let direct = false
  if (operators.has('attack_flat_formula')) {
    direct ||= specialties.has('attack') || specialties.has('anomaly')
  }
  if (operators.has('anomaly_buildup_multiplier')) {
    const attributeKeys = [...(definition.allOf ?? []), ...(definition.anyOf ?? [])]
      .map((condition) => condition.key)
      .filter((key) => key.startsWith('attribute:'))
    direct ||= identities.some(
      (identity) =>
        identity!.specialty === 'anomaly' &&
        (!attributeKeys.length || attributeKeys.includes(`attribute:${identity!.attribute}`)),
    )
  }
  if (operators.has('daze_multiplier')) {
    direct ||= specialties.has('stun')
  }

  const ordinaryEnergyRecipients = input.memberIds.filter(
    (_, index) => identities[index]!.specialty !== 'rupture',
  )
  const hasRupture = specialties.has('rupture')
  const ruptureNote = hasRupture ? '不能补充命破成员的闪能' : ''
  const ordinaryRecipientsText = ordinaryEnergyRecipients.length
    ? `可为${ordinaryEnergyRecipients.map(getAgentName).join('、')}补充普通能量`
    : '本队没有普通能量接收者'

  let comparableSlice: BangbooComparableSlice | undefined
  let recommendationReason: string

  // Project utilities generically from source-backed baseUtilities + additional mechanics
  if (baseUtilities.length > 0) {
    const presented = presentBangbooBaseUtilities({
      input,
      baseUtilities,
      activeEffects,
      additionalValues,
      specialties,
      ordinaryRecipientsText,
      ruptureNote,
    })
    comparableSlice = presented.comparableSlice
    recommendationReason = presented.recommendationReason
  } else {
    // Other 33 Bangboo without base utility contracts
    const purposes: string[] = []
    const triggers: string[] = []

    if (operators.has('attack_flat_formula')) {
      const attackCarry = specialties.has('attack') || specialties.has('anomaly')
      purposes.push(
        attackCarry ? '为输出成员提供攻击增益' : '提供攻击增益，需留意输出是否依赖攻击力',
      )
    }
    if (operators.has('anomaly_buildup_multiplier')) {
      const attributeKeys = [...(definition.allOf ?? []), ...(definition.anyOf ?? [])]
        .map((condition) => condition.key)
        .filter((key) => key.startsWith('attribute:'))
      const matchingAnomaly = identities.some(
        (identity) =>
          identity!.specialty === 'anomaly' &&
          (!attributeKeys.length || attributeKeys.includes(`attribute:${identity!.attribute}`)),
      )
      purposes.push(matchingAnomaly ? '以邦布异常积蓄配合异常成员' : '补充邦布异常积蓄')
    }
    if (operators.has('daze_multiplier')) {
      purposes.push('提高邦布失衡积累')
    }
    if (operators.has('damage_multiplier')) {
      purposes.push('提高邦布自身伤害')
    }
    if (operators.has('shield_percent_bangboo_hp')) {
      purposes.push('恢复或护盾支援')
    }
    if (operators.has('energy_flat')) {
      purposes.push(`${ordinaryRecipientsText}，收益取决于能量缺口与触发`)
      if (hasRupture) purposes.push(ruptureNote)
    }

    for (const effect of activeEffects) {
      if (effect.requiresFlag) {
        triggers.push(triggerLabels[effect.requiresFlag] ?? '部分效果需战斗中触发')
      }
      if (effect.accumulatorKey) {
        triggers.push('随邦布技能使用次数叠加增益')
      }
      if (effect.chance !== undefined && effect.chance < 1) {
        triggers.push('部分效果按概率触发')
      }
    }

    const uniqueTriggers = [...new Set(triggers)]

    if (!purposes.length) {
      purposes.push(input.activationStatus === 'active' ? '补充邦布专属效果' : '可使用基础技能')
    }

    recommendationReason =
      input.activationStatus === 'active'
        ? `${input.stars}星可激活额外能力；${purposes.join('、')}${purposes.length ? '。' : ''}${uniqueTriggers.length ? `${uniqueTriggers.join('；')}。` : ''}`
        : `本队未激活额外能力；${purposes.join('、')}${purposes.length ? '。' : ''}`
  }

  if (!baseUtilities.length) {
    comparableSlice = projectBangbooFixedUtilityCapacity(input, primaryPurpose, definition)
    if (comparableSlice)
      recommendationReason +=
        '同用途按一次主动与一次连携的来源基础量及已明确加成比较；未声明的战斗触发不计入，不代表实战总收益。'
  }
  const recipientFit =
    input.activationStatus === 'unknown'
      ? ('unknown' as const)
      : input.activationStatus === 'inactive'
        ? ('base_only' as const)
        : direct
          ? ('direct' as const)
          : ('general' as const)

  return {
    stableId: input.bangbooId,
    primaryPurpose,
    secondaryPurposes: [
      ...new Set<BangbooUtilityPurpose>([
        ...baseUtilities.map(
          (output): BangbooUtilityPurpose =>
            output.utilityType === 'energy_flat' || output.utilityType === 'energy_regen'
              ? 'energy'
              : output.utilityType === 'damage_bonus'
                ? 'damage_bonus'
                : 'sustain',
        ),
        ...(operators.has('attack_flat_formula') ? ['attack_buff' as const] : []),
      ]),
    ].filter((purpose) => purpose !== primaryPurpose),
    baseUtilities,
    comparableSlice,
    recipientFit,
    recommendationReason:
      input.activationStatus === 'unknown'
        ? recommendationReason.replace('本队未激活额外能力', '额外能力条件待核实，暂未计其加成')
        : recommendationReason,
  }
}
