import {
  currentBangbooNumericCatalog,
  projectCurrentBangbooStats,
} from '../gameDataPacks/currentBangbooNumericCatalog'
import { resolveReviewedBangbooRecoveryBinding } from '../gameDataPacks/reviewedBangbooRecoverySemantics'

export type * from './currentBangbooBaseUtilityTypes'
import type {
  BangbooBaseUtilityEntityDefinition,
  BangbooBaseUtilityOutput,
  ResolveBangbooBaseUtilityInput,
} from './currentBangbooBaseUtilityTypes'

export function parseBangbooParameterToken(token: string, bangbooLevel: number): number | null {
  const normalized = token.replaceAll('[', '').replaceAll(']', '').trim()
  const formula = normalized.match(/([\d.]+)\s*\+\s*(?:Bangboo\s*)?Level\s*×\s*([\d.]+)/i)
  if (formula) {
    const rawValue = Number(formula[1]) + bangbooLevel * Number(formula[2])
    return Math.round(rawValue * 1e6) / 1e6
  }
  const numberMatch = normalized.match(/[\d.]+/)?.[0]
  if (!numberMatch) return null
  const number = Number(numberMatch)
  if (!Number.isFinite(number)) return null
  const finalValue = normalized.includes('%') ? number / 100 : number
  return Math.round(finalValue * 1e6) / 1e6
}

