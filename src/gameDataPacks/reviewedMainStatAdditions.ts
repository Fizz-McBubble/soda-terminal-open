import type { StatKey } from '../domain/schemas'
import { statKeySchema } from '../domain/schemas'
import { candidateStatKeys } from './candidateStatParsing'
import type { PlayerBuildField, PlayerBuildSource } from './playerBuildSources'
import { stableContentHash } from './types'

type MainStatAddition = {
  slot: '4' | '5' | '6'
  stat: StatKey
  label: string
  optionCondition: string
  condition: string
  requiredExistingStat?: StatKey
  postId?: string
  sourceId?: string
  sourceUrl?: string
  checkedAt?: string
  sourceVersion: string
  sourceHash: string
  unitRawSha256?: string
  locator: string
  excerpt: string
}

const soldier11ReviewedField = {
  agentId: 'agent-soldier-11',
  slot: '5',
  options: ['pen_ratio', 'atk_percent', 'fire_dmg'],
  locator: 'Build > Best Disk Drives Stats > Disk 5',
  pageUpdatedAt: '2026-09-09',
  checkedAt: '2026-09-19',
}
const corinReviewedField = {
  agentId: 'agent-corin',
  slot: '5',
  options: ['pen_ratio', 'atk_percent', 'physical_dmg'],
  locator: 'Build > Best Disk Drives Stats > Disk 5',
  pageUpdatedAt: '2026-09-09',
  checkedAt: '2026-09-19',
}
const graceReviewedField = {
  agentId: 'agent-grace',
  slot: '4',
  options: ['anomaly_proficiency', 'atk_percent'],
  locator: 'Build > Best Disk Drives Stats > Disk 4',
  pageUpdatedAt: '2026-09-09',
  checkedAt: '2026-09-19',
}
const antonReviewedField = {
  agentId: 'agent-anton',
  slot: '5',
  options: ['electric_dmg', 'pen_ratio'],
  locator: 'Anton Best Builds > Anton DPS Build > Disc Main Stats',
  sourceScope: 'Burst Mode and Shock-trigger DPS build',
  pageUpdatedAt: '2026-03-25',
  checkedAt: '2026-09-19',
}

