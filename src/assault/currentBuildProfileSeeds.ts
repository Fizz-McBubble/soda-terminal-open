import type { CurrentBuildProfileStatus } from './currentBuildProfiles'
import type { Recommendation } from './currentBuildProfileLegacyDirections'
import { anomalyWeights, unverifiedLegacyDirections } from './currentBuildProfileLegacyDirections'
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

export const targetAgents = [
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

export const seeds: Record<
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