export const bangbooBaseUtilityDefinitions: readonly BangbooBaseUtilityEntityDefinition[] = [
  {
    stableId: 'bangboo-exploreboo',
    gameId: '53003',
    playerName: '寻宝布',
    englishName: 'Exploreboo',
    skillName: '改型以太探测器',
    descriptionSnippet:
      '招式发动时，对附近地面进行探测与挖掘，完成时将基于自身属性值对角色施加随机增益效果：增益1：回复生命值；增益2：提供护盾值；增益3：能量自动回复提升。',
    cooldownSeconds: 16,
    durationSeconds: 12,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'hp_restore',
        unit: 'hp_ratio_bangboo_hp',
        hpBasis: 'bangboo_max_hp',
        mechanic: 'hp_restore_percent_bangboo_hp',
        targetAction: 'active:buff_1',
        receiver: 'on_field_agent',
        targetRestriction: 'none',
        trigger: 'active_exploration_complete',
        capacityOnly: true,
        branchId: 'buff_1',
        branchSelection: 'random_exclusive_three',
        branchDescription: '增益1：回复生命值（独立随机分支，不得假设1/3伪平均）',
        probabilityUnstated: true,
        durationIndex: 3,
        cooldownIndex: 4,
      },
      {
        paramIndex: 1,
        utilityType: 'shield',
        unit: 'shield_ratio_bangboo_hp',
        mechanic: 'shield_percent_bangboo_hp',
        targetAction: 'active:buff_2',
        receiver: 'on_field_agent',
        targetRestriction: 'none',
        trigger: 'active_exploration_complete',
        capacityOnly: true,
        branchId: 'buff_2',
        branchSelection: 'random_exclusive_three',
        branchDescription: '增益2：提供护盾值（独立随机分支，不得假设1/3伪平均）',
        probabilityUnstated: true,
        durationIndex: 3,
        cooldownIndex: 4,
      },
      {
        paramIndex: 2,
        utilityType: 'energy_regen',
        unit: 'energy_point_per_second',
        mechanic: 'energy_regen_flat',
        targetAction: 'active:buff_3',
        receiver: 'on_field_agent',
        targetRestriction: 'standard_energy_only',
        trigger: 'active_exploration_complete',
        capacityOnly: true,
        branchId: 'buff_3',
        branchSelection: 'random_exclusive_three',
        branchDescription:
          '增益3：能量自动回复提升（独立每秒恢复速率，不得等同普通回能，不得假设1/3伪平均）',
        probabilityUnstated: true,
        durationIndex: 3,
        cooldownIndex: 4,
      },
    ],
  },
  {
    stableId: 'bangboo-avocaboo',
    gameId: '53008',
    playerName: '果核布',
    englishName: 'Avocaboo',
    skillName: '甜甜甘露',
    descriptionSnippet:
      '招式发动时，向场上角色发射果汁弹，果汁弹未命中目标时将在地面停留一段时间；角色接触果汁弹时，可以为自身回复生命值，每场战斗中最多触发15次。',
    cooldownSeconds: 20,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'hp_restore',
        unit: 'hp_ratio_bangboo_hp',
        hpBasis: 'bangboo_max_hp',
        mechanic: 'hp_restore_percent_bangboo_hp',
        targetAction: 'active:contact',
        receiver: 'pickup_agent',
        targetRestriction: 'none',
        trigger: 'contact_juice_pellet',
        capacityOnly: true,
        maxTriggersPerBattle: 15,
        cooldownIndex: 1,
      },
    ],
  },
  {
    stableId: 'bangboo-booressure',
    gameId: '53012',
    playerName: '气压布',
    englishName: 'Booressure',
    skillName: '以太空泡',
    descriptionSnippet: '招式发动时，吹出以太气泡，以太气泡接触角色时，可以为其回复能量值。',
    cooldownSeconds: 26,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'energy_flat',
        unit: 'energy_point',
        mechanic: 'energy_flat',
        targetAction: 'active:contact',
        receiver: 'pickup_agent',
        targetRestriction: 'standard_energy_only',
        trigger: 'contact_ether_bubble',
        capacityOnly: true,
        cooldownIndex: 1,
      },
    ],
  },
  {
    stableId: 'bangboo-knightboo',
    gameId: '53017',
    playerName: '骑士布',
    englishName: 'Knightboo',
    skillName: '骑士，蓄力能量！',
    descriptionSnippet:
      '招式发动时，骑乘白蹦蹦连续跳跃，并在周围召唤出3枚[骑士之星]；角色接触[骑士之星]时，可以为自身回复能量值。',
    cooldownSeconds: 24,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'energy_flat',
        unit: 'energy_point',
        mechanic: 'energy_flat',
        targetAction: 'active:knights_star',
        receiver: 'pickup_agent',
        targetRestriction: 'standard_energy_only',
        trigger: 'contact_knights_star',
        capacityOnly: true,
        summonCount: 3,
        cooldownIndex: 1,
      },
    ],
  },
  {
    stableId: 'bangboo-butler',
    gameId: '54004',
    playerName: '巴特勒',
    englishName: 'Butler',
    skillName: '茶歇时间',
    descriptionSnippet:
      '招式发动时，立即着手制作爱心茶点，茶点完成并送达时，可以为目标角色回复能量值。',
    cooldownSeconds: 24,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'energy_flat',
        unit: 'energy_point',
        mechanic: 'energy_flat',
        targetAction: 'active:delivery',
        receiver: 'target_agent',
        targetRestriction: 'standard_energy_only',
        trigger: 'tea_snack_delivered',
        capacityOnly: true,
        cooldownIndex: 1,
      },
    ],
  },
  {
    stableId: 'bangboo-biggest-fan',
    gameId: '54010',
    playerName: '阿饭',
    englishName: 'Biggest Fan',
    skillName: '我推的天使',
    descriptionSnippet:
      '招式发动时，阿饭会进行应援，持续基于自身生命值上限为当前操作中角色回复生命值。',
    cooldownSeconds: 24,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'hp_restore',
        unit: 'hp_ratio_bangboo_hp',
        hpBasis: 'bangboo_max_hp',
        mechanic: 'hp_restore_percent_bangboo_hp',
        targetAction: 'active:channel',
        receiver: 'on_field_agent',
        targetRestriction: 'none',
        trigger: 'active_cheering_channel',
        capacityOnly: true,
        cooldownIndex: 1,
      },
    ],
  },
  {
    stableId: 'bangboo-snap',
    gameId: '54015',
    playerName: '咔嚓仔',
    englishName: 'Snap',
    skillName: '咔嚓！看镜头！',
    descriptionSnippet:
      '招式发动时，擦拭镜头，获得3枚[胶卷]；咔嚓仔持有[胶卷]期间，代理人发动[闪避反击]、[快速支援]、[支援突击]时，咔嚓仔会消耗1枚[胶卷]进行抓拍，为代理人施加[巨星]状态，使代理人造成的伤害提升，持续10秒。',
    cooldownSeconds: 22,
    durationSeconds: 10,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'damage_bonus',
        unit: 'damage_ratio',
        mechanic: 'agent_damage_multiplier',
        targetAction: 'active:superstar',
        receiver: 'triggering_agent',
        targetRestriction: 'none',
        trigger: 'on_dodge_counter_or_quick_assist_or_assist_follow_up',
        capacityOnly: true,
        filmCharges: 3,
        durationSeconds: 10,
        cooldownIndex: 1,
      },
    ],
  },
  {
    stableId: 'bangboo-miss-esme',
    gameId: '54018',
    playerName: '艾丝弥小姐',
    englishName: 'Miss Esme',
    skillName: '星光变身',
    descriptionSnippet:
      '招式发动时，变身进入飞行状态，连续随机召唤出3枚[幻泡]或[星莹]：角色接触[幻泡]时，可以为自身回复生命值；角色接触[星莹]时，可以为自身回复能量值；前场代理人当前生命值百分比越高，艾丝弥小姐召唤[星莹]的概率越高。',
    cooldownSeconds: 30,
    effects: [
      {
        paramIndex: 0,
        utilityType: 'hp_restore',
        unit: 'hp_ratio_bangboo_hp',
        hpBasis: 'bangboo_max_hp',
        mechanic: 'hp_restore_percent_bangboo_hp',
        targetAction: 'active:spectral_bubble',
        receiver: 'pickup_agent',
        targetRestriction: 'none',
        trigger: 'contact_spectral_bubble',
        capacityOnly: true,
        branchId: 'spectral_bubble',
        branchSelection: 'health_weighted_random_per_item',
        branchDescription:
          '接触[幻泡]回复生命值（连续随机召唤3枚[幻泡]或[星莹]，前场血量越高星莹概率越高幻泡概率越低，动态概率未结算，不得假设各1/2）',
        probabilityDynamic: true,
        summonCount: 3,
        cooldownIndex: 2,
      },
      {
        paramIndex: 1,
        utilityType: 'energy_flat',
        unit: 'energy_point',
        mechanic: 'energy_flat',
        targetAction: 'active:twinkling_star',
        receiver: 'pickup_agent',
        targetRestriction: 'standard_energy_only',
        trigger: 'contact_twinkling_star',
        capacityOnly: true,
        branchId: 'twinkling_star',
        branchSelection: 'health_weighted_random_per_item',
        branchDescription:
          '接触[星莹]回复能量值（连续随机召唤3枚[幻泡]或[星莹]，前场血量越高星莹概率越高，动态概率未结算，普通能量独立，不得给命破成员当闪能）',
        probabilityDynamic: true,
        summonCount: 3,
        cooldownIndex: 2,
      },
    ],
  },
] as const

