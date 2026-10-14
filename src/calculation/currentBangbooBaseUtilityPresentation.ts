import type { AdditionalEffectSpec } from './currentBangbooMechanicDefinitions'
import type { BangbooBaseUtilityOutput } from './currentBangbooBaseUtilityTypes'
import type {
  BangbooComparableSlice,
  BangbooUtilityProjectionInput,
} from './currentBangbooUtilityProjectionTypes'

const formatAmount = (value: number) => Number(value.toFixed(4)).toString()
class MissingUtilityParameter extends Error {}
const requiredNumber = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) throw new MissingUtilityParameter()
  return value
}

export function presentBangbooBaseUtilities(context: {
  input: BangbooUtilityProjectionInput
  baseUtilities: readonly BangbooBaseUtilityOutput[]
  effectiveUtilities: readonly BangbooBaseUtilityOutput[]
  activeEffects: readonly AdditionalEffectSpec[]
  additionalValues: readonly (number | null)[]
  specialties: ReadonlySet<string>
  ordinaryRecipientsText: string
  ruptureNote: string
}) {
  const {
    input,
    baseUtilities,
    effectiveUtilities,
    activeEffects,
    additionalValues,
    specialties,
    ordinaryRecipientsText,
    ruptureNote,
  } = context
  const requiredBase = (predicate: (output: BangbooBaseUtilityOutput) => boolean) => {
    const output = baseUtilities.find(predicate)
    if (!output) throw new MissingUtilityParameter()
    return output
  }
  const requiredEffective = (base: BangbooBaseUtilityOutput) => {
    const output = effectiveUtilities.find(
      (candidate) => candidate.targetAction === base.targetAction,
    )
    if (!output) throw new MissingUtilityParameter()
    return output
  }
  const requiredEffectNumber = (operator: AdditionalEffectSpec['operator']) => {
    const effect = activeEffects.find((item) => item.operator === operator)
    const index = effect?.valueIndices?.[0]
    return requiredNumber(
      index === undefined ? effect?.constantValues?.[0] : (additionalValues[index] ?? undefined),
    )
  }
  let comparableSlice: BangbooComparableSlice | undefined
  let recommendationReason = ''
  try {
    if (input.bangbooId === 'bangboo-butler') {
      const baseOutput = requiredBase((o) => o.utilityType === 'energy_flat')
      const baseEnergy = requiredNumber(baseOutput.value)
      const activeMultEffect = activeEffects.find(
        (eff) => eff.operator === 'energy_multiplier' && eff.targetAction === 'active',
      )
      const multIdx = activeMultEffect?.valueIndices?.[0]
      const mult =
        input.activationStatus === 'active' && multIdx !== undefined
          ? additionalValues[multIdx]
          : null

      const combinedEnergy = requiredNumber(requiredEffective(baseOutput).value)

      comparableSlice = {
        key: {
          purpose: 'energy',
          unit: 'energy_point',
          receiver: 'target_agent',
          trigger: 'tea_snack_delivered',
          isDeterministic: true,
          deliveryModel: 'target_delivery',
        },
        value: combinedEnergy,
      }

      if (input.activationStatus === 'active' && mult !== null && mult !== undefined) {
        const percentText = Math.round(mult * 100)
        recommendationReason =
          `基础技能：接收${formatAmount(baseEnergy)}点普通能量。` +
          `${input.stars}星可激活额外能力；爱心茶点送达时额外提升${percentText}%能量回复（合计回复${formatAmount(combinedEnergy)}点普通能量）；` +
          `${ordinaryRecipientsText}，收益取决于能量缺口与接收。${ruptureNote ? `${ruptureNote}。` : ''}`
      } else {
        recommendationReason =
          `基础技能：接收${formatAmount(baseEnergy)}点普通能量。` +
          `本队未激活额外能力；${ordinaryRecipientsText}，收益取决于能量缺口与接收。${ruptureNote ? `${ruptureNote}。` : ''}`
      }
    } else if (input.bangbooId === 'bangboo-booressure') {
      const baseOutput = requiredBase((o) => o.utilityType === 'energy_flat')
      const baseEnergy = requiredNumber(baseOutput.value)
      const offFieldEffect = activeEffects.find(
        (eff) =>
          eff.operator === 'energy_multiplier' && eff.targetAction === 'active:off_field_agents',
      )
      const offFieldIdx = offFieldEffect?.valueIndices?.[0]
      const offFieldMult =
        input.activationStatus === 'active' && offFieldIdx !== undefined
          ? additionalValues[offFieldIdx]
          : null

      comparableSlice = {
        key: {
          purpose: 'energy',
          unit: 'energy_point',
          receiver: 'pickup_agent',
          trigger: 'contact_ether_bubble',
          isDeterministic: true,
          deliveryModel: 'pickup_bubble',
        },
        value: baseEnergy,
      }

      if (
        input.activationStatus === 'active' &&
        offFieldMult !== null &&
        offFieldMult !== undefined
      ) {
        const percentText = Math.round(offFieldMult * 100)
        recommendationReason =
          `基础技能：接收${formatAmount(baseEnergy)}点普通能量。需实际接触生成物。` +
          `${input.stars}星可激活额外能力；为处于后场的代理人额外回复本次接触回复量的${percentText}%普通能量（仅限后场代理人，前场拾取者不叠加该倍率）；` +
          `${ordinaryRecipientsText}，收益取决于能量缺口与拾取。${ruptureNote ? `${ruptureNote}。` : ''}`
      } else {
        recommendationReason =
          `基础技能：接收${formatAmount(baseEnergy)}点普通能量。需实际接触生成物。` +
          `本队未激活额外能力；${ordinaryRecipientsText}，收益取决于能量缺口与拾取。${ruptureNote ? `${ruptureNote}。` : ''}`
      }
    } else if (input.bangbooId === 'bangboo-exploreboo') {
      const healBase = requiredBase((o) => o.branchId === 'buff_1')
      const shieldBase = requiredBase((o) => o.branchId === 'buff_2')
      const regenBase = requiredBase((o) => o.branchId === 'buff_3')

      const finalHealRatio = requiredNumber(requiredEffective(healBase).value)
      const finalShieldRatio = requiredNumber(requiredEffective(shieldBase).value)
      const finalRegenRate = requiredNumber(requiredEffective(regenBase).value)

      if (input.activationStatus === 'active') {
        recommendationReason =
          `基础技能：回复${formatAmount(requiredNumber(healBase.value) * 100)}%邦布生命值上限；提供${formatAmount(requiredNumber(shieldBase.value) * 100)}%邦布生命值上限的护盾；普通能量自动回复提高${formatAmount(requiredNumber(regenBase.value))}点/秒。` +
          `随机获得一种增益，各分支概率未公布。` +
          `${input.stars}星可激活额外能力；额外提升各分支效果（回复${formatAmount(finalHealRatio * 100)}%邦布生命上限/提供${formatAmount(finalShieldRatio * 100)}%邦布生命上限护盾/普通能量自动回复提高${formatAmount(finalRegenRate)}点/秒）；` +
          `${ordinaryRecipientsText}，收益取决于能量缺口与接收。${ruptureNote ? `${ruptureNote}。` : ''}`
      } else {
        recommendationReason =
          `基础技能：回复${formatAmount(requiredNumber(healBase.value) * 100)}%邦布生命值上限；提供${formatAmount(requiredNumber(shieldBase.value) * 100)}%邦布生命值上限的护盾；普通能量自动回复提高${formatAmount(requiredNumber(regenBase.value))}点/秒。` +
          `随机获得一种增益，各分支概率未确认。` +
          `本队未激活额外能力；${ordinaryRecipientsText}，收益取决于能量缺口与接收。${ruptureNote ? `${ruptureNote}。` : ''}`
      }
    } else if (input.bangbooId === 'bangboo-avocaboo') {
      const healBase = requiredBase((o) => o.utilityType === 'hp_restore')
      const baseRatio = requiredNumber(healBase.value)
      const effective = requiredEffective(healBase)
      const finalRatio = requiredNumber(effective.value)
      const finalTriggers = requiredNumber(effective.maxTriggersPerBattle)
      const hpBasisText =
        effective?.hpBasis === 'bangboo_max_hp' ? '邦布生命值上限' : '（生命值基准待核实）'
      if (effective?.absoluteValue !== undefined)
        comparableSlice = {
          key: {
            purpose: 'sustain',
            unit: 'hp_point',
            receiver: effective.receiver,
            trigger: effective.trigger,
            hpBasis: effective.hpBasis,
            isDeterministic: true,
            deliveryModel: 'contact_juice_pellet',
            cooldownSeconds: effective.cooldownSeconds,
            targetAction: effective.targetAction,
            capacityBasis: 'one-contact-level60-cap60-skill10',
          },
          value: effective.absoluteValue,
        }

      if (input.activationStatus === 'active') {
        recommendationReason =
          `基础技能：发射果汁弹接触角色回复生命值，技能倍率${formatAmount(finalRatio * 100)}%${hpBasisText}；每场战斗最多触发${finalTriggers}次。需实际接触生成物。` +
          `${input.stars}星可激活额外能力；恢复或护盾支援。`
      } else {
        recommendationReason =
          `基础技能：回复生命值，技能倍率${formatAmount(baseRatio * 100)}%${hpBasisText}。需实际接触生成物。` +
          `本队未激活额外能力；恢复或护盾支援。`
      }
    } else if (input.bangbooId === 'bangboo-miss-esme') {
      const bubbleBase = requiredBase((o) => o.branchId === 'spectral_bubble')
      const starBase = requiredBase((o) => o.branchId === 'twinkling_star')
      const baseBubbleRatio = requiredNumber(bubbleBase.value)
      const baseStarEnergy = requiredNumber(starBase.value)

      const effectiveBubble = requiredEffective(bubbleBase)
      const finalRatio = requiredNumber(effectiveBubble.value)
      const finalEnergy = requiredNumber(requiredEffective(starBase).value)
      const hpBasisText =
        effectiveBubble?.hpBasis === 'bangboo_max_hp' ? '邦布生命值上限' : '（生命值基准待核实）'

      if (input.activationStatus === 'active') {
        recommendationReason =
          `基础技能：连续随机召唤${requiredNumber(starBase.summonCount)}枚[幻泡]或[星莹]：接触[幻泡]回复生命值，技能倍率${formatAmount(finalRatio * 100)}%${hpBasisText}；接触[星莹]回复${formatAmount(finalEnergy)}点普通能量。星莹与幻泡生成概率随前场生命值动态变化，需实际接触。` +
          `${input.stars}星可激活额外能力；${ordinaryRecipientsText}，收益取决于能量缺口与拾取。${ruptureNote ? `${ruptureNote}。` : ''}`
      } else {
        recommendationReason =
          `基础技能：回复生命值，技能倍率${formatAmount(baseBubbleRatio * 100)}%${hpBasisText}；接收${formatAmount(baseStarEnergy)}点普通能量。` +
          `召唤分支随前场生命值变化，需实际接触。` +
          `本队未激活额外能力；${ordinaryRecipientsText}，收益取决于能量缺口与拾取。${ruptureNote ? `${ruptureNote}。` : ''}`
      }
    } else if (input.bangbooId === 'bangboo-knightboo') {
      const baseOutput = requiredBase((o) => o.utilityType === 'energy_flat')
      const perStarEnergy = requiredNumber(baseOutput.value)
      const summonCount = requiredNumber(baseOutput.summonCount)

      const atkIdx = activeEffects.find((eff) => eff.operator === 'attack_flat_formula')
        ?.valueIndices?.[0]
      const atkBuff =
        input.activationStatus === 'active' && atkIdx !== undefined
          ? additionalValues[atkIdx]
          : null

      comparableSlice = {
        key: {
          purpose: 'energy',
          unit: 'energy_point_per_summon',
          receiver: 'pickup_agent',
          trigger: 'contact_knights_star',
          isDeterministic: true,
          deliveryModel: 'pickup_summon_3',
        },
        value: perStarEnergy,
      }

      const attackCarry = specialties.has('attack') || specialties.has('anomaly')
      const attackText =
        atkBuff !== null && atkBuff !== undefined
          ? attackCarry
            ? `接触骑士之星时为输出成员提供${formatAmount(atkBuff)}点攻击增益（持续${formatAmount(requiredEffectNumber('duration_delta'))}秒）`
            : `接触骑士之星时提供${formatAmount(atkBuff)}点攻击增益，需留意输出是否依赖攻击力（持续${formatAmount(requiredEffectNumber('duration_delta'))}秒）`
          : ''

      if (input.activationStatus === 'active') {
        recommendationReason =
          `基础技能：周围召唤${summonCount}枚[骑士之星]，接触每枚回复${formatAmount(perStarEnergy)}点普通能量（共${summonCount}枚）。需实际接触生成物。` +
          `${input.stars}星可激活额外能力；${attackText ? `${attackText}；` : ''}` +
          `${ordinaryRecipientsText}，收益取决于能量缺口与拾取。${ruptureNote ? `${ruptureNote}。` : ''}`
      } else {
        recommendationReason =
          `基础技能：周围召唤${summonCount}枚[骑士之星]，接触每枚回复${formatAmount(perStarEnergy)}点普通能量（共${summonCount}枚）。需实际接触生成物。` +
          `本队未激活额外能力；${ordinaryRecipientsText}，收益取决于能量缺口与拾取。${ruptureNote ? `${ruptureNote}。` : ''}`
      }
    } else if (input.bangbooId === 'bangboo-biggest-fan') {
      const baseOutput = requiredBase((o) => o.utilityType === 'hp_restore')
      const baseHealRatio = requiredNumber(baseOutput.value)

      const atkIdx = activeEffects.find((eff) => eff.operator === 'attack_flat_formula')
        ?.valueIndices?.[0]
      const anomalyIdx = activeEffects.find((eff) => eff.operator === 'anomaly_buildup_multiplier')
        ?.valueIndices?.[0]

      const atkBuff =
        input.activationStatus === 'active' && atkIdx !== undefined
          ? additionalValues[atkIdx]
          : null
      const anomalyMult =
        input.activationStatus === 'active' && anomalyIdx !== undefined
          ? additionalValues[anomalyIdx]
          : null

      const attackCarry = specialties.has('attack') || specialties.has('anomaly')
      const attackText =
        atkBuff !== null && atkBuff !== undefined
          ? attackCarry
            ? `施放招式为输出成员提供${formatAmount(atkBuff)}点攻击增益（持续${formatAmount(requiredEffectNumber('duration_delta'))}秒）`
            : `施放招式提供${formatAmount(atkBuff)}点攻击增益，需留意输出是否依赖攻击力（持续${formatAmount(requiredEffectNumber('duration_delta'))}秒）`
          : ''

      if (input.activationStatus === 'active') {
        recommendationReason =
          `基础技能：持续基于自身生命值上限为当前操作中角色回复${formatAmount(baseHealRatio * 100)}%生命值。` +
          `${input.stars}星可激活额外能力；${attackText ? `${attackText}；` : ''}` +
          `${anomalyMult !== null && anomalyMult !== undefined ? `提高连携技异常积蓄${Math.round(anomalyMult * 100)}%。` : ''}`
      } else {
        recommendationReason =
          `基础技能：回复${formatAmount(baseHealRatio * 100)}%邦布生命值上限。` +
          `本队未激活额外能力；恢复或护盾支援。`
      }
    } else if (input.bangbooId === 'bangboo-snap') {
      const baseOutput = requiredBase((o) => o.utilityType === 'damage_bonus')
      const baseBonus = requiredNumber(baseOutput.value)
      const durationSec = requiredNumber(baseOutput.durationSeconds)
      const charges = requiredNumber(baseOutput.filmCharges)

      const healIdx = activeEffects.find((eff) => eff.operator === 'hp_restore_percent_target_hp')
        ?.valueIndices?.[0]
      const healTargetHp =
        input.activationStatus === 'active' && healIdx !== undefined
          ? additionalValues[healIdx]
          : null

      comparableSlice = {
        key: {
          purpose: 'damage_bonus',
          unit: 'damage_ratio',
          receiver: 'triggering_agent',
          trigger: 'on_dodge_counter_or_quick_assist_or_assist_follow_up',
          isDeterministic: true,
          deliveryModel: 'charge_bonus',
        },
        value: baseBonus,
      }

      if (input.activationStatus === 'active') {
        recommendationReason =
          `基础技能：触发闪避反击、快速支援或支援突击时，为触发成员提高${formatAmount(baseBonus * 100)}%伤害，持续${durationSec}秒（共${charges}枚胶卷）。` +
          `${input.stars}星可激活额外能力；${healTargetHp !== null && healTargetHp !== undefined ? `施加[巨星]状态时为目标回复${formatAmount(healTargetHp * 100)}%角色生命值上限。` : ''}`
      } else {
        recommendationReason =
          `基础技能：触发闪避反击、快速支援或支援突击时，为触发成员提高${formatAmount(baseBonus * 100)}%伤害，持续${durationSec}秒。` +
          `本队未激活额外能力；补充邦布专属效果。`
      }
    }
    if (comparableSlice) {
      const base =
        baseUtilities.find((output) => output.targetAction === comparableSlice!.key.targetAction) ??
        baseUtilities.find(
          (output) => output.utilityType === 'energy_flat' || output.utilityType === 'damage_bonus',
        )
      comparableSlice = {
        ...comparableSlice,
        key: {
          ...comparableSlice.key,
          cooldownSeconds: base?.cooldownSeconds,
          durationSeconds: base?.durationSeconds,
          targetAction: base?.targetAction,
          capacityBasis: comparableSlice.key.capacityBasis ?? 'one-source-trigger-level60-skill10',
        },
      }
    }
    return { comparableSlice, recommendationReason }
  } catch (error) {
    if (!(error instanceof MissingUtilityParameter)) throw error
    return {
      comparableSlice: undefined,
      recommendationReason: '基础技能来源参数不完整，当前无法核定数值；可保留手动选择。',
    }
  }
}
