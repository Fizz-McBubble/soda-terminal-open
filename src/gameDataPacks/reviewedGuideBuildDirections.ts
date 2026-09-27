import type { StatKey } from '../domain/schemas'
import type { PlayerBuildSource } from './playerBuildProfiles'

/** Field-local supplements retain the existing build values and their sources. */
export const reviewedGuideBuildConditions: Partial<
  Record<string, { path: string; conditions: string[]; source: PlayerBuildSource }>
> = {
  'agent-evelyn': {
    path: 'build.drive_disc_sets',
    conditions: [
      '其他已归档配装已补为历史参考：激素4/河豚4及其明确副套、啄木鸟4+折枝2、另一套2+2+2。未完成同面板与相同输出窗口比较，不据来源列序判当前收益排名。',
      '激素朋克4件的入场攻击增益只在触发窗口内生效；河豚电音4件需发动终结技后利用攻击增益。比较时应保持同一音擎、主副词条预算及队伍，分别核对入场、终结技与失衡窗口，不能假设全程增益。',
      '啄木鸟4件由普攻、闪避反击和强化特殊技分别触发并独立计时；长失衡期间难触发闪避反击，强化特殊技也受能量限制。耀嘉音、妮可循环下可考虑，不能按满层常驻比较。',
    ],
    source: {
      id: 'miyoushe-61945825-evelyn-disc-window-conditions',
      url: 'https://www.miyoushe.com/zzz/article/61945825',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: 'a4aed6e901c4fb2d9badbbb12dace96f2aa663d3fc789601c8de37f53a20a9f9',
      licenseBoundary:
        '已归档正文UTF16 4027:4223及图239036059；文章2025-10-31更新，标题1.5不作字段版本。啄木鸟独立计时与失衡限制另由61946271 op51说明，独立sourceRef随配盘参考保留。当前目录套装触发条件一致，但没有同面板收益比较证据；仅条件说明，不改数值、权重或自动方案。',
      verified: true,
    },
  },
  'agent-lucia': {
    path: 'build.drive_disc_sets',
    conditions: [
      '使用「铸梦炉歌」且生命值已满足目标时，「月光骑士颂」四件套可搭配「摇摆爵士」两件套补充回能；没有专属音擎时，可用「云岿如我」两件套稳定 24000 生命值条件。',
    ],
    source: {
      id: 'miyoushe-69626706-disc-conditional-secondary',
      url: 'https://www.miyoushe.com/zzz/article/69626706',
      sourceVersion: '2.3',
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '868f657c3eb5be4dd93a5a00ad697949f93ab19c5ceca1a2953782815744266b',
      licenseBoundary:
        '既有归档正文配盘段；bodySha256=1b1adfacb2ca8726b97514eb8fec49d57b18608790d2f0ebdabe448cb881a969；UTF-16 span4031:4119。版本为原帖标题，非当前最优声明；仅追加条件分支，保留目标区间及默认。',
      verified: true,
    },
  },
  'agent-rina': {
    path: 'build.main_sub_stats',
    conditions: [
      '丽娜激活潜能后，辅助电属性队或直伤队时，4 号位可选择暴击，副词条以双暴和攻击为主；辅助异常队时，4 号位选择异常精通，副词条以精通和攻击为主。两种方向均可使用 5 号位穿透率、6 号位能量回复。',
    ],
    source: {
      id: 'miyoushe-76974843-potential-team-stat-branches',
      url: 'https://www.miyoushe.com/zzz/article/76974843',
      sourceVersion: '3.1',
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '25785f506e60d0c6fd0867b626a24f1e815c0a0c57ae21ad3634715363c438ff',
      licenseBoundary:
        '既有3.1丽娜潜能激发攻略正文；bodySha256=596543e5fe6974a2006ad1e81ceb1b23c923626fc6f33346793c8c9d3161e39a；UTF-16 span1356:1449。按潜能与队型保留词条条件，不覆盖未激活潜能的通用基线，不新增评分权重。',
      verified: true,
    },
  },
  'agent-yidhari': {
    path: 'build.wengines',
    conditions: [
      '借用「青溟笼舍」时，伊德海莉可获得生命值和暴击率加成，但无法触发要求以太贯穿伤害的其他效果；借用「燔火胧夜」时，主要取生命加成及生命降低时的暴击收益，高阶时可考虑。',
    ],
    source: {
      id: 'miyoushe-70303559-image-241935911-wengine-conditions',
      url: 'https://www.miyoushe.com/zzz/article/70303559',
      sourceVersion: '2.3',
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '05c72088bfb17f898e8d0c3cc2eac0524a3a0da7437db42eea42c859cd505ae5',
      licenseBoundary:
        '既有原图241935911「音擎选择」次选段逐字复核；版本为原帖标题，不分发原图。仅解释现有借用音擎的部分效果，不改音擎集合、排序或评分。',
      verified: true,
    },
  },
  'agent-astra': {
    path: 'build.drive_disc_sets',
    conditions: [
      '使用「静听嘉音」四件套时，以满级核心技的 3429 攻击力为目标；未达到时优先「激素朋克」两件套，达到后可改用「摇摆爵士」两件套补充回能。',
    ],
    source: {
      id: 'miyoushe-65063323-fold-56-disc-condition',
      url: 'https://www.miyoushe.com/zzz/article/65063323',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '60b5354d21f977f09fa693f48a982032257cf1ff7756bc576a3b9969d20244b7',
      licenseBoundary:
        '既有归档嵌套正文逐字段复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op56 insert.fold unitRawSha256=60b5354d21f977f09fa693f48a982032257cf1ff7756bc576a3b9969d20244b7；op29 insert.fold unitRawSha256=a3793965e8bbf464c6678469e38f75ae9810b52667417f129468d304b4e5aab8。来源段落未独立标注版本，旧文章标题不作为当前适用版本；仅补现有配盘分支使用条件，不改变排序、权重或账户。',
      verified: true,
    },
  },
  'agent-pan-yinhu': {
    path: 'build.drive_disc_sets',
    conditions: [
      '使用「静听嘉音」四件套时，以满级核心技的 3000 攻击力为目标；未达到时优先「激素朋克」两件套，达到后可改用「摇摆爵士」两件套补充回能。',
    ],
    source: {
      id: 'miyoushe-65136583-fold-51-disc-condition',
      url: 'https://www.miyoushe.com/zzz/article/65136583',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '2b3b6b4c9f46b7b4725fa0101e20870f50ce4e20fa77108cd814084f0cd9515a',
      licenseBoundary:
        '既有归档嵌套正文逐字段复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op51 insert.fold unitRawSha256=2b3b6b4c9f46b7b4725fa0101e20870f50ce4e20fa77108cd814084f0cd9515a；op26 insert.fold unitRawSha256=2665176d82cfbee4d0e5272dcbce621ed082a66c23a75590bc691b4612ef4f17。来源段落未独立标注版本，旧文章标题不作为当前适用版本；仅补现有配盘分支使用条件，不改变排序、权重或账户。',
      verified: true,
    },
  },
  'agent-seth': {
    path: 'build.drive_disc_sets',
    conditions: [
      '队友已经装备「静听嘉音」四件套时，可选择「原始朋克」四件套；通过招架支援触发其全队增伤。',
    ],
    source: {
      id: 'miyoushe-67460846-fold-54-disc-condition',
      url: 'https://www.miyoushe.com/zzz/article/67460846',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '5dd80d26effad6d575241673359d51d63ba7c7462668cc806fe273b1d7dbc83a',
      licenseBoundary:
        '既有归档嵌套正文逐字段复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op54 insert.fold unitRawSha256=5dd80d26effad6d575241673359d51d63ba7c7462668cc806fe273b1d7dbc83a。来源段落未独立标注版本，旧文章标题不作为当前适用版本；仅补现有配盘分支使用条件，不改变排序、权重或账户。',
      verified: true,
    },
  },
  'agent-trigger': {
    path: 'build.drive_disc_sets',
    conditions: [
      '「山大王」四件套更建议搭配专属音擎使用；面板暴击率目标至少 90%，暴击率溢出时可选择「震星迪斯科」两件套。',
    ],
    source: {
      id: 'miyoushe-68301592-fold-60-disc-condition',
      url: 'https://www.miyoushe.com/zzz/article/68301592',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '83471d93b3b873ec67efba871b564529a8d4d3d2e842d2f732c09eac1fb3af1a',
      licenseBoundary:
        '既有归档嵌套正文逐字段复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op60 insert.fold unitRawSha256=83471d93b3b873ec67efba871b564529a8d4d3d2e842d2f732c09eac1fb3af1a。来源段落未独立标注版本，旧文章标题不作为当前适用版本；仅补现有配盘分支使用条件，不改变排序、权重或账户。',
      verified: true,
    },
  },
  'agent-lucy': {
    path: 'build.drive_disc_sets',
    conditions: ['单支援队伍中，「静听嘉音」四件套通常只能维持两层，较难稳定叠满三层。'],
    source: {
      id: 'miyoushe-68852865-fold-53-disc-condition',
      url: 'https://www.miyoushe.com/zzz/article/68852865',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '8ca685f68c18832c3f1954f8194246dc6a332348da9fc95c24887b540f43e75c',
      licenseBoundary:
        '既有归档嵌套正文逐字段复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op53 insert.fold unitRawSha256=8ca685f68c18832c3f1954f8194246dc6a332348da9fc95c24887b540f43e75c。来源段落未独立标注版本，旧文章标题不作为当前适用版本；仅补现有配盘分支使用条件，不改变排序、权重或账户。',
      verified: true,
    },
  },
  'agent-ju-fufu': {
    path: 'build.drive_disc_sets',
    conditions: [
      '使用四件套「山大王」时，攻击力达到 3400 后再选「震星迪斯科」两件套以提高冲击力。',
    ],
    source: {
      id: 'miyoushe-2.0-post-65843423-image-231499917-shockstar-condition',
      url: 'https://www.miyoushe.com/zzz/article/65843423',
      sourceVersion: '2.0',
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '3cf6efe111bcf70468881f2fab4d6ad197cd09928dba2044b776f0f72d80aa00',
      licenseBoundary:
        '本地原图字段提取，不分发原图。图 231499917「4山大王+2震星」推荐理由：当攻击达到3400点后，也可以选择震星2件套。仅补配盘条件，不改变目标面板范围、套装排序、评分或机制。',
      verified: true,
    },
  },
}

