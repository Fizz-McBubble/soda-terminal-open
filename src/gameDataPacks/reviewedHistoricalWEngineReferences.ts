import { reviewedGuideWEngineDirections20261014 } from './reviewedGuideWEngineDirections20261014'

/** Source completeness only; these references never become executable build directions. */
const reviewedHistoricalWEngineReferences = [
  {
    agentId: 'agent-cissia',
    engineId: 'wengine-14146',
    engineName: '机巧心种',
    status: 'historical_reference',
    automaticEligibility: false,
    conditions: [
      '「机巧心种」只按原文主C流希希芙条件保留，不作为辅助席德的无条件自动选项。',
      '历史来源参考，不用于自动配装或评分。',
    ],
    source: {
      id: 'miyoushe-74657525-wengines-ops-217-224-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/74657525',
      sourceVersion: '2.7',
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '5cf4b55bdb5004219e8b22d0505bfcb0e7b7b2e3871cb002af3bfd32c04765c5',
      verified: true,
      licenseBoundary:
        '既有锁源逐字段复用；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；post 74657525/structured_content ops[217:224) rawSha256=5cf4b55bdb5004219e8b22d0505bfcb0e7b7b2e3871cb002af3bfd32c04765c5；textSha256=6a1b18d9207ccdc73bb1ca684b7352f6a64faa2655862ca355f66590b0341c13。仅原版本候选/历史参考，保留明确接受者及触发条件，不作当前收益排行或分发原文。',
    },
    evidence: {
      archiveSha256: '1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd',
      sourcePath:
        "soda-source-ref:0a2a3e8c0c1121edc9edaad92f152a82",
      locator: {
        kind: 'miyoushe_text_ops',
        postId: '74657525',
        opStart: 217,
        opEnd: 224,
      },
      unitRawSha256: '5cf4b55bdb5004219e8b22d0505bfcb0e7b7b2e3871cb002af3bfd32c04765c5',
      sourceCreatedAt: '2026-04-16T01:48:01.000Z',
      sourceUpdatedAt: '2026-04-24T16:09:37.000Z',
      sourceTitle: '【2.7攻略征集】希希芙 角色玩法解析',
      sourceText:
        '\n»2.机巧心种\n提供了高额暴击率加成，并能够获得电属性伤害加成，以及无视防御加成\n适合主C流希希芙使用\n',
      textSha256: '6a1b18d9207ccdc73bb1ca684b7352f6a64faa2655862ca355f66590b0341c13',
    },
  },
  {
    agentId: 'agent-banyue',
    engineId: 'wengine-13144',
    engineName: '燔火胧夜',
    status: 'historical_reference',
    automaticEligibility: false,
    conditions: reviewedGuideWEngineDirections20261014.find(
      (entry) => entry.agentId === 'agent-banyue',
    )!.conditions,
    source: reviewedGuideWEngineDirections20261014.find(
      (entry) => entry.agentId === 'agent-banyue',
    )!.source,
    evidence: {
      archiveSha256: '501D5CF80819A44C16DBA945790C7AF96C4CE0B42F174EED93307845CB8F2E93',
      sourcePath:
        "soda-source-ref:00a67e3a36932bc3354b8433e6157379",
      locator: {
        kind: 'miyoushe_nested_text_unit',
        postId: '71526574',
        opIndex: 42,
        fieldPath: ['insert'],
      },
      unitRawSha256: '16ff284be08d4efd4ee0147cf46a1bbb879fc25e08aea0a8acf452956e802197',
      sourceTitle: '【2.4攻略征集】「般岳」全面解析︱养成/配队/机制',
      sourceCreatedAt: '2025-12-17T04:10:21.000Z',
      sourceUpdatedAt: '2026-03-13T00:34:32.000Z',
      textSha256: '3f2818e8615624bb1ab5d228964fe8c01d1d00aae4e8cf92c2b86187b29f5c45',
      sourceText:
        '【燔火胧夜】\n*5阶相对专武在85%左右。\n① 只能获得暴击、生命加成，整体幅度略小于上述S级音擎。\n② 如果该音擎已高阶且不培养真斗，可作为第三顺位选择。',
    },
  },
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
