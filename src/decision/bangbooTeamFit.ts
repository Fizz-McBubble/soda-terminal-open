import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { definitionsByGameId } from '../calculation/currentBangbooMechanicDefinitions'
import { currentBangbooNumericCatalog } from '../gameDataPacks/currentBangbooNumericCatalog'

const byId = new Map(currentBangbooNumericCatalog.items.map((item) => [item.stableId, item]))
const onFieldSpecialties: Record<string, string> = {
  on_field_attack: 'attack',
  on_field_stun: 'stun',
  on_field_anomaly: 'anomaly',
}

const triggerLabels: Record<string, string> = {
  enemy_daze_above_50: '敌人失衡值超过一半时生效',
  enemy_burning_or_shocked: '敌人处于灼烧或感电时追加增益',
  enemy_organic: '对有机敌人追加增益',
  marked_enemy_defeated: '击败标记敌人后缩短冷却',
  enemy_shocked: '敌人处于感电时提升邦布伤害',
  enemy_other_attribute_anomaly: '敌人处于其他属性异常时提升邦布异常积蓄',
  on_field_attack: '强攻成员在场时提升邦布伤害',
  on_field_stun: '击破成员在场时提升邦布失衡',
  on_field_anomaly: '异常成员在场时提升邦布异常积蓄',
  agent_ultimate_used: '成员施放终结技后缩短邦布冷却',
  agent_aftershock_dealt: '成员造成追加攻击后叠加增益',
  agent_ex_special_used: '成员施放强化特殊技后叠加失衡增益',
  ex_special_stacks_at_maximum: '叠满后追加伤害增益',
  ether_veil_verdict_active: '开启对应以太帷幕后增加召唤物',
}

/** Qualitative purpose, not a damage score or a claim about rotation frequency. */
export function describeBangbooTeamFit(input: {
  memberIds: readonly string[]
  bangbooId: string
  stars: number
  activationStatus: 'active' | 'inactive' | 'unknown'
}) {
  const item = byId.get(input.bangbooId)
  const definition = item ? definitionsByGameId[item.gameId] : undefined
  const identities = input.memberIds.map((id) => getCurrentAgentEventContract(id)?.identity)
  if (
    !definition ||
    !Number.isInteger(input.stars) ||
    input.stars < 1 ||
    input.stars > 5 ||
    identities.length !== 3 ||
    new Set(input.memberIds).size !== 3 ||
    identities.some((identity) => !identity) ||
    input.activationStatus === 'unknown'
  )
    return { recipientFit: 'unknown' as const, recommendationReason: '额外能力的适用条件待核实。' }
  if (input.activationStatus === 'inactive')
    return {
      recipientFit: 'base_only' as const,
      recommendationReason: '可使用基础技能，本队未激活额外能力。',
    }
  const specialties = new Set(identities.map((identity) => identity!.specialty))
  // These branches belong to the on-field specialty, not every member of a faction.
  const effects = definition.effects.filter((effect) => {
    const required = onFieldSpecialties[effect.requiresFlag ?? '']
    return !required || specialties.has(required)
  })
  const operators = new Set<string>(effects.map((effect) => effect.operator))
  const purposes: string[] = []
  let direct = false
  if (operators.has('attack_flat_formula')) {
    const attackCarry = specialties.has('attack') || specialties.has('anomaly')
    purposes.push(attackCarry ? '为输出成员提供攻击增益' : '提供攻击增益，需留意输出是否依赖攻击力')
    direct ||= attackCarry
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
    direct ||= matchingAnomaly
  }
  if (operators.has('daze_multiplier')) {
    purposes.push('提高邦布失衡积累')
    direct ||= specialties.has('stun')
  }
  if (['energy_multiplier', 'energy_flat', 'energy_regen_flat'].some((key) => operators.has(key)))
    purposes.push('补充能量')
  if (
    [
      'hp_recovery_multiplier',
      'hp_restore_percent_target_hp',
      'shield_percent_bangboo_hp',
      'shield_generation_multiplier',
    ].some((key) => operators.has(key))
  )
    purposes.push('恢复或护盾支援')
  if (operators.has('damage_multiplier')) purposes.push('提高邦布自身伤害')
  if (!purposes.length) purposes.push('补充邦布专属效果')
  const triggers = [
    ...new Set(
      effects.flatMap((effect) => {
        if (effect.requiresFlag)
          return [triggerLabels[effect.requiresFlag] ?? '部分效果需战斗中触发']
        if (effect.accumulatorKey) return ['随邦布技能使用次数叠加增益']
        if (effect.chance !== undefined && effect.chance < 1) return ['部分效果按概率触发']
        return []
      }),
    ),
  ]
  return {
    recipientFit: direct ? ('direct' as const) : ('general' as const),
    recommendationReason: `${input.stars}星可激活额外能力；${purposes.join('、')}。${triggers.length ? `${triggers.join('；')}。` : ''}`,
  }
}

/** Activation and investment first; prefer an identified recipient at equal
 * investment. Incomparable purposes retain reviewed source order, not fake DPS. */
export function compareBangbooTeamOptions(
  left: {
    activationStatus: 'active' | 'inactive' | 'unknown'
    requiresRaisedStars: boolean
    recipientFit: string
  },
  right: {
    activationStatus: 'active' | 'inactive' | 'unknown'
    requiresRaisedStars: boolean
    recipientFit: string
  },
) {
  const activationOrder = { active: 0, inactive: 1, unknown: 2 }
  return (
    activationOrder[left.activationStatus] - activationOrder[right.activationStatus] ||
    Number(left.requiresRaisedStars) - Number(right.requiresRaisedStars) ||
    Number(right.recipientFit === 'direct') - Number(left.recipientFit === 'direct')
  )
}
