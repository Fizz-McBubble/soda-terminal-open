import { contentHash } from '../evaluation/contentHash'
import { statKeySchema } from '../domain/schemas'
import { z } from 'zod'
import type { AgentDiscProfile } from './engine'
import type { AccountRoster, RosterAgent } from './types'

export type CurrentBuildProfileStatus = 'formal' | 'compatible_with_evidence' | 'stale' | 'missing'

const skillTargetSchema = z.object({
  basic: z.number().int().min(1).max(12).nullable(),
  dodge: z.number().int().min(1).max(12).nullable(),
  assist: z.number().int().min(1).max(12).nullable(),
  special: z.number().int().min(1).max(12).nullable(),
  chain: z.number().int().min(1).max(12).nullable(),
  core: z.number().int().min(1).max(7).nullable(),
})

export const currentBuildProfileSchema = z.object({
  schemaVersion: z.literal(1),
  profileVersion: z.string().min(1),
  gameVersion: z.literal('3.0'),
  collectedAt: z.string().datetime(),
  agentId: z.string().min(1),
  status: z.enum(['formal', 'compatible_with_evidence', 'stale', 'missing']),
  recommendationKind: z.literal('current_best_available'),
  confidence: z.enum(['high', 'medium', 'low']),
  rationale: z.array(z.string().min(1)).min(1),
  scenario: z.string().min(1),
  defaultBranchId: z.string().min(1),
  playstyleBranches: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      scenario: z.string().min(1),
      primarySetOverride: z.string().min(1).nullable(),
    }),
  ),
  recommendation: z
    .object({
      wEngines: z.array(z.string().min(1)).min(1),
      skillPriority: z.array(z.enum(['basic', 'dodge', 'assist', 'special', 'chain', 'core'])),
      skillTargets: skillTargetSchema,
      coreTarget: z.number().int().min(1).max(7),
      sets: z.array(
        z.object({
          pattern: z.enum(['4+2', '2+2+2']),
          primary: z.array(z.string().min(1)),
          secondary: z.array(z.string().min(1)),
        }),
      ),
      mainStats: z.object({
        '4': z.array(statKeySchema).min(1),
        '5': z.array(statKeySchema).min(1),
        '6': z.array(statKeySchema).min(1),
      }),
      substatWeights: z
        .record(z.string(), z.number().nonnegative())
        .refine((weights) =>
          Object.keys(weights).every((key) => statKeySchema.safeParse(key).success),
        ),
      teamConstraints: z.object({
        teammateNotes: z.array(z.string()),
        bangbooIds: z.array(z.string()),
      }),
    })
    .nullable(),
  sources: z.array(
    z.object({
      url: z.string().url(),
      updatedAt: z.string().datetime(),
      applicableVersion: z.string().min(1),
      publishedAt: z.string().datetime(),
      verifiedAt: z.string().datetime(),
    }),
  ),
  conflicts: z.array(z.string()),
  blocker: z.string().nullable(),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
})

type Recommendation = {
  wEngines: string[]
  skillPriority: Array<keyof RosterAgent['skillLevels']>
  skillTargets: RosterAgent['skillLevels']
  coreTarget: number
  sets: Array<{ pattern: '4+2' | '2+2+2'; primary: string[]; secondary: string[] }>
  mainStats: Record<'4' | '5' | '6', string[]>
  substatWeights: Record<string, number>
  teamConstraints: { teammateNotes: string[]; bangbooIds: string[] }
}

type ProfileSeed = {
  agentId: string
  status: CurrentBuildProfileStatus
  confidence: 'high' | 'medium' | 'low'
  rationale: string[]
  scenario: string
  defaultBranchId: string
  playstyleBranches: Array<{
    id: string
    label: string
    scenario: string
    primarySetOverride: string | null
  }>
  recommendation: Recommendation | null
  sources: Array<{
    tier: 'official' | 'community-international' | 'community-chinese' | 'community'
    title: string
    url: string
    updatedAt: string
    /** The source page's own applicable patch. It is not inferred from this profile's gameVersion. */
    sourceVersion?: string
    license?: string
  }>
  conflicts: string[]
  blocker: string | null
}

const targetAgents = [
  'agent-velina',
  'agent-promeia',
  'agent-ye-shunguang',
  'agent-qingyi',
  'agent-ellen',
  'agent-koleda',
  'agent-soldier-11',
  'agent-piper',
  'agent-lucy',
  'agent-soukaku',
  'agent-nicole',
  'agent-ben',
  'agent-anby',
  'agent-pyrois',
  'agent-billy',
  'agent-pulchra',
  'agent-anton',
  'agent-corin',
  'agent-nekomata',
  'agent-pan-yinhu',
] as const

const officialSource = {
  tier: 'official' as const,
  title: '米哈游绳网情报站',
  url: 'https://baike.mihoyo.com/zzz/wiki/',
  updatedAt: '2026-07-03T00:00:00.000Z',
}

const seeds: Record<
  (typeof targetAgents)[number],
  Omit<ProfileSeed, 'agentId'>