/** Only fields read from the archived image supersede older guide fields. */
export const reviewedGuideBuildDirections: Partial<
  Record<
    string,
    {
      wengines: string[]
      sets: string[]
      stats: { mainStats: Record<'4' | '5' | '6', StatKey[]>; subStats: StatKey[] }
      source: PlayerBuildSource
    }
  >
> = {
  'agent-aria': {
    // Best, excellent, free and battle-pass options, respectively; not a DPS ranking.
    wengines: ['wengine-14150', 'wengine-14133', 'wengine-13008', 'wengine-13009'],
    sets: [
      '法厄同之歌 4 件 + 流光咏叹 2 件（当前版本优先）',
      '流光咏叹 4 件 + 法厄同之歌 2 件（备选，当前版本不优选）',
    ],
    stats: {
      mainStats: {
        '4': ['anomaly_proficiency'],
        '5': ['ether_dmg', 'atk_percent'],
        '6': ['anomaly_mastery'],
      },
      subStats: ['anomaly_proficiency', 'atk_percent', 'atk_flat'],
    },
    source: {
      id: 'miyoushe-3.1-post-76995934-author-79695828-build-image-001',
      url: 'https://www.miyoushe.com/zzz/article/76995934',
      sourceVersion: '3.1',
      checkedAt: '2026-09-07T08:54:51.000Z',
      contentHash: 'C9D057ECCABB412188F000242862EC637CAB39ABE89C61232B66BA6E1A6F215A',
      licenseBoundary:
        '本地候选字段提取；归档主图 001.png 的音擎、驱动盘与词条区，不分发原图。流光按目录解析为流光咏叹。只替换这三个字段，不核准旧队伍或毕业面板；未从攻略推导精确收益或权重。',
      verified: true,
    },
  },
}

