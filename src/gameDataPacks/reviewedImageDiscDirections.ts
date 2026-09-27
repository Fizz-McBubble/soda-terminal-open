import type { ReviewedTeamDiscDirection } from './reviewedTeamDiscConditions'

const lycaonImageHash = 'db528dcb0cb0cc49aca1d2cd76003bb91afa94e89e427b2009cbba5810ea5a5e'
const piperImageHash = '2f21607972ed4e456f12a2c347ce8d417a8bccc6d83306edf23b498fe1508f4b'

/** Exact illustrated contexts only. The source image hashes describe image bytes,
 * not article text, and older recommendations do not become current-version rankings. */
export const reviewedImageDiscDirections: readonly ReviewedTeamDiscDirection[] = [
  {
    id: 'miyoushe-73045858-lycaon-potential-illustrated-teams',
    agentId: 'agent-lycaon',
    exactMemberSets: [
      ['agent-lycaon', 'agent-soukaku', 'agent-miyabi'],
      ['agent-lycaon', 'agent-hugo', 'agent-lighter'],
    ],
    potentialMinimumByAgentId: { 'agent-lycaon': 6 },
    retainBasePlans: true,
    mainStats: { '6': ['impact', 'energy_regen'] },
    setPlan: {
      pattern: '4+2',
      primarySetIds: ['set-king-of-the-summit', 'set-proto-punk'],
      secondarySetIds: ['set-shockstar-disco'],
      sourceText:
        '山大王 / 原始朋克 4 件 + 震星迪斯科 2 件（2.6图鉴潜能开启，限图示队伍候选；6号位冲击力/能量恢复）',
    },
    source: {
      postId: '73045858',
      url: 'https://www.miyoushe.com/zzz/article/73045858',
      contentHash: lycaonImageHash,
      bodyHash: lycaonImageHash,
      sourceVersion: '2.6',
      targetVersion: '3.1',
      locator: {
        kind: 'archived_image_region',
        text: '73045858-1.png：激发潜能ON；驱动盘推荐分区6冲击力/能量恢复；下方莱卡恩+苍角+雅、莱卡恩+雨果+莱特。',
      },
    },
    boundary:
      '仅复用2.6原图的潜能6/6与图示队伍方向，未推定较低潜能也适用；hash为图片字节。回能是可选项，不证明优于冲击；不预设山大王50%暴击条件或原始朋克极限支援增益已满足。',
  },
  {
    id: 'miyoushe-77017654-piper-remielle-velina-image',
    agentId: 'agent-piper',
    exactMemberSets: [['agent-piper', 'agent-remielle', 'agent-velina']],
    potentialMinimumByAgentId: {},
    retainBasePlans: true,
    mainStats: { '5': ['physical_dmg', 'atk_percent', 'pen_ratio'] },
    setPlan: {
      pattern: '4+2',
      primarySetIds: ['set-fanged-metal'],
      secondarySetIds: ['set-phaethons-melody'],
      sourceText:
        '獠牙重金属 4 件 + 法厄同之歌 2 件（蕾米埃尔、维琳娜队中以派派替换简；4号精通，5号穿透/物伤，6号掌控）',
    },
    source: {
      postId: '77017654',
      url: 'https://www.miyoushe.com/zzz/article/77017654',
      contentHash: piperImageHash,
      bodyHash: piperImageHash,
      sourceVersion: '3.1',
      targetVersion: '3.1',
      locator: {
        kind: 'archived_image_region',
        text: '010-2f21607972ed4e45.png：丹简维；无简可换派派，派派④异常精通⑤穿透/物伤⑥掌控。',
      },
    },
    boundary:
      '仅采用同图明确的派派替代分支；保留原有攻击五号候选，不将图示穿透顺序当作伤害排名，也不无条件改变其他队伍。hash为图片字节。',
  },
]
