import type { AgentProfileField, AgentProfileSourceRef } from './agentProfile'
import { reviewedGuideSkillDirections } from './reviewedGuideSkillDirections'

type SkillTarget = {
  value: number | null
  minimumReference?: number
  display: string
  targetType: 'minimum_reference' | 'exact_integer' | 'source_cap' | 'as_needed'
}

type CinemaSource = {
  id: string
  url: string
  sourceVersion: string
  contentHash: string
  locator: string
  sourceState: 'historical_valid_at_publication' | 'excluded_stale_reference_only'
}

type ExtraSource = Omit<CinemaSource, 'sourceState'> & {
  sourceState: 'pre_release'
}

type ContinuityEntry = {
  agentId: string
  skillTargets: Record<'basic' | 'dodge' | 'assist' | 'special' | 'chain' | 'core', SkillTarget>
  skillPriority: {
    ordered: readonly string[]
    remaining: string
    globalOrderClaimed: false
  }
  cinema: {
    recommendedLevels: readonly number[]
    pullOrder: readonly string[] | null
    status: 'key_levels_only' | 'pull_order_and_levels'
  }
  cinemaSource: CinemaSource
  extraSources?: readonly ExtraSource[]
  conditions: readonly string[]
}

const entries: readonly ContinuityEntry[] = [
  {
    agentId: 'agent-alice',
    skillTargets: {
      basic: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      dodge: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      assist: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      special: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      chain: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      core: { value: 7, display: 'F', targetType: 'exact_integer' },
    },
    skillPriority: {
      ordered: ['core'],
      remaining: 'explicit_core_priority_only',
      globalOrderClaimed: false,
    },
    cinema: { recommendedLevels: [2, 6], pullOrder: null, status: 'key_levels_only' },
    cinemaSource: {
      id: 'miyoushe-67197688-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/67197688',
      sourceVersion: '2.1',
      contentHash: '407E029F4E5FC5BA9225D79318E227122028144D5D56FAB01E792ECAD749D932',
      locator: 'structured_content text[4747:4852]',
      sourceState: 'historical_valid_at_publication',
    },
    conditions: ['只采用核心优先与关键影画2、6，不推导完整技能或抽取顺序。'],
  },
  {
    agentId: 'agent-aria',
    skillTargets: {
      basic: { value: 11, minimumReference: 11, display: '11+', targetType: 'minimum_reference' },
      dodge: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      assist: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      special: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      chain: { value: 11, minimumReference: 11, display: '11+', targetType: 'minimum_reference' },
      core: { value: 7, display: 'F', targetType: 'exact_integer' },
    },
    skillPriority: {
      ordered: ['core'],
      remaining: 'explicit_core_priority_only',
      globalOrderClaimed: false,
    },
    cinema: { recommendedLevels: [1, 2, 6], pullOrder: null, status: 'key_levels_only' },
    cinemaSource: {
      id: 'miyoushe-73713056-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/73713056',
      sourceVersion: '2.6',
      contentHash: '81B901BCDB5B6E360495441DF9BBDEAC1F6CC6526B2E07A1EBD503F6F0F85196',
      locator: 'structured_content text[5441:5552]',
      sourceState: 'historical_valid_at_publication',
    },
    conditions: ['只采用核心优先与关键影画1、2、6，不推导完整技能或抽取顺序。'],
  },
  {
    agentId: 'agent-banyue',
    skillTargets: {
      basic: { value: 12, display: '12', targetType: 'exact_integer' },
      dodge: { value: 12, display: '12', targetType: 'exact_integer' },
      assist: { value: 12, display: '12', targetType: 'exact_integer' },
      special: { value: 12, display: '12', targetType: 'exact_integer' },
      chain: { value: 12, display: '12', targetType: 'exact_integer' },
      core: { value: 7, display: 'F', targetType: 'exact_integer' },
    },
    skillPriority: {
      ordered: ['special', 'basic'],
      remaining: 'explicit_first_tier_only',
      globalOrderClaimed: false,
    },
    cinema: { recommendedLevels: [1, 6], pullOrder: null, status: 'key_levels_only' },
    cinemaSource: {
      id: 'miyoushe-71549535-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/71549535',
      sourceVersion: '2.8',
      contentHash: '850D482B07A00805690C5005584F86D3E92F94E1BE70E9E5C02C92291ADDF018',
      locator: 'unit 71549535:text:083',
      sourceState: 'excluded_stale_reference_only',
    },
    conditions: [
      '原文明确所有技能最好点满，因此五项战斗技为满级；核心F由同句“所有技能”直接承接，不从版本基线补齐。',
      '只保留特殊技、普攻的首层优先与关键影画1、6，不推导其余顺序或抽取顺序。',
    ],
  },
  {
    agentId: 'agent-cissia',
    skillTargets: {
      basic: { value: 12, minimumReference: 12, display: '12+', targetType: 'minimum_reference' },
      dodge: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      assist: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      special: { value: 11, minimumReference: 11, display: '11+', targetType: 'minimum_reference' },
      chain: { value: 11, minimumReference: 11, display: '11+', targetType: 'minimum_reference' },
      core: { value: 7, display: 'F', targetType: 'exact_integer' },
    },
    skillPriority: {
      ordered: ['basic', 'special', 'chain'],
      remaining: 'explicit_first_tier_only',
      globalOrderClaimed: false,
    },
    cinema: { recommendedLevels: [1, 2, 6], pullOrder: null, status: 'key_levels_only' },
    cinemaSource: {
      id: 'miyoushe-74630572-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/74630572',
      sourceVersion: '2.7',
      contentHash: '7780C335C9C779FDF63A8BBBC6F871B74B289CA80D68E8BD1256231ADC9F94BB',
      locator: 'structured_content text[5064:5176]',
      sourceState: 'excluded_stale_reference_only',
    },
    conditions: ['只采用三项首层技能优先、等级下限与关键影画1、2、6，不推导其余排序。'],
  },
  {
    agentId: 'agent-grace',
    skillTargets: {
      basic: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      dodge: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      assist: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      special: { value: 12, minimumReference: 12, display: '12+', targetType: 'minimum_reference' },
      chain: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      core: { value: 7, display: 'F', targetType: 'exact_integer' },
    },
    skillPriority: {
      ordered: [],
      remaining: 'source_not_ranked',
      globalOrderClaimed: false,
    },
    cinema: { recommendedLevels: [2, 4, 6], pullOrder: null, status: 'key_levels_only' },
    cinemaSource: {
      id: 'miyoushe-56349316-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/56349316',
      sourceVersion: '1.0',
      contentHash: '5E6EBA503F9C06E02A2F2636CE1F8E7F4D8D6705B4816A44E0ED6EF0842D68FC',
      locator: 'structured_content text[2782:2889]',
      sourceState: 'historical_valid_at_publication',
    },
    conditions: ['来源没有明确技能排序；只采用等级下限与关键影画2、4、6，不按数值或图标推顺序。'],
  },
  {
    agentId: 'agent-seth',
    skillTargets: {
      basic: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      dodge: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      assist: { value: 7, minimumReference: 7, display: '7+', targetType: 'minimum_reference' },
      special: { value: 9, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      chain: { value: 10, minimumReference: 10, display: '10+', targetType: 'minimum_reference' },
      core: { value: 7, display: 'F', targetType: 'exact_integer' },
    },
    skillPriority: {
      ordered: [],
      remaining: 'source_not_ranked',
      globalOrderClaimed: false,
    },
    cinema: { recommendedLevels: [1, 2], pullOrder: null, status: 'key_levels_only' },
    cinemaSource: {
      id: 'miyoushe-57323848-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/57323848',
      sourceVersion: '1.1',
      contentHash: 'EC2AAF782FE4653980556DB9E4019A3B12DC2B053A7ABF1BA9468331404DCDC6',
      locator: 'structured_content text[2053:2154]',
      sourceState: 'historical_valid_at_publication',
    },
    conditions: ['来源没有明确技能排序；只采用等级下限与关键影画1、2，不按数值或图标推顺序。'],
  },
  {
    agentId: 'agent-ye-shunguang',
    skillTargets: {
      basic: { value: null, minimumReference: 11, display: '11+', targetType: 'minimum_reference' },
      dodge: { value: null, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      assist: { value: null, minimumReference: 9, display: '9+', targetType: 'minimum_reference' },
      special: {
        value: null,
        minimumReference: 11,
        display: '11+',
        targetType: 'minimum_reference',
      },
      chain: { value: null, minimumReference: 11, display: '11+', targetType: 'minimum_reference' },
      core: { value: 7, display: 'F', targetType: 'exact_integer' },
    },
    skillPriority: {
      ordered: ['core'],
      remaining: 'explicit_core_priority_only',
      globalOrderClaimed: false,
    },
    cinema: { recommendedLevels: [2, 6], pullOrder: null, status: 'key_levels_only' },
    cinemaSource: {
      id: 'miyoushe-71963347-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/71963347',
      sourceVersion: '2.5',
      contentHash: 'CC18C83A9F1965FE225D3E9696C98C7590666814964B68BB0CD38FEB9DFEE5B7',
      locator: 'structured_content text[9045:9154]',
      sourceState: 'excluded_stale_reference_only',
    },
    conditions: [
      '五项战斗技均为带+的等级下限，原图未说明付费基础或有效等级，因此value保持null并只保留minimumReference。',
      '只采用核心优先与关键影画2、6，不推导完整技能或抽取顺序。',
    ],
  },
  {
    agentId: 'agent-yixuan',
    skillTargets: {
      basic: { value: 12, display: 'MAX', targetType: 'source_cap' },
      dodge: { value: null, display: '按需', targetType: 'as_needed' },
      assist: { value: null, display: '按需', targetType: 'as_needed' },
      special: { value: 12, display: 'MAX', targetType: 'source_cap' },
      chain: { value: 12, display: 'MAX', targetType: 'source_cap' },
      core: { value: 7, display: 'F', targetType: 'source_cap' },
    },
    skillPriority: {
      ordered: ['chain', 'special', 'core', 'basic'],
      remaining: 'four_skill_max_group_not_ranked',
      globalOrderClaimed: false,
    },
    cinema: {
      recommendedLevels: [1, 2, 6],
      pullOrder: ['0+0', '0+1', '1+1', '2+1', '6+1', '6+5'],
      status: 'pull_order_and_levels',
    },
    cinemaSource: {
      id: 'miyoushe-73100348-cinema-key-levels',
      url: 'https://www.miyoushe.com/zzz/article/73100348',
      sourceVersion: '2.6',
      contentHash: '2BC808B3A7930AB252DA400B5A90EE5115442816D1560E033573553C988F10B4',
      locator: 'structured_content text[8778:8893]',
      sourceState: 'historical_valid_at_publication',
    },
    extraSources: [
      {
        id: 'miyoushe-65025747-pull-order-pre-release',
        url: 'https://www.miyoushe.com/zzz/article/65025747',
        sourceVersion: '2.0',
        contentHash: '5F046B4FD0C627A3B192ADB0C19D57BB64850727D4F4ABD0223801B0D660EF83',
        locator: 'structured_content text[5095:5283]',
        sourceState: 'pre_release',
      },
    ],
    conditions: [
      '普攻、特殊技、连携技与核心明确拉满；闪避和支援明确按需，没有虚构等级。',
      '抽取顺序来自发布前材料，只作条件化历史证据；关键影画等级来自2.6原文，不与发布前顺序混为同一复审。',
    ],
  },
]

const byAgentId = new Map(entries.map((entry) => [entry.agentId, entry]))

function skillSource(agentId: string): AgentProfileSourceRef {
  const source = reviewedGuideSkillDirections[agentId]?.source
  if (!source) throw new Error(`Missing reviewed skill source for ${agentId}.`)
  return {
    id: source.id,
    url: source.url,
    sourceVersion: source.sourceVersion,
    checkedAt: source.checkedAt,
    contentHash: source.contentHash,
    licenseBoundary: source.licenseBoundary,
  }
}

function cinemaSourceRef(source: CinemaSource | ExtraSource): AgentProfileSourceRef {
  return {
    id: source.id,
    url: source.url,
    sourceVersion: source.sourceVersion,
    checkedAt: null,
    contentHash: source.contentHash,
    licenseBoundary: `sourceState=${source.sourceState}; locator=${source.locator}; 保留原句版本与状态，仅作字段级连续性指导。`,
  }
}

export function getReviewedSkillCoreCinemaContinuityField32(
  agentId: string,
): AgentProfileField | undefined {
  const entry = byAgentId.get(agentId)
  if (!entry) return undefined
  return {
    group: 'build_guidance',
    path: 'progression.skill_core_cinema',
    value: {
      kind: 'current_skill_core_cinema',
      sourceDirections: reviewedGuideSkillDirections[agentId]!.directions,
      skillTargets: entry.skillTargets,
      skillPriority: entry.skillPriority,
      cinema: entry.cinema,
    },
    status: 'verified_candidate',
    gameVersion: '3.1',
    originalSourceVersion: null,
    lastChangeVersion: '3.1',
    currentApplicability: 'continuous',
    sourceRefs: [
      skillSource(agentId),
      cinemaSourceRef(entry.cinemaSource),
      ...(entry.extraSources?.map(cinemaSourceRef) ?? []),
    ],
    verifiedAt: '2026-10-20',
    conflict: null,
    reason:
      '复用既有已复核技能与影画组件，并通过锁定的3.1→3.2连续性门做字段级采用；不宣称作者重审3.2。',
    conditions: [
      '仅作养成指导，不创建账号技能、影画、库存或计划DPS事实。',
      '影画等级是来源给出的关键等级；没有显式pullOrder时不得扩写为抽取顺序。',
      '局部技能优先保持原样；未列出的顺序不从等级、图标或职业推断。',
      '影画句保留historical_valid_at_publication或excluded_stale_reference_only状态；3.2只做字段级连续性采用。',
      ...entry.conditions,
    ],
  }
}

export const reviewedSkillCoreCinemaContinuity32 = Object.freeze({
  id: 'reviewed-skill-core-cinema-continuity-32-r1',
  reviewVersion: '3.2',
  sourceReviewVersion: '3.1',
  sourceCandidateSha256: '514B8041E34DEB11C8A74A5AA8B3F03544D52EC56381E4648DA6A87DE860ABBF',
  entries,
})