> = Object.fromEntries(
  targetAgents.map((agentId) => [
    agentId,
    {
      status: 'missing',
      confidence: 'low',
      rationale: ['缺少足够资料时使用保守构筑规则，不输出精确队伤。'],
      scenario: '3.0通用规划',
      defaultBranchId: 'general',
      playstyleBranches: [
        { id: 'general', label: '通用玩法', scenario: '通用规划', primarySetOverride: null },
      ],
      recommendation: null,
      sources: [officialSource],
      conflicts: [],
      blocker: '缺少当前版本且可交叉核验的完整构筑结论。',
    },
  ]),
) as unknown as Record<(typeof targetAgents)[number], Omit<ProfileSeed, 'agentId'>>

const fullSkillTargets: RosterAgent['skillLevels'] = {
  basic: 12,
  dodge: 12,
  assist: 12,
  special: 12,
  chain: 12,
  core: 7,
}

function recommendation(input: {
  wEngines: string[]
  skillPriority: Recommendation['skillPriority']
  primarySet: string
  secondarySets: string[]
  mainStats: Recommendation['mainStats']
  substatWeights: Record<string, number>
  teammateNotes: string[]
  bangbooIds?: string[]
}): Recommendation {
  return {
    wEngines: input.wEngines,
    skillPriority: input.skillPriority,
    skillTargets: { ...fullSkillTargets },
    coreTarget: 7,
    sets: [
      {
        pattern: '4+2',
        primary: [input.primarySet],
        secondary: input.secondarySets,
      },
      {
        pattern: '2+2+2',
        primary: [input.primarySet, ...input.secondarySets],
        secondary: [],
      },
    ],
    mainStats: input.mainStats,
    substatWeights: input.substatWeights,
    teamConstraints: {
      teammateNotes: input.teammateNotes,
      bangbooIds: input.bangbooIds ?? [],
    },
  }
}

const critWeights = { crit_rate: 1, crit_dmg: 1, atk_percent: 0.8, pen: 0.45, atk_flat: 0.25 }
const anomalyWeights = {
  anomaly_proficiency: 1,
  atk_percent: 0.8,
  pen: 0.4,
  atk_flat: 0.25,
}
const supportWeights = {
  energy_regen: 1,
  atk_percent: 0.65,
  anomaly_proficiency: 0.45,
  pen: 0.25,
}
const stunWeights = { impact: 1, crit_rate: 0.55, crit_dmg: 0.55, atk_percent: 0.5, pen: 0.3 }
const defenseWeights = { def_percent: 1, hp_percent: 0.65, atk_percent: 0.45, energy_regen: 0.4 }

/**
 * Historical direction records retained as migration evidence. A record can enter the candidate
 * layer only through an explicit, agent-specific source assignment below; the map itself is never
 * a roster-wide fallback and never becomes formal optimizer input.
 */
export const unverifiedLegacyDirections: Partial<
  Record<(typeof targetAgents)[number], Recommendation>