/** Independent field sources coexist with an agent's disc condition. */
export const reviewedAdditionalGuideBuildConditions: Array<{
  agentId: string
  path: string
  conditions: string[]
  source: PlayerBuildSource
}> = [
  {
    agentId: 'agent-yanagi',
    path: 'build.wengines',
    conditions: [
      '装备「时流贤者」时，异常精通达到 375 才会触发其紊乱伤害增益；这是音擎效果条件，不是所有柳配装的无条件最低面板。',
    ],
    source: {
      id: 'miyoushe-59164221-field-52-conditional-build',
      url: 'https://www.miyoushe.com/zzz/article/59164221',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '752491bff10044ec13ddae690bfd3e55857b62c690ffc8c08d012aa082c2ebcf',
      licenseBoundary:
        '已独立复核原图208905341及原文；archiveSha256=5ed94053d19bd1d3aff6b944a534998a9a1d64d7568ee6d1589d050a0d46097e；op252 opRawSha256=90a5f0bb5c1c328b4ad583804db2bca994ee577cdd69b198791e08e578482d5c；imageSha256=752491bff10044ec13ddae690bfd3e55857b62c690ffc8c08d012aa082c2ebcf。原文章标题不作为更新后字段版本；只补已有选项使用条件，不改变词条、目标、权重。',
      verified: true,
    },
  },
  {
    agentId: 'agent-astra',
    path: 'build.drive_disc_sets',
    conditions: [
      '装备专属音擎「玲珑妆匣」且满足攻击力目标后，可选择「摇摆爵士」两件套稳定能量循环。',
    ],
    source: {
      id: 'miyoushe-61285006-field-153-conditional-build',
      url: 'https://www.miyoushe.com/zzz/article/61285006',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: 'da9bfbe38addd403d301a45f8583bb65001dbb045fc9860de57c9bf654a34a4b',
      licenseBoundary:
        '已独立复核原图217355709及原文；archiveSha256=5ed94053d19bd1d3aff6b944a534998a9a1d64d7568ee6d1589d050a0d46097e；op316 opRawSha256=6cc2f4c68d018e480ff47d2398a7c69eb066514b8c2dbc41083ffef4c2bd8504；imageSha256=b5f7dbd138504fb9854e0c83a04b6e01b87905f20362a128c0574ba9952c0682。原顶层正文UTF16 span=4383:4420 textSha256=da9bfbe38addd403d301a45f8583bb65001dbb045fc9860de57c9bf654a34a4b。原文章标题不作为更新后字段版本；只补已有选项使用条件，不改变词条、目标、权重。',
      verified: true,
    },
  },
  {
    agentId: 'agent-astra',
    path: 'build.main_sub_stats',
    conditions: ['装备「玲珑妆匣」且已满足核心增益所需攻击力时，6 号位可选择能量自动回复。'],
    source: {
      id: 'miyoushe-61285006-field-152-conditional-build',
      url: 'https://www.miyoushe.com/zzz/article/61285006',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '5b3ef3d9b6ca4bdaa0ac1b60c71767db482e10ec9ef20880b6f443c504f31cb3',
      licenseBoundary:
        '已独立复核原图218153832及原文；archiveSha256=5ed94053d19bd1d3aff6b944a534998a9a1d64d7568ee6d1589d050a0d46097e；op293 opRawSha256=19e0c93cde7b866a7c8b724583187efb82881f086071b1f5a0d045ce722fca16；imageSha256=6cc10bb77a862710c4e6bd6bb69a57697a4d2959824c73d23cf3fdda9ed379a6。原顶层正文UTF16 span=3923:3980 textSha256=5b3ef3d9b6ca4bdaa0ac1b60c71767db482e10ec9ef20880b6f443c504f31cb3。原文章标题不作为更新后字段版本；只补已有选项使用条件，不改变词条、目标、权重。',
      verified: true,
    },
  },
]