const definitionsByStableId = new Map(
  bangbooBaseUtilityDefinitions.map((def) => [def.stableId, def] as const),
)

const catalogItemsByStableId = new Map(
  currentBangbooNumericCatalog.items.map((item) => [item.stableId, item] as const),
)

export function isBangbooBaseUtilitySupported(stableId: string): boolean {
  return definitionsByStableId.has(stableId)
}

export const bangbooBaseUtilitySupportedStableIds: readonly string[] = Object.freeze(
  bangbooBaseUtilityDefinitions.map((d) => d.stableId),
)

export function resolveBangbooBaseUtilityOutputs(
  input: ResolveBangbooBaseUtilityInput,
): BangbooBaseUtilityOutput[] {
  const definition = definitionsByStableId.get(input.stableId)
  if (!definition) return []
  if (
    !Number.isInteger(input.skillLevel) ||
    input.skillLevel < 1 ||
    input.skillLevel > 10 ||
    !Number.isInteger(input.bangbooLevel) ||
    input.bangbooLevel < 1 ||
    input.bangbooLevel > 60 ||
    (input.ascensionLevelCap !== undefined &&
      ![10, 20, 30, 40, 50, 60].includes(input.ascensionLevelCap))
  )
    return []
  const catalogItem = catalogItemsByStableId.get(input.stableId)
  if (!catalogItem) return []
  const activeSkill = catalogItem.skills.find((skill) => skill.role === 'active')
  if (!activeSkill) return []
  const clampedSkillLevel = Math.max(1, Math.min(10, Math.floor(input.skillLevel)))
  const clampedBangbooLv = Math.max(1, Math.min(60, Math.floor(input.bangbooLevel)))
  const rawParamRow = activeSkill.levelParams[clampedSkillLevel - 1]
  if (!rawParamRow) return []
  const tokens = rawParamRow.split('|')
  const recoveryBinding = resolveReviewedBangbooRecoveryBinding(input.stableId)
  const requiresRecoveryBinding = ['bangboo-avocaboo', 'bangboo-miss-esme'].includes(input.stableId)
  const stats =
    input.ascensionLevelCap === undefined
      ? null
      : projectCurrentBangbooStats({
          stableId: input.stableId,
          level: input.bangbooLevel,
          ascensionLevelCap: input.ascensionLevelCap,
        })
  if (stats?.status === 'unsupported') return []

  return definition.effects.flatMap((spec) => {
    const rawToken = tokens[spec.paramIndex]?.trim() ?? ''
    const parsedValue = parseBangbooParameterToken(rawToken, clampedBangbooLv)
    if (parsedValue === null) return []
    const basisUnavailable =
      spec.utilityType === 'hp_restore' && requiresRecoveryBinding && !recoveryBinding
    const absoluteUnit = basisUnavailable
      ? undefined
      : spec.unit === 'hp_ratio_bangboo_hp'
        ? ('hp_point' as const)
        : spec.unit === 'shield_ratio_bangboo_hp'
          ? ('shield_point' as const)
          : undefined
    const absoluteValue =
      absoluteUnit && stats?.status === 'supported'
        ? Math.round(stats.hp * parsedValue * 1e6) / 1e6
        : undefined

    const cooldownSec =
      spec.cooldownIndex !== undefined && tokens[spec.cooldownIndex]
        ? (parseBangbooParameterToken(tokens[spec.cooldownIndex]!, clampedBangbooLv) ??
          definition.cooldownSeconds)
        : definition.cooldownSeconds

    const durationSec =
      spec.durationIndex !== undefined && tokens[spec.durationIndex]
        ? (parseBangbooParameterToken(tokens[spec.durationIndex]!, clampedBangbooLv) ??
          definition.durationSeconds)
        : (spec.durationSeconds ?? definition.durationSeconds)

    return [
      {
        operator: 'resource_and_sustain_apply' as const,
        mechanic: basisUnavailable ? 'hp_restore_source_ratio' : spec.mechanic,
        action: 'active' as const,
        skillRole: 'active' as const,
        skillName: definition.skillName,
        utilityType: spec.utilityType,
        unit: basisUnavailable ? ('hp_ratio_unresolved_basis' as const) : spec.unit,
        provider: 'bangboo' as const,
        receiver: spec.receiver,
        targetRestriction: spec.targetRestriction,
        targetAction: spec.targetAction,
        trigger: spec.trigger,
        capacityOnly: spec.capacityOnly,
        ...(spec.hpBasis
          ? { hpBasis: basisUnavailable ? ('unresolved' as const) : spec.hpBasis }
          : {}),
        ...(spec.utilityType === 'hp_restore' && recoveryBinding
          ? { hpBasisEvidence: recoveryBinding }
          : {}),
        ...(absoluteValue !== undefined
          ? { absoluteValue, absoluteUnit, ascensionLevelCap: input.ascensionLevelCap }
          : {}),
        value: parsedValue,
        values: [parsedValue],
        skillLevel: clampedSkillLevel,
        bangbooLevel: clampedBangbooLv,
        paramIndex: spec.paramIndex,
        rawParameterToken: rawToken,
        ...(spec.branchId ? { branchId: spec.branchId } : {}),
        ...(spec.branchSelection ? { branchSelection: spec.branchSelection } : {}),
        ...(spec.branchDescription ? { branchDescription: spec.branchDescription } : {}),
        ...(spec.probabilityUnstated ? { probabilityUnstated: spec.probabilityUnstated } : {}),
        ...(spec.probabilityDynamic ? { probabilityDynamic: spec.probabilityDynamic } : {}),
        ...(spec.summonCount ? { summonCount: spec.summonCount } : {}),
        ...(spec.filmCharges ? { filmCharges: spec.filmCharges } : {}),
        ...(spec.maxTriggersPerBattle ? { maxTriggersPerBattle: spec.maxTriggersPerBattle } : {}),
        ...(durationSec !== undefined ? { durationSeconds: durationSec } : {}),
        ...(cooldownSec !== undefined ? { cooldownSeconds: cooldownSec } : {}),
        sourceEvidence: {
          stableId: definition.stableId,
          gameId: definition.gameId,
          playerName: definition.playerName,
          englishName: definition.englishName,
          skillName: definition.skillName,
          rawLevelParam: rawParamRow,
          descriptionSnippet: definition.descriptionSnippet,
          url: catalogItem.source.url,
          sha256: catalogItem.source.sha256,
          semanticSha256: activeSkill.semanticSha256,
          parameterPointer: `/skill/a/level/${clampedSkillLevel}/param`,
        },
      },
    ]
  })
}