> = {
  'agent-promeia': recommendation({
    wEngines: ['wengine-14154', 'wengine-14118', 'wengine-13008'],
    skillPriority: ['core', 'special', 'chain', 'basic', 'assist', 'dodge'],
    primarySet: 'set-notes-from-the-chained',
    secondarySets: [
      'set-phaethons-melody',
      'set-freedom-blues',
      'set-chaos-jazz',
      'set-astral-voice',
      'set-hormone-punk',
    ],
    mainStats: {
      '4': ['anomaly_proficiency'],
      '5': ['ice_dmg', 'atk_percent'],
      '6': ['anomaly_mastery'],
    },
    substatWeights: anomalyWeights,
    teammateNotes: ['优先异常或支援队友；不同绽放循环不混为同一场景。'],
    bangbooIds: ['bangboo-sharkboo'],
  }),
  'agent-ye-shunguang': recommendation({
    wEngines: ['wengine-14143', 'wengine-14104', 'wengine-14102'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'assist', 'dodge'],
    primarySet: 'set-white-water-ballad',
    secondarySets: ['set-branch-blade-song', 'set-puffer-electro'],
    mainStats: {
      '4': ['atk_percent', 'crit_dmg'],
      '5': ['physical_dmg', 'pen_ratio', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要能稳定提供以太帷幕或失衡窗口的队友。'],
  }),
  'agent-qingyi': recommendation({
    wEngines: ['wengine-14125', 'wengine-13005', 'wengine-13101'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'assist', 'dodge'],
    primarySet: 'set-shockstar-disco',
    secondarySets: ['set-swing-jazz', 'set-woodpecker-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['electric_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['面向需要长失衡窗口的强攻主C。'],
    bangbooIds: ['bangboo-officer-cui', 'bangboo-plugboo'],
  }),
  'agent-ellen': recommendation({
    wEngines: ['wengine-14119', 'wengine-14104', 'wengine-13004'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-puffer-electro',
    secondarySets: ['set-woodpecker-electro', 'set-polar-metal', 'set-branch-blade-song'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['ice_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['优先冰属性增益、击破与支援队友。'],
    bangbooIds: ['bangboo-sharkboo', 'bangboo-butler'],
  }),
  'agent-koleda': recommendation({
    wEngines: ['wengine-14110', 'wengine-13006', 'wengine-13005'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'assist', 'dodge'],
    primarySet: 'set-shockstar-disco',
    secondarySets: ['set-swing-jazz', 'set-inferno-metal'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['fire_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['火属性队或需要快速失衡的队伍。'],
    bangbooIds: ['bangboo-safety', 'bangboo-rocketboo'],
  }),
  'agent-soldier-11': recommendation({
    wEngines: ['wengine-14104', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-inferno-metal',
    secondarySets: ['set-woodpecker-electro', 'set-branch-blade-song'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['fire_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要稳定触发灼烧或提供火增益的击破/支援队友。'],
    bangbooIds: ['bangboo-rocketboo'],
  }),
  'agent-piper': recommendation({
    wEngines: ['wengine-13128', 'wengine-13003', 'wengine-13008'],
    skillPriority: ['core', 'special', 'chain', 'basic', 'dodge', 'assist'],
    primarySet: 'set-fanged-metal',
    secondarySets: ['set-freedom-blues', 'set-phaethons-melody'],
    mainStats: {
      '4': ['anomaly_proficiency'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['anomaly_mastery'],
    },
    substatWeights: anomalyWeights,
    teammateNotes: ['物理异常或紊乱队；需按队伍确认异常覆盖。'],
    bangbooIds: ['bangboo-bangvolver', 'bangboo-red-moccus'],
  }),
  'agent-lucy': recommendation({
    wEngines: ['wengine-13115', 'wengine-13002', 'wengine-12006'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-astral-voice',
    secondarySets: ['set-swing-jazz', 'set-hormone-punk'],
    mainStats: {
      '4': ['atk_percent', 'crit_rate'],
      '5': ['fire_dmg', 'atk_percent'],
      '6': ['energy_regen', 'atk_percent'],
    },
    substatWeights: supportWeights,
    teammateNotes: ['需要快速支援入场的主C；攻击目标随小猪继承需求调整。'],
    bangbooIds: ['bangboo-red-moccus', 'bangboo-rocketboo'],
  }),
  'agent-soukaku': recommendation({
    wEngines: ['wengine-13113', 'wengine-13002', 'wengine-12006'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-swing-jazz',
    secondarySets: ['set-hormone-punk', 'set-astral-voice'],
    mainStats: { '4': ['atk_percent'], '5': ['ice_dmg', 'atk_percent'], '6': ['energy_regen'] },
    substatWeights: supportWeights,
    teammateNotes: ['优先冰属性主C；需满足展旗与攻击增益覆盖。'],
    bangbooIds: ['bangboo-sharkboo'],
  }),
  'agent-nicole': recommendation({
    wEngines: ['wengine-13103', 'wengine-13002', 'wengine-12006'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-swing-jazz',
    secondarySets: ['set-freedom-blues', 'set-astral-voice'],
    mainStats: {
      '4': ['anomaly_proficiency'],
      '5': ['ether_dmg', 'atk_percent'],
      '6': ['energy_regen', 'anomaly_mastery'],
    },
    substatWeights: supportWeights,
    teammateNotes: ['适合爆发窗口与以太队；需保证减防覆盖。'],
    bangbooIds: ['bangboo-amillion', 'bangboo-resonaboo'],
  }),
  'agent-ben': recommendation({
    wEngines: ['wengine-13112', 'wengine-13010', 'wengine-13007'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-proto-punk',
    secondarySets: ['set-soul-rock', 'set-swing-jazz'],
    mainStats: {
      '4': ['crit_rate', 'def_percent'],
      '5': ['fire_dmg', 'def_percent'],
      '6': ['def_percent', 'energy_regen'],
    },
    substatWeights: defenseWeights,
    teammateNotes: ['火队或需要护盾与完美支援增益的队伍。'],
    bangbooIds: ['bangboo-safety'],
  }),
  'agent-anby': recommendation({
    wEngines: ['wengine-13101', 'wengine-13005', 'wengine-13006'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'assist', 'dodge'],
    primarySet: 'set-shockstar-disco',
    secondarySets: ['set-swing-jazz', 'set-thunder-metal'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['electric_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['通用击破；电队可提高属性协同。'],
    bangbooIds: ['bangboo-amillion', 'bangboo-plugboo'],
  }),
  'agent-pyrois': recommendation({
    wEngines: ['wengine-14155', 'wengine-14104', 'wengine-13004'],
    skillPriority: ['core', 'chain', 'basic', 'special', 'assist', 'dodge'],
    primarySet: 'set-the-sky-ablaze',
    secondarySets: ['set-branch-blade-song', 'set-woodpecker-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['pen_ratio', 'ether_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['围绕多终结技循环；队友需补充增益和失衡窗口。'],
    bangbooIds: ['bangboo-resonaboo'],
  }),
  'agent-billy': recommendation({
    wEngines: ['wengine-13108', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-woodpecker-electro',
    secondarySets: ['set-fanged-metal', 'set-dawns-bloom'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['持续直伤与普攻强化为不同场景，当前模板按持续直伤。'],
    bangbooIds: ['bangboo-amillion'],
  }),
  'agent-pulchra': recommendation({
    wEngines: ['wengine-13135', 'wengine-14110', 'wengine-13006'],
    skillPriority: ['core', 'special', 'assist', 'chain', 'basic', 'dodge'],
    primarySet: 'set-astral-voice',
    secondarySets: ['set-proto-punk', 'set-shockstar-disco'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['余震队优先；非余震队需要M6后再确认泛用收益。'],
    bangbooIds: ['bangboo-bangvolver'],
  }),
  'agent-anton': recommendation({
    wEngines: ['wengine-13111', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'dodge', 'assist'],
    primarySet: 'set-thunder-metal',
    secondarySets: ['set-woodpecker-electro', 'set-puffer-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['electric_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要电异常覆盖维持雷暴4件效果。'],
    bangbooIds: ['bangboo-safety', 'bangboo-plugboo'],
  }),
  'agent-corin': recommendation({
    wEngines: ['wengine-13106', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'special', 'chain', 'basic', 'assist', 'dodge'],
    primarySet: 'set-fanged-metal',
    secondarySets: ['set-woodpecker-electro', 'set-puffer-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['依赖失衡窗口持续输出；优先击破与物理异常协同。'],
    bangbooIds: ['bangboo-butler', 'bangboo-bangvolver'],
  }),
  'agent-nekomata': recommendation({
    wEngines: ['wengine-14102', 'wengine-14104', 'wengine-13004'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-fanged-metal',
    secondarySets: ['set-woodpecker-electro', 'set-puffer-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要强击覆盖或物理队友激活獠牙4件。'],
    bangbooIds: ['bangboo-amillion', 'bangboo-bangvolver'],
  }),
  'agent-pan-yinhu': recommendation({
    wEngines: ['wengine-13142', 'wengine-13007', 'wengine-13010'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-astral-voice',
    secondarySets: ['set-hormone-punk', 'set-swing-jazz'],
    mainStats: { '4': ['atk_percent'], '5': ['atk_percent'], '6': ['energy_regen', 'atk_percent'] },
    substatWeights: supportWeights,
    teammateNotes: ['只在命破主C队中作为优先兼容建议；需满足攻击力Buff阈值。'],
  }),
}

/**
 * Creates a candidate only for an explicitly named page evidence row. This does not iterate over
 * the roster and never supplies a fallback for a missing profile.
 */
function candidateFromExplicitPage(
  agentId: (typeof targetAgents)[number],
  evidence: {
    title: string
    url: string
    updatedAt: string
    sourceVersion: string
    scenario: string
    note: string
    tier?: 'community-international' | 'community-chinese' | 'community'
    license?: string
  },
): Omit<ProfileSeed, 'agentId'> {
  const direction = unverifiedLegacyDirections[agentId]
  if (!direction) throw new Error(`Missing explicit candidate direction for ${agentId}`)
  return {
    ...seeds[agentId],
    status: 'compatible_with_evidence',
    confidence: 'medium',
    rationale: [
      `页面级候选资料定位到音擎、驱动盘、词条、养成与队伍方向：${evidence.note}`,
      `最后构筑更新为 ${evidence.sourceVersion}，与 3.0 不同；仅保留为跨版本手动参考。`,
    ],
    scenario: evidence.scenario,
    recommendation: direction,
    sources: [
      officialSource,
      {
        tier: evidence.tier ?? 'community-international',
        title: evidence.title,
        url: evidence.url,
        updatedAt: evidence.updatedAt,
        sourceVersion: evidence.sourceVersion,
        license: evidence.license,
      },
    ],
    conflicts: ['跨版本候选不与 3.0 正式规则混算，不产生仓库求解或精确伤害结论。'],
    blocker: `构筑页面最后更新为 ${evidence.sourceVersion}；等待 3.0 同版本或游戏内证据。`,
  }
}

seeds['agent-velina'] = {
  status: 'compatible_with_evidence',
  confidence: 'medium',
  rationale: [
    '3.0新增角色，静态机制与当前中英文构筑资料已交叉。',
    '能量回复、风化/乱流与专属套装之间存在直接可复算关系。',
  ],
  scenario: '3.0后台异常副C与风化/乱流循环',
  defaultBranchId: 'off-field-anomaly',
  playstyleBranches: [
    {
      id: 'off-field-anomaly',
      label: '后台异常副C',
      scenario: '风化/乱流后台循环',
      primarySetOverride: null,
    },
  ],
  recommendation: {
    wEngines: ['wengine-14156', 'wengine-14118', 'wengine-13008'],
    skillPriority: ['core', 'special', 'chain', 'basic', 'assist', 'dodge'],
    skillTargets: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
    coreTarget: 7,
    sets: [
      {
        pattern: '4+2',
        primary: ['set-wuthering-salon'],
        secondary: ['set-moonlight-lullaby', 'set-swing-jazz'],
      },
    ],
    mainStats: {
      '4': ['anomaly_proficiency'],
      '5': ['wind_dmg', 'atk_percent', 'pen_ratio'],
      '6': ['energy_regen'],
    },
    substatWeights: anomalyWeights,
    teamConstraints: {
      teammateNotes: ['优先异常或支援队友；以风化/乱流后台循环为当前场景。'],
      bangbooIds: ['bangboo-ultra-jake'],
    },
  },
  sources: [
    officialSource,
    {
      tier: 'community-international',
      title: 'Icy Veins Velina Guide and Best Builds',
      url: 'https://www.icy-veins.com/zenless-zone-zero/velina-guide-best-builds',
      updatedAt: '2026-06-17T00:00:00.000Z',
      sourceVersion: 'unknown',
    },
    {
      tier: 'community-international',
      title: 'Prydwen Velina Best Build Guide',
      url: 'https://www.prydwen.gg/zenless/characters/velina',
      updatedAt: '2026-06-17T00:00:00.000Z',
      sourceVersion: 'unknown',
    },
    {
      tier: 'community-chinese',
      title: '游侠网：维琳娜3.0技能与音擎推荐',
      url: 'https://m.ali213.net/news/gl2606/1783385.html',
      updatedAt: '2026-06-17T00:00:00.000Z',
      sourceVersion: '3.0',
    },
    {
      tier: 'community',
      title: '绝区零BWIKI',
      url: 'https://wiki.biligame.com/zzz/首页',
      updatedAt: '2026-07-03T00:00:00.000Z',
      sourceVersion: 'unknown',
      license: 'CC BY-NC-SA 4.0',
    },
  ],
  conflicts: [
    '5号位风伤、攻击与穿透的排序受队伍和副词条质量影响，保留为有序备选，不做平均。',
    '音擎备选强度随精炼变化；默认只选首选琳琅鎏心。',
  ],
  blocker: '构筑方向含社区候选资料；在同版本官方/游戏内构筑证据完整前，不得进入正式仓库求解。',
}

seeds['agent-promeia'] = {
  ...seeds['agent-promeia'],
  status: 'compatible_with_evidence',
  confidence: 'medium',
  rationale: [
    '3.0当前维护构筑明确以囚徒手记4件为核心，冻结/异放与绽放循环可直接触发套装。',
    '异常掌控阈值、异常精通收益和法厄同之歌2件均有当前队伍计算上下文。',
  ],
  scenario: '3.0冰异常站场与绽放循环',
  recommendation: unverifiedLegacyDirections['agent-promeia']!,
  sources: [
    officialSource,
    {
      tier: 'community-international',
      title: 'Prydwen Promeia Best Build Guide',
      url: 'https://www.prydwen.gg/zenless/characters/promeia',
      updatedAt: '2026-06-23T00:00:00.000Z',
      sourceVersion: '2.8',
    },
    {
      tier: 'community',
      title: '绝区零BWIKI（静态事实补缺）',
      url: 'https://wiki.biligame.com/zzz/首页',
      updatedAt: '2026-07-03T00:00:00.000Z',
      sourceVersion: 'unknown',
      license: 'CC BY-NC-SA 4.0',
    },
  ],
  conflicts: [
    '5号位冰伤、攻击和穿透随队伍减防/穿透来源变化，不跨场景平均。',
    '高失衡与双异常队的循环不同；当前只提供通用站场默认。',
  ],
  blocker: '候选方向来自可追溯社区页面，但页面级版本与同版本数值仍待正式核验。',
}

seeds['agent-ellen'] = {
  ...seeds['agent-ellen'],
  status: 'compatible_with_evidence',
  confidence: 'medium',
  rationale: [
    '当前维护页面于2026-06-14复核Profile，但Build计算仍标记2.5，因此保留中置信。',
    '河豚电音4件为当前计算首选，啄木鸟4件为循环可维持时的次选；极地只列2件候选。',
  ],
  scenario: '通用失衡窗口冰直伤（非危局专项）',
  recommendation: unverifiedLegacyDirections['agent-ellen']!,
  sources: [
    officialSource,
    {
      tier: 'community-international',
      title: 'Prydwen Ellen Best Build Guide',
      url: 'https://www.prydwen.gg/zenless/characters/ellen',
      updatedAt: '2026-06-14T00:00:00.000Z',
      sourceVersion: '2.5',
    },
    {
      tier: 'community',
      title: '绝区零BWIKI（静态事实补缺）',
      url: 'https://wiki.biligame.com/zzz/首页',
      updatedAt: '2026-07-03T00:00:00.000Z',
      sourceVersion: 'unknown',
      license: 'CC BY-NC-SA 4.0',
    },
  ],
  conflicts: [
    'Prydwen Profile于3.0期间复核，但Build/Teams计算仍标2.5，不能宣称3.0环境唯一最优。',
    '啄木鸟4件收益依赖普攻、闪避反击与强化特殊技层数覆盖；队伍循环不同会改变排序。',
  ],
  blocker: '缺少3.0独立Build重算，当前作为中置信通用保守方案。',
}

seeds['agent-billy'] = {
  ...seeds['agent-billy'],
  status: 'compatible_with_evidence',
  confidence: 'medium',
  rationale: ['BWIKI 页面级构筑段明确记录音擎、驱动盘、词条、技能与队伍方向；仅作为候选。'],
  scenario: '站场物理直伤与失衡窗口（非精确伤害计算）',
  recommendation: unverifiedLegacyDirections['agent-billy']!,
  sources: [
    officialSource,
    {
      tier: 'community',
      title: '绝区零BWIKI：比利页面级构筑方向',
      url: 'https://wiki.biligame.com/zzz/%E6%AF%94%E5%88%A9',
      updatedAt: '2026-06-15T00:00:00.000Z',
      sourceVersion: 'unknown',
      license: 'CC BY-NC-SA 4.0',
    },
  ],
  conflicts: ['穿透率与妮可减防会相互稀释；不同音擎和队伍前提不合并为唯一排序。'],
  blocker: '候选方向不可用于正式仓库求解、DPS 或最高伤害结论。',
}

seeds['agent-qingyi'] = {
  ...seeds['agent-qingyi'],
  status: 'compatible_with_evidence',
  confidence: 'medium',
  rationale: [
    '页面级候选资料列出音擎优先级、击破套装、4/5/6号位与队伍增益前提。',
    '该页面最后构筑更新为 2.5；未观察到同版本 3.0 复核，因此只保留为跨版本候选方向。',
  ],
  scenario: '击破窗口与队伍增益（跨版本候选，需 3.0 复核）',
  recommendation: unverifiedLegacyDirections['agent-qingyi']!,
  sources: [
    officialSource,
    {
      tier: 'community-international',
      title: 'Prydwen Qingyi Best Build Guide',
      url: 'https://www.prydwen.gg/zenless/characters/qingyi',
      updatedAt: '2026-06-14T00:00:00.000Z',
      sourceVersion: '2.5',
    },
  ],
  conflicts: [
    '资料同时给出增益套与震星4件等多条路径；保留为并列候选，不合并成唯一最优。',
    '页面版本为 2.5，与当前 3.0 基线不一致，不能升级为正式仓库约束。',
  ],
  blocker: '构筑页面可读但最后构筑更新为 2.5；等待同版本 3.0 或游戏内证据。',
}

seeds['agent-piper'] = candidateFromExplicitPage('agent-piper', {
  title: 'Prydwen Piper Best Build Guide',
  url: 'https://www.prydwen.gg/zenless/characters/piper',
  updatedAt: '2026-06-14T00:00:00.000Z',
  sourceVersion: '2.4',
  scenario: '物理异常与紊乱前提（跨版本候选）',
  note: '物理异常、套装、词条与队伍前提均位于同一页面构筑区。',
})

seeds['agent-lucy'] = candidateFromExplicitPage('agent-lucy', {
  title: 'Prydwen Lucy Best Build Guide',
  url: 'https://www.prydwen.gg/zenless/characters/lucy',
  updatedAt: '2026-06-14T00:00:00.000Z',
  sourceVersion: '2.2',
  scenario: '支援增益与快速支援前提（跨版本候选）',
  note: '音擎、套装、词条与协同说明均位于同一页面构筑区。',
})

seeds['agent-nicole'] = candidateFromExplicitPage('agent-nicole', {
  title: '绝区零BWIKI：妮可页面级构筑方向',
  url: 'https://wiki.biligame.com/zzz/%E5%A6%AE%E5%8F%AF',
  updatedAt: '2026-07-27T00:00:00.000Z',
  sourceVersion: '1.7',
  scenario: '以太支援与减防覆盖前提（跨版本候选）',
  note: '页面构筑区列出音擎、驱动盘、主副词条与队伍方向。',
  tier: 'community-chinese',
  license: 'CC BY-NC-SA 4.0',
})

seeds['agent-anby'] = candidateFromExplicitPage('agent-anby', {
  title: '绝区零BWIKI：安比页面级构筑方向',
  url: 'https://wiki.biligame.com/zzz/%E5%AE%89%E6%AF%94',
  updatedAt: '2026-07-27T00:00:00.000Z',
  sourceVersion: '2.0',
  scenario: '电属性击破与失衡窗口前提（跨版本候选）',
  note: '页面构筑区列出音擎、驱动盘、主副词条与技能优先级。',
  tier: 'community-chinese',
  license: 'CC BY-NC-SA 4.0',
})

seeds['agent-soukaku'] = candidateFromExplicitPage('agent-soukaku', {
  title: '绝区零BWIKI：苍角页面级构筑方向',
  url: 'https://wiki.biligame.com/zzz/%E8%8B%8D%E8%A7%92',
  updatedAt: '2026-07-27T00:00:00.000Z',
  sourceVersion: '1.7',
  scenario: '冰属性支援与展旗覆盖前提（跨版本候选）',
  note: '页面构筑区给出音擎、驱动盘、主副词条、技能与队伍方向。',
  tier: 'community-chinese',
  license: 'CC BY-NC-SA 4.0',
})

seeds['agent-pulchra'] = candidateFromExplicitPage('agent-pulchra', {
  title: '绝区零BWIKI：波可娜页面级构筑方向',
  url: 'https://wiki.biligame.com/zzz/%E6%B3%A2%E5%8F%AF%E5%A8%9C',
  updatedAt: '2026-07-27T00:00:00.000Z',
  sourceVersion: '2.0',
  scenario: '余震或击破协同前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、词条、技能与队伍方向。',
  tier: 'community-chinese',
  license: 'CC BY-NC-SA 4.0',
})

seeds['agent-anton'] = candidateFromExplicitPage('agent-anton', {
  title: '绝区零BWIKI：安东页面级构筑方向',
  url: 'https://wiki.biligame.com/zzz/%E5%AE%89%E4%B8%9C',
  updatedAt: '2026-07-27T00:00:00.000Z',
  sourceVersion: '1.7',
  scenario: '电属性直伤与感电覆盖前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、词条、技能与队伍方向。',
  tier: 'community-chinese',
  license: 'CC BY-NC-SA 4.0',
})

seeds['agent-corin'] = candidateFromExplicitPage('agent-corin', {
  title: '绝区零BWIKI：可琳页面级构筑方向',
  url: 'https://wiki.biligame.com/zzz/%E5%8F%AF%E7%90%B3',
  updatedAt: '2026-07-27T00:00:00.000Z',
  sourceVersion: '2.0',
  scenario: '物理失衡窗口输出前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、词条、技能与队伍方向。',
  tier: 'community-chinese',
  license: 'CC BY-NC-SA 4.0',
})

seeds['agent-nekomata'] = candidateFromExplicitPage('agent-nekomata', {
  title: '绝区零BWIKI：猫又页面级构筑方向',
  url: 'https://wiki.biligame.com/zzz/%E7%8C%AB%E5%8F%88',
  updatedAt: '2026-07-27T00:00:00.000Z',
  sourceVersion: '1.7',
  scenario: '物理强击与失衡窗口前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、词条、技能与队伍方向。',
  tier: 'community-chinese',
  license: 'CC BY-NC-SA 4.0',
})

seeds['agent-koleda'] = candidateFromExplicitPage('agent-koleda', {
  title: 'Prydwen Koleda Best Build Guide',
  url: 'https://www.prydwen.gg/zenless/characters/koleda',
  updatedAt: '2026-06-14T00:00:00.000Z',
  sourceVersion: '2.0',
  scenario: '火属性速切击破与队伍增益前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、主副词条、技能与队伍说明。',
})

seeds['agent-soldier-11'] = candidateFromExplicitPage('agent-soldier-11', {
  title: 'Prydwen Soldier 11 Best Build Guide',
  url: 'https://www.prydwen.gg/zenless/characters/soldier-11',
  updatedAt: '2026-06-14T00:00:00.000Z',
  sourceVersion: '2.5',
  scenario: '火属性直伤与失衡窗口前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、主副词条、技能与队伍说明。',
})

seeds['agent-ye-shunguang'] = candidateFromExplicitPage('agent-ye-shunguang', {
  title: 'Prydwen Ye Shunguang Best Build Guide',
  url: 'https://www.prydwen.gg/zenless/characters/ye-shunguang',
  updatedAt: '2026-06-16T00:00:00.000Z',
  sourceVersion: '2.5',
  scenario: '物理直伤与队伍协同前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、主副词条、技能与队伍说明。',
})

seeds['agent-pan-yinhu'] = candidateFromExplicitPage('agent-pan-yinhu', {
  title: 'Prydwen Pan Yinhu Best Build Guide',
  url: 'https://www.prydwen.gg/zenless/characters/pan-yinhu',
  updatedAt: '2026-06-14T00:00:00.000Z',
  sourceVersion: '2.0',
  scenario: '命破队攻击增益前提（跨版本候选）',
  note: '页面构筑区包含音擎、驱动盘、主副词条、技能与队伍说明。',
})

seeds['agent-pyrois'] = candidateFromExplicitPage('agent-pyrois', {
  title: 'Prydwen Pyrois Best Build Guide',
  url: 'https://www.prydwen.gg/zenless/characters/pyrois',
  updatedAt: '2026-07-08T00:00:00.000Z',
  sourceVersion: '3.0',
  scenario: '终结技循环与以太直伤前提（3.0 候选）',
  note: '页面构筑区与更新追踪均标记为 3.0，包含音擎、驱动盘、词条、技能与队伍说明。',
})

export const currentBuildProfiles = targetAgents.map((agentId) => {
  const seed = seeds[agentId]
  const core = {
    schemaVersion: 1 as const,
    profileVersion: '3.0.0',
    gameVersion: '3.0',
    collectedAt: '2026-07-03T00:00:00.000Z',
    agentId,
    recommendationKind: 'current_best_available' as const,
    ...seed,
    sources: seed.sources.map((source) => ({
      ...source,
      applicableVersion: source.sourceVersion ?? '3.0',
      publishedAt: source.updatedAt,
      verifiedAt: '2026-07-03T00:00:00.000Z',
    })),
  }
  return { ...core, contentHash: contentHash(core) }
})

export function getCurrentBuildProfile(agentId: string) {
  return currentBuildProfiles.find((profile) => profile.agentId === agentId)
}

export function resolveBuildProfileAvailability(
  profile: (typeof currentBuildProfiles)[number],
  gameVersion: string,
) {
  if (profile.gameVersion !== gameVersion)
    return { status: 'stale' as const, calculable: false, reason: `仅适用于${profile.gameVersion}` }
  if (!profile.recommendation || profile.status === 'stale' || profile.status === 'missing')
    return { status: profile.status, calculable: false, reason: profile.blocker ?? '资料不足' }
  if (profile.status !== 'formal')
    return {
      status: profile.status,
      calculable: false,
      reason: '候选构筑仅供玩家阅读和仓库约束参考，未进入正式求解。',
    }
  return { status: profile.status, calculable: true, reason: null }
}

export function applyCurrentBuildDefaults(agent: RosterAgent): RosterAgent {
  const profile = getCurrentBuildProfile(agent.agentId)
  return profile?.status === 'formal'
    ? applyBuildRecommendation(agent, profile.defaultBranchId)
    : agent
}

export function selectBuildBranch(agent: RosterAgent, branchId: string): RosterAgent {
  return applyBuildRecommendation(agent, branchId)
}

function applyBuildRecommendation(agent: RosterAgent, branchId: string): RosterAgent {
  const profile = getCurrentBuildProfile(agent.agentId)
  if (!profile || profile.status !== 'formal') return agent
  const recommendation = getBuildRecommendation(profile, branchId)
  if (!recommendation) return agent
  const locked = new Set(agent.lockedFields)
  const preferredEngine = recommendation.wEngines[0]
  const engineName = preferredEngine
    ? (getEngineName(preferredEngine) ?? agent.wEngineDetails.name)
    : agent.wEngineDetails.name
  const next = { ...agent }
  if (!locked.has('skillLevels')) {
    next.skillLevels = { ...recommendation.skillTargets }
    next.skills = '当前最佳可用目标'
  }
  if (!locked.has('wEngineDetails') && !locked.has('wEngine')) {
    next.wEngineDetails = {
      id: preferredEngine ?? null,
      name: engineName,
      level: 60,
      refinement: 0,
    }
    next.wEngine = engineName ?? '待选择'
    next.refinement = 0
  }
  next.lockedFields = [
    ...next.lockedFields.filter((field) => !field.startsWith(`buildBranch:${profile.agentId}:`)),
    `buildBranch:${profile.agentId}:${branchId}`,
  ]
  return next
}

function getEngineName(engineId: string) {
  const knownNames: Record<string, string> = {
    'wengine-14156': '琳琅鎏心',
    'wengine-14154': '朔月裁霜',
    'wengine-14143': '云霓孤光',
    'wengine-14125': '玉壶青冰',
    'wengine-14119': '深海访客',
    'wengine-14110': '燃狱齿轮',
    'wengine-14104': '硫磺石',
    'wengine-13128': '轰鸣座驾',
    'wengine-13115': '好斗的阿炮',
    'wengine-13113': '含羞恶面',
    'wengine-13103': '聚宝箱',
    'wengine-13112': '比格气缸',
    'wengine-13101': '德玛拉电池Ⅱ型',
    'wengine-14155': '日冕遗蜕',
    'wengine-13108': '仿制星徽引擎',
    'wengine-13135': '裁纸刀',
    'wengine-13111': '旋钻机-赤轴',
    'wengine-13106': '家政员',
    'wengine-14102': '钢铁肉垫',
    'wengine-13142': '震元奇枢',
  }
  return knownNames[engineId] ?? null
}

export function getSelectedBuildBranchId(agent: RosterAgent) {
  const profile = getCurrentBuildProfile(agent.agentId)
  if (!profile) return null
  const prefix = `buildBranch:${profile.agentId}:`
  return (
    agent.lockedFields.find((field) => field.startsWith(prefix))?.slice(prefix.length) ??
    profile.defaultBranchId
  )
}

export function getBuildRecommendation(
  profile: (typeof currentBuildProfiles)[number],
  branchId: string,
) {
  if (!profile.recommendation) return null
  const branch = profile.playstyleBranches.find((item) => item.id === branchId)
  if (!branch?.primarySetOverride) return profile.recommendation
  return {
    ...profile.recommendation,
    sets: profile.recommendation.sets.map((plan, index) =>
      index === 0 ? { ...plan, primary: [branch.primarySetOverride!] } : plan,
    ),
  }
}

export function toAgentDiscProfile(
  profile: (typeof currentBuildProfiles)[number],
  branchId = profile.defaultBranchId,
): AgentDiscProfile | null {
  if (profile.status !== 'formal') return null
  const recommendation = getBuildRecommendation(profile, branchId)
  if (!recommendation) return null
  const mainStatFit = Object.fromEntries(
    Object.entries(recommendation.mainStats).map(([slot, stats]) => [
      slot,
      Object.fromEntries(stats.map((stat, index) => [stat, Math.max(0.7, 1 - index * 0.12)])),
    ]),
  )
  const setFit: Record<string, number> = {}
  for (const plan of recommendation.sets) {
    for (const setId of plan.primary) setFit[setId] = Math.max(setFit[setId] ?? 0, 1)
    for (const setId of plan.secondary) setFit[setId] = Math.max(setFit[setId] ?? 0, 0.78)
  }
  return {
    agentId: profile.agentId,
    version: profile.profileVersion,
    statWeights: recommendation.substatWeights,
    mainStatFit,
    setFit,
    confidence: profile.confidence,
    gameVersion: profile.gameVersion,
    scenario:
      profile.playstyleBranches.find((branch) => branch.id === branchId)?.scenario ??
      profile.scenario,
    setPlans: recommendation.sets.map((plan) => ({
      pattern: plan.pattern,
      primarySets: [...plan.primary],
      secondarySets: [...plan.secondary],
    })),
    mainStats: Object.fromEntries(
      Object.entries(recommendation.mainStats).map(([slot, stats]) => [slot, [...stats]]),
    ),
  }
}

export function getCalculableBuildProfiles(roster: AccountRoster, gameVersion = '3.0') {
  return currentBuildProfiles.flatMap((profile) => {
    const agent = roster.agents.find((item) => item.agentId === profile.agentId)
    if (!agent?.owned) return []
    // This is a warehouse-adaptation profile, not an exact damage source. Formal damage
    // calculations have a separate versioned gate and never promote this material to a
    // "highest damage" result.
    if (!resolveBuildProfileAvailability(profile, gameVersion).calculable) return []
    const calculable = toAgentDiscProfile(profile, getSelectedBuildBranchId(agent) ?? undefined)
    return calculable ? [calculable] : []
  })
}

export const currentBuildCoverage = {
  total: currentBuildProfiles.length,
  formal: currentBuildProfiles.filter((profile) => profile.status === 'formal').length,
  compatible: currentBuildProfiles.filter(
    (profile) => profile.status === 'compatible_with_evidence',
  ).length,
  stale: currentBuildProfiles.filter((profile) => profile.status === 'stale').length,
  missing: currentBuildProfiles.filter((profile) => profile.status === 'missing').length,
  high: currentBuildProfiles.filter((profile) => profile.confidence === 'high').length,
  medium: currentBuildProfiles.filter((profile) => profile.confidence === 'medium').length,
  low: currentBuildProfiles.filter((profile) => profile.confidence === 'low').length,
}