/** Field-local additions reviewed against the existing corpus. */
const additions: Partial<Record<string, MainStatAddition>> = {
  'agent-soldier-11': {
    slot: '5',
    stat: 'pen_ratio',
    label: '穿透率',
    optionCondition: '现行攻略明确备选',
    condition:
      '当前页面同槽位列为穿透率不低于攻击力、且高于火伤；仅补可选范围，不把该页面排序称为跨敌人全局最优。',
    sourceId: 'prydwen-soldier-11-main-stats-reviewed-addition-2026-09-19',
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/soldier-11',
    checkedAt: '2026-09-19T00:00:00.000Z',
    sourceVersion: '2.5',
    sourceHash: stableContentHash(soldier11ReviewedField),
    locator: 'Build > Best Disk Drives Stats > Disk 5；页面更新 2026-09-09',
    excerpt: 'Disk 5: PEN Ratio% >= ATK% > Fire DMG%',
  },
  'agent-corin': {
    slot: '5',
    stat: 'pen_ratio',
    label: '穿透率',
    optionCondition: '现行攻略明确备选',
    condition:
      '当前交叉来源同槽位列为穿透率优先于攻击力与物伤；仅补可选范围，不把该排序称为跨敌人全局最优。',
    sourceId: 'prydwen-corin-main-stats-reviewed-addition-2026-09-19',
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/corin',
    checkedAt: '2026-09-19T00:00:00.000Z',
    sourceVersion: '2.4',
    sourceHash: stableContentHash(corinReviewedField),
    locator: 'Build > Best Disk Drives Stats > Disk 5；页面更新 2026-09-09',
    excerpt: 'Disk 5: PEN Ratio% > ATK% = Physical DMG%',
  },
  'agent-grace': {
    slot: '4',
    stat: 'atk_percent',
    label: '攻击力%',
    optionCondition: '异常精通之后的现行备选',
    condition: '当前页面同槽位列异常精通优先、攻击力次选；保留原异常精通选项，不扩大为全局最优。',
    sourceId: 'prydwen-grace-main-stats-reviewed-addition-2026-09-19',
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/grace-howard',
    checkedAt: '2026-09-19T00:00:00.000Z',
    sourceVersion: '2.5',
    sourceHash: stableContentHash(graceReviewedField),
    locator: 'Build > Best Disk Drives Stats > Disk 4；页面更新 2026-09-09',
    excerpt: 'Disk 4: Anomaly Proficiency > ATK%',
  },
  'agent-anton': {
    slot: '5',
    stat: 'pen_ratio',
    label: '穿透率',
    optionCondition: '现行安东输出构筑明确备选',
    condition:
      'Game8安东输出构筑的同一主词条表列电伤或穿透率，未给穿透选择附加队友、音擎、敌人、影画或面板门槛；保留原电伤与攻击选项，不把作者范围排序称为求解最优。',
    sourceId: 'game8-anton-main-stats-reviewed-addition-2026-09-19',
    sourceUrl: 'https://game8.co/games/Zenless-Zone-Zero/archives/436886',
    checkedAt: '2026-09-19T00:00:00.000Z',
    sourceVersion: 'Game8 2026-03-25 revision',
    sourceHash: stableContentHash(antonReviewedField),
    locator: 'Anton Best Builds > Anton DPS Build > Disc Main Stats；页面更新 2026-03-25',
    excerpt: 'Disc Main Stats: 5: Electric DMG or PEN Ratio',
  },
  'agent-zhao': {
    slot: '6',
    stat: 'hp_percent',
    label: '生命值百分比',
    optionCondition: '生命目标未达标时可选',
    condition: '复用2.5图鉴的生命方向；保留现有回能选项，不把旧版图鉴称为3.1最优配装。',
    postId: '71895611',
    sourceVersion: '2.5',
    sourceHash: '75cbc73cc2941461d1e0986ee3a71e23dd0cb2806fc1c42185cce14c5d782126',
    unitRawSha256: '75cbc73cc2941461d1e0986ee3a71e23dd0cb2806fc1c42185cce14c5d782126',
    locator: 'op32 image245443326，驱动盘推荐分区6；原图003-7EF64FEFAD614663.png',
    excerpt: '分区4 生命值；分区5 生命值；分区6 生命值；属性推荐 生命值≥2.7w。',
  },
  'agent-anby': {
    slot: '5',
    stat: 'pen_ratio',
    label: '穿透率',
    optionCondition: '已核通用可选项',
    condition: '原文通用推荐，无额外队伍或机制门；保留原选项顺序。',
    postId: '55577682',
    sourceVersion: '1.0',
    sourceHash: '1c68c2e68235213c875dea41d442dd74c2ea3693c15b7c31790cb55664e0e86f',
    unitRawSha256: 'febb80f67b03d79e30ee2b00e60f819824d37cf91c7d1223cd632c6879768112',
    locator: '【安比的养成】，structured_content op57',
    excerpt: '◆主词条：暴击/暴伤（4号）、雷伤/穿透/攻击（5号）、冲击力（6号）',
  },
  'agent-caesar': {
    slot: '4',
    stat: 'crit_dmg',
    label: '暴击伤害',
    optionCondition: '补齐当前已有直伤方向的双暴范围',
    condition: '仅补当前已有直伤方向的4号双暴范围；物理积蓄方向保留原异常精通，6号冲击保持不变。',
    requiredExistingStat: 'crit_rate',
    postId: '57928556',
    sourceVersion: '1.2',
    sourceHash: '6875747d64c3b556c11ea748fdfb6005051a1da4195d115a30a2d318c898f7ca',
    unitRawSha256: '1f690a37b250266a76de47326e19b702052ab98a6dc1d6cdfac6ffe64dff0df2',
    locator: '【词条&参考面板】，structured_content op61',
    excerpt: '④ 直伤流（4号双暴/5号物伤/6号冲击）\n⑤ 物理积蓄流（4号精通/5号物伤/6号冲击）',
  },
  'agent-burnice': {
    slot: '5',
    stat: 'atk_percent',
    label: '攻击力%',
    optionCondition: '词条优秀时的次选，火伤仍优先',
    condition: '5号火伤优先，攻击或穿透盘仅作为词条优秀时的次选；不据此改动其他槽位。',
    postId: '58606692',
    sourceVersion: '1.2',
    sourceHash: 'ae4c4f74a822a731c1eb46979cd40db3cd607dfa67b51a73d3b968b5212dfa38',
    unitRawSha256: 'dd0b6be45bb49ccb00a29ac8a30e3a6b222db2e1dfef74cd980e14de9e5587ce',
    locator: '【词条选择】，structured_content op55',
    excerpt: '② 5号位优选火伤加成。提高柏妮思的伤害，有词条不错的攻击/穿透盘可作次选。',
  },
  'agent-yanagi': {
    slot: '5',
    stat: 'atk_percent',
    label: '攻击力%',
    optionCondition: '可选，收益随队伍与音擎变化',
    condition:
      '5号通常优选电伤；丽娜与嵌合编译器配合时可优选穿透率。仅补攻击选项，不采用该原文的其他槽位条件。',
    postId: '59165099',
    sourceVersion: '1.3',
    sourceHash: 'd6c3831fb6a0c7c8ff7879086789bd18abe617069ec1d2559026fe9cc958c321',
    unitRawSha256: '6ca0ddfe06e724655217d78ff6f8495a1f204b1bc13af590e365c3d2e0de7abc',
    locator: '【套装&词条讲解】，structured_content op54',
    excerpt:
      '② 5号优选电伤加成/穿透率/攻击力。通常优选电伤加成，搭配丽娜和音擎选择【嵌合编译器】时可优选穿透率。',
  },
  'agent-orphie-magus': {
    slot: '5',
    stat: 'pen_ratio',
    label: '穿透率',
    optionCondition: '可选，收益随队伍增益变化',
    condition: '队内攻击增益较多时可考虑火伤，否则可考虑攻击或穿透；只补5号范围，不改原6号选择。',
    postId: '69310376',
    sourceVersion: '2.2',
    sourceHash: '5dd2a1a24e6f507c52dc67bb3a5bc25480bbb972c0a702f8762e160264c4740c',
    unitRawSha256: '574fe4ffcff1f7b24ce6e25ae293c97774a8f75f6c5f4546ecaa3069d4453585',
    locator: '【更多驱动讲解】，structured_content op49',
    excerpt:
      '② 5号可选火伤/攻击/穿透盘，考虑到奥菲丝的追击已有较多增伤（F级核心技85%+如影2件15%），因此可优选攻击、穿透盘，若队内有耀嘉音等全队加攻辅助，则火伤盘略高一些。',
  },
  'agent-promeia': {
    slot: '5',
    stat: 'pen_ratio',
    label: '穿透率',
    optionCondition: '已核通用可选项',
    condition: '原文通用推荐，无额外队伍或机制门；保留原选项顺序。',
    postId: '75168225',
    sourceVersion: '2.8',
    sourceHash: '0ac84d0833cc97ae1157e21f33434092b927d6fa8f3ca56fe3328de4c6dd4cc6',
    unitRawSha256: '2cf0a3232c4318c159f76ad7d8a5fc540c2e93ee4603c077dff4648b9b6b0770',
    locator: '【更多驱动盘讲解】，structured_content op47',
    excerpt: '② 5号冰伤/穿透/攻击盘，提高普罗米娅的异常/异放伤害。',
  },
}

