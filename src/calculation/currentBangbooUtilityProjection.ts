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
import { settleBangbooBaseUtilityCapacity } from './currentBangbooBaseUtilityCapacity'
import { resolveBangbooAdditionalUtilityCapacities } from './currentBangbooAdditionalUtilityCapacity'

export function projectBangbooUtility(
  input: BangbooUtilityProjectionInput,
): BangbooUtilityProjection {
  return projectWithMembers(input)
}

/** A private member snapshot shared only by one synchronous option batch. */
function snapshotUtilityMembers(memberIds: readonly string[]) {
  return {
    memberIds: [...memberIds],
    identities: memberIds.map((id) => {
      const identity = getCurrentAgentEventContract(id)?.identity
      return identity ? { ...identity } : undefined
    }),
    names: new Map(memberIds.map((id) => [id, getAgentName(id)])),
  }
}

export function createBangbooUtilityProjector(memberIds: readonly string[]) {
  const members = snapshotUtilityMembers(memberIds)
  return (input: Omit<BangbooUtilityProjectionInput, 'memberIds'>) =>
    projectWithMembers({ ...input, memberIds: members.memberIds }, members)
}

function projectWithMembers(
  input: BangbooUtilityProjectionInput,
  members?: ReturnType<typeof snapshotUtilityMembers>,
): BangbooUtilityProjection {
  const numeric = getCurrentBangbooNumericData(input.bangbooId)
  const definition: AdditionalContractDefinition | undefined = numeric
    ? definitionsByGameId[numeric.gameId]
    : undefined
  const identities =
    members?.identities ?? input.memberIds.map((id) => getCurrentAgentEventContract(id)?.identity)

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
      effectiveUtilities: [],
      recipientFit: 'unknown',
      recommendationReason: '额外能力的适用条件待核实。',
    }
  }

  let primaryPurpose = primaryPurposeByGameId[numeric.gameId] ?? 'utility_general'
  const specialties = new Set(identities.map((identity) => identity!.specialty))
  const baseUtilities = resolveBangbooBaseUtilityOutputs({
    stableId: input.bangbooId,
    skillLevel: 10,
    bangbooLevel: 60,
    ascensionLevelCap: 60,
  })

  const additionalSkill = numeric.skills.find((skill) => skill.role === 'additional_ability')
  const paramRow = additionalSkill?.levelParams[input.stars - 1] ?? ''
  const additionalTokens = paramRow ? paramRow.split('|') : []
  const additionalValues = additionalTokens.map((t) => parseBangbooParameterToken(t, 60))

  const activeEffects: AdditionalEffectSpec[] =
    input.activationStatus === 'active'
      ? definition.effects.filter((eff) => {
          const req = onFieldSpecialties[eff.requiresFlag ?? '']
          return (
            (!req || specialties.has(req)) &&
            (!eff.requiresFlag || input.eventFlags?.[eff.requiresFlag] === true) &&
            (!eff.accumulatorKey || input.accumulators?.[eff.accumulatorKey] !== undefined)
          )
        })
      : []

  const operators = new Set<string>(activeEffects.map((e) => e.operator))
  const additionalUtilityCapacities = resolveBangbooAdditionalUtilityCapacities({
    stableId: input.bangbooId,
    stars: input.stars,
    memberIds: input.memberIds,
    active: input.activationStatus === 'active',
    eventFlags: input.eventFlags,
    chainEnemiesHit: input.chainEnemiesHit,
  })
  const effectiveUtilities = settleBangbooBaseUtilityCapacity({
    baseUtilities,
    activeEffects,
    additionalValues,
    stars: input.stars,
  })

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
    ? `可为${ordinaryEnergyRecipients.map((id) => members?.names.get(id) ?? getAgentName(id)).join('、')}补充普通能量`
    : '本队没有普通能量接收者'

  let comparableSlice: BangbooComparableSlice | undefined
  let recommendationReason: string

  // Project utilities generically from source-backed baseUtilities + additional mechanics
  if (baseUtilities.length > 0) {
    const presented = presentBangbooBaseUtilities({
      input,
      baseUtilities,
      effectiveUtilities,
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
  const purposeCapacity = additionalUtilityCapacities.filter(
    (capacity) => capacity.purpose === primaryPurpose && capacity.recipientIds.length > 0,
  )
  if (purposeCapacity.length === 1) {
    const capacity = purposeCapacity[0]!
    comparableSlice = {
      key: {
        purpose: capacity.purpose,
        unit: capacity.unit,
        receiver: capacity.receiver,
        trigger: capacity.trigger,
        isDeterministic: true,
        deliveryModel: 'one_declared_source_trigger',
        targetAction: capacity.targetAction,
        durationSeconds: capacity.durationSeconds,
        capacityBasis: JSON.stringify([
          capacity.recipientIds,
          capacity.intervalSeconds,
          capacity.enemiesHit,
        ]),
      },
      value: capacity.value,
    }
  }
  if (additionalUtilityCapacities.length) {
    const names = {
      attack_point: '点攻击力',
      energy_point: '点普通能量',
      shield_point: '点护盾',
      hp_ratio_target_hp: '角色生命上限比例',
    }
    recommendationReason += additionalUtilityCapacities
      .map(
        (capacity) =>
          `单次条件容量：${Number(capacity.value.toFixed(4))}${names[capacity.unit]}` +
          `${capacity.enemiesHit ? `（连携命中${capacity.enemiesHit}${capacity.enemiesHit === 3 ? '个及以上' : '个'}敌人）` : ''}` +
          `${capacity.recipientIds.length ? `；接受者${capacity.recipientIds.map(getAgentName).join('、')}` : '；本队无普通能量接受者'}` +
          `${capacity.durationSeconds ? `；持续${capacity.durationSeconds}秒` : ''}` +
          `${capacity.intervalSeconds ? `；${capacity.intervalSeconds}秒至多一次` : ''}。`,
      )
      .join('')
  }
  const undeclaredTriggers =
    input.activationStatus === 'active'
      ? [
          ...new Set(
            definition.effects
              .filter((effect) => {
                const specialty = onFieldSpecialties[effect.requiresFlag ?? '']
                return (
                  effect.requiresFlag &&
                  (!specialty || specialties.has(specialty)) &&
                  input.eventFlags?.[effect.requiresFlag] === undefined
                )
              })
              .map((effect) => triggerLabels[effect.requiresFlag!] ?? effect.requiresFlag!),
          ),
        ]
      : []
  if (undeclaredTriggers.length)
    recommendationReason += `待触发条件：${undeclaredTriggers.join('；')}；未计入对应战斗增益。`
  const secondaryPurposes = [
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
      ...additionalUtilityCapacities
        .filter((capacity) => capacity.recipientIds.length)
        .map((capacity) => capacity.purpose),
    ]),
  ].filter((purpose) => purpose !== primaryPurpose)
  let noApplicableUtility = false
  const explicitlyUnavailableEnergy =
    primaryPurpose === 'energy' &&
    !baseUtilities.some(
      (output) => output.utilityType === 'energy_flat' || output.utilityType === 'energy_regen',
    ) &&
    !additionalUtilityCapacities.some((output) => output.purpose === 'energy')
  if (ordinaryEnergyRecipients.length === 0 || explicitlyUnavailableEnergy) {
    if (comparableSlice?.key.purpose === 'energy') comparableSlice = undefined
    if (primaryPurpose === 'energy') {
      const otherUtility = secondaryPurposes.find(
        (purpose) =>
          purpose !== 'energy' &&
          (purpose !== 'attack_buff' || specialties.has('attack') || specialties.has('anomaly')),
      )
      const hasSourceDamage = numeric.skills.some(
        (skill) =>
          skill.role !== 'additional_ability' &&
          skill.paramRefs.some((ref) =>
            numeric.skillProps
              .find((row) => row.skillId === ref)
              ?.properties.some((property) => property.key === '1001' && property.main > 0),
          ),
      )
      primaryPurpose = otherUtility ?? (hasSourceDamage ? 'bangboo_damage' : 'utility_general')
      noApplicableUtility = !otherUtility && !hasSourceDamage
    }
  }
  const recipientFit = noApplicableUtility
    ? ('not_applicable' as const)
    : input.activationStatus === 'unknown'
      ? ('unknown' as const)
      : input.activationStatus === 'inactive'
        ? ('base_only' as const)
        : direct
          ? ('direct' as const)
          : ('general' as const)

  return {
    stableId: input.bangbooId,
    primaryPurpose,
    secondaryPurposes: secondaryPurposes.filter(
      (purpose) =>
        purpose !== primaryPurpose && (purpose !== 'energy' || ordinaryEnergyRecipients.length > 0),
    ),
    baseUtilities,
    effectiveUtilities,
    additionalUtilityCapacities,
    comparableSlice,
    recipientFit,
    recommendationReason:
      input.activationStatus === 'unknown'
        ? recommendationReason.replace('本队未激活额外能力', '额外能力条件待核实，暂未计其加成')
        : recommendationReason,
  }
}