export function getReviewedGuideBuildConditions(agentId: string, path: string) {
  const original = reviewedGuideBuildConditions[agentId]
  return [
    ...(original?.path === path ? [original] : []),
    ...reviewedAdditionalGuideBuildConditions.filter(
      (entry) => entry.agentId === agentId && entry.path === path,
    ),
  ]
}

/** Source completeness only: never merged into executable build directions. */
const reviewedHistoricalWEngineReferences = [
  {
    agentId: 'agent-soukaku',
    engineId: 'wengine-13115',
    engineName: '好斗的阿炮',
    status: 'historical_reference',
    automaticEligibility: false,
    conditions: [
      '旧攻略将「好斗的阿炮」作为回能选项，用于积攒能量施放强化特殊技，并提供全队攻击力加成。',
      '历史来源参考，未核准为当前版本优选，不用于自动配装或评分。',
    ],
    source: {
      id: 'miyoushe-64658713-fold-50-historical-wengine',
      url: 'https://www.miyoushe.com/zzz/article/64658713',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '16be089aa33401c681f47a323c52815d6dfc8ef8de00696e81ddad98530cf216',
      verified: true,
      licenseBoundary:
        '既有归档嵌套文本复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op50 insert.fold；textSha256=f154f077fded942fbd7a7a91751c8bc43e0f1d1cb8a317c2ee885508a463397f。仅保留历史作者选项，不分发原图，不改变当前候选、默认、排序或权重。',
    },
    evidence: {
      archiveSha256: '1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd',
      sourcePath:
        "soda-source-ref:0a2a3e8c0c1121edc9edaad92f152a82",
      locator: {
        kind: 'miyoushe_nested_text_unit',
        opIndex: 50,
        fieldPath: ['insert', 'fold'],
      },
      unitRawSha256: '16be089aa33401c681f47a323c52815d6dfc8ef8de00696e81ddad98530cf216',
      textSha256: 'f154f077fded942fbd7a7a91751c8bc43e0f1d1cb8a317c2ee885508a463397f',
      sourceCreatedAt: '2025-05-23T16:00:15.000Z',
      sourceUpdatedAt: '2025-05-31T16:04:00.000Z',
      sourceTitle: '【1.7攻略征集】苍角 角色玩法介绍',
      sourceText:
        '好斗的阿炮\n\n\n音擎词条提供大量能量自动回复加成，可帮助苍角快速积攒能量打出强化特殊技\n此外，武器特效还提供了全队攻击力加成\n',
    },
  },
  {
    agentId: 'agent-nicole',
    engineId: 'wengine-13115',
    engineName: '好斗的阿炮',
    status: 'historical_reference',
    automaticEligibility: false,
    conditions: [
      '旧攻略将「好斗的阿炮」作为回能和全队攻击力增益选项。',
      '历史来源参考，未核准为当前版本优选，不用于自动配装或评分。',
    ],
    source: {
      id: 'miyoushe-68488252-fold-49-historical-wengine',
      url: 'https://www.miyoushe.com/zzz/article/68488252',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: 'cd6976d3965cdcee44508113d973d235bd3a9d78cda84be6d2e17ff3264d85b1',
      verified: true,
      licenseBoundary:
        '既有归档嵌套文本复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op49 insert.fold；textSha256=19f505c756e55f6a6f74fbefde5c5ac503c3e26b8fbecaf3a00a6455da1afccd。仅保留历史作者选项，不分发原图，不改变当前候选、默认、排序或权重。',
    },
    evidence: {
      archiveSha256: '1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd',
      sourcePath:
        "soda-source-ref:0a2a3e8c0c1121edc9edaad92f152a82",
      locator: {
        kind: 'miyoushe_nested_text_unit',
        opIndex: 49,
        fieldPath: ['insert', 'fold'],
      },
      unitRawSha256: 'cd6976d3965cdcee44508113d973d235bd3a9d78cda84be6d2e17ff3264d85b1',
      textSha256: '19f505c756e55f6a6f74fbefde5c5ac503c3e26b8fbecaf3a00a6455da1afccd',
      sourceCreatedAt: '2025-09-12T15:55:39.000Z',
      sourceUpdatedAt: '2025-09-23T16:05:03.000Z',
      sourceTitle: '【2.2攻略征集】妮可 角色玩法介绍',
      sourceText:
        '好斗的阿炮\n\n\n推荐理由：\n音擎词条大大提高了妮可的能量自动回复\n此外音擎效果还能为全队提供攻击力加成，进一步提高了妮可的辅助能力\n',
    },
  },
  {
    agentId: 'agent-pan-yinhu',
    engineId: 'wengine-13011',
    engineName: '春日融融',
    status: 'historical_reference',
    automaticEligibility: false,
    conditions: [
      '旧攻略将「春日融融」作为攻击力及自身、队友回能选项；原文标为月卡音擎。',
      '历史来源参考，未核准为当前版本优选，不用于自动配装或评分。',
    ],
    source: {
      id: 'miyoushe-65136583-fold-46-historical-wengine',
      url: 'https://www.miyoushe.com/zzz/article/65136583',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '900f5adf4b5c88c3dce4677cb92a5857d5f21c821473c4df67652de01b645b21',
      verified: true,
      licenseBoundary:
        '既有归档嵌套文本复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op46 insert.fold；textSha256=e9aa971c6d4ace1b8d669277a4299b0dcf7fa58d3074d719152866c1534d2bf4。仅保留历史作者选项，不分发原图，不改变当前候选、默认、排序或权重。',
    },
    evidence: {
      archiveSha256: '1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd',
      sourcePath:
        "soda-source-ref:0a2a3e8c0c1121edc9edaad92f152a82",
      locator: {
        kind: 'miyoushe_nested_text_unit',
        opIndex: 46,
        fieldPath: ['insert', 'fold'],
      },
      unitRawSha256: '900f5adf4b5c88c3dce4677cb92a5857d5f21c821473c4df67652de01b645b21',
      textSha256: 'e9aa971c6d4ace1b8d669277a4299b0dcf7fa58d3074d719152866c1534d2bf4',
      sourceCreatedAt: '2025-06-08T16:00:36.000Z',
      sourceUpdatedAt: '2025-06-13T16:07:26.000Z',
      sourceTitle: '【2.0攻略征集】潘引壶 角色玩法介绍',
      sourceText:
        '春日融融（月卡音擎）\n\n\n推荐理由：\n音擎词条提供了不错的攻击力加成，此外音擎还能为自身及队友提供回能效果，还是非常不错的\n',
    },
  },
  {
    agentId: 'agent-seth',
    engineId: 'wengine-13142',
    engineName: '震元奇枢',
    status: 'historical_reference',
    automaticEligibility: false,
    conditions: [
      '旧攻略将「震元奇枢」作为攻击力和强化特殊技伤害选项；队伍中角色受到伤害时，为装备者提供能量回复。',
      '历史来源参考，未核准为当前版本优选，不用于自动配装或评分。',
    ],
    source: {
      id: 'miyoushe-67460846-fold-49-historical-wengine',
      url: 'https://www.miyoushe.com/zzz/article/67460846',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '5d911cb2fb59d9ae0adb25411d34961b348c1579c7e1342b353e1630ccc24d99',
      verified: true,
      licenseBoundary:
        '既有归档嵌套文本复核；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op49 insert.fold；textSha256=2bc1e790469fb393d4b23929755453719670e0da13abda9c56c6891a18d1bea4。仅保留历史作者选项，不分发原图，不改变当前候选、默认、排序或权重。',
    },
    evidence: {
      archiveSha256: '1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd',
      sourcePath:
        "soda-source-ref:0a2a3e8c0c1121edc9edaad92f152a82",
      locator: {
        kind: 'miyoushe_nested_text_unit',
        opIndex: 49,
        fieldPath: ['insert', 'fold'],
      },
      unitRawSha256: '5d911cb2fb59d9ae0adb25411d34961b348c1579c7e1342b353e1630ccc24d99',
      textSha256: '2bc1e790469fb393d4b23929755453719670e0da13abda9c56c6891a18d1bea4',
      sourceCreatedAt: '2025-08-13T15:59:32.000Z',
      sourceUpdatedAt: '2025-08-16T16:19:19.000Z',
      sourceTitle: '【2.1攻略征集】赛斯 角色玩法介绍',
      sourceText:
        '震元奇枢\n\n\n推荐理由：\n音擎词条提供了攻击力加成\n还能提高强化特殊技的伤害\n同时队伍中角色受到伤害还能为自身提供能量回复\n',
    },
  },
] as const

export function getReviewedHistoricalWEngineReferences(agentId: string) {
  return reviewedHistoricalWEngineReferences.filter((entry) => entry.agentId === agentId)
}