export function getReviewedMainStatAdditionSource(agentId: string): PlayerBuildSource | null {
  const addition = additions[agentId]
  if (!addition) return null
  const evidenceHash = addition.unitRawSha256
    ? `unitRawSha256=${addition.unitRawSha256}`
    : `minimalDerivedHash=${addition.sourceHash}`
  return {
    id: addition.sourceId ?? `miyoushe-${addition.postId}-slot-${addition.slot}-reviewed-addition`,
    url: addition.sourceUrl ?? `https://www.miyoushe.com/zzz/article/${addition.postId}`,
    sourceVersion: addition.sourceVersion,
    checkedAt: addition.checkedAt ?? '2026-09-14T00:00:00.000Z',
    contentHash: addition.sourceHash,
    verified: true,
    licenseBoundary: `已核原文${addition.locator}；${evidenceHash}。原文：${addition.excerpt}。仅补${addition.slot}号位${addition.label}候选，保留来源版本标签，不声称当前最优。${addition.condition}不改变其他槽位、副词条、权重或账户。`,
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function shouldAdd(current: readonly StatKey[], addition: MainStatAddition) {
  return (
    !current.includes(addition.stat) &&
    (!addition.requiredExistingStat || current.includes(addition.requiredExistingStat))
  )
}

function mergeValue(value: Record<string, unknown>, addition: MainStatAddition) {
  const mainStats = record(value.mainStats)
  if (mainStats) {
    const current = mainStats[addition.slot]
    if (!Array.isArray(current) || !current.every((stat) => statKeySchema.safeParse(stat).success))
      return null
    if (!shouldAdd(current as StatKey[], addition)) return null
    return { ...value, mainStats: { ...mainStats, [addition.slot]: [...current, addition.stat] } }
  }
  const main = value.main
  if (!Array.isArray(main) || !main.every((line): line is string => typeof line === 'string'))
    return null
  const slotPrefix = new RegExp(`^\\s*${addition.slot}\\s*号(?:位|盘)?\\s*[：:]`)
  const positions = main.flatMap((line, index) => (slotPrefix.test(line) ? [index] : []))
  // A repeated slot may be separate conditional branches. Do not merge those.
  if (positions.length !== 1) return null
  const index = positions[0]!
  if (!shouldAdd(candidateStatKeys(main[index]!), addition)) return null
  return {
    ...value,
    main: main.map((line, position) =>
      position === index ? `${line}；${addition.label}（${addition.optionCondition}）` : line,
    ),
  }
}

/** Preserve both existing field formats and all untouched slot/substat values. */
export function correctReviewedMainStatField(
  agentId: string,
  field: PlayerBuildField,
): PlayerBuildField {
  const addition = additions[agentId]
  const original = record(field.value)
  if (
    !addition ||
    field.path !== 'build.main_sub_stats' ||
    field.status !== 'candidate' ||
    !field.source?.verified ||
    !original
  )
    return field
  const value = mergeValue(original, addition)
  if (!value) return field
  const source = getReviewedMainStatAdditionSource(agentId)!
  return {
    ...field,
    value,
    source: {
      ...source,
      licenseBoundary: `${source.licenseBoundary}\n其余值保留原字段来源：${field.source.id} (${field.source.url}; version=${field.source.sourceVersion ?? '未标注'}; hash=${field.source.contentHash})。`,
    },
    reason: `${field.reason} 补齐${addition.slot}号位${addition.label}可选范围。${addition.condition}`,
  }
}
