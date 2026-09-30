import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart06: Partial<Record<string, PageCandidateDirection>> = {
  'agent-orphie-magus': {
    source: {
      id: 'prydwen-orphie-magus-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/orphie-and-magus',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/orphie-and-magus',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Bellicose Blaze',
      'Heartstring Nocturne',
      'Severed Innocence',
      'Myriad Eclipse',
      'Cordis Germina',
      'Gilded Blossom',
      'Marcato Desire',
    ],
    sets: [
      'Shadow Harmony 4 件 + Swing Jazz / Moonlight Lullaby 2 件',
      '双攻击队可用 Astral Voice 4 件 + Swing Jazz / Moonlight Lullaby 2 件',
    ],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：火伤优先，其次攻击力%', '6号位：能量回复或攻击力%'],
      sub: [
        '暴击伤害/暴击率、攻击力%、穿透、攻击力；候选终局方向为暴击率 90–100%、能量回复 80%+。',
      ],
    },
    progression: [
      '围绕 Bottled Heat 与 Zeroed In：100 热量后强化特殊技快速支援并给全队增益；技能优先特殊、连携、支援、普攻、闪避。',
    ],
    team: ['副C/Aftershock：优先席德或零号·安比，可与扳机/橘福福协同；邦布方向未作稳定候选。'],
  },
  'agent-soldier-0-anby': {
    source: {
      id: 'prydwen-soldier0-anby-2.5',
      url: 'https://www.prydwen.gg/zenless/characters/anby-demara-soldier-0',
      sourceVersion: '2.5',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/anby-demara-soldier-0',
        buildVersion: '2.5',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面的构筑更新标为 2.5。',
      verified: true,
    },
    wengines: ['Severed Innocence', 'Cordis Germina', 'Heartstring Nocturne', 'Marcato Desire'],
    sets: [
      '页面明确的 Aftershock/暴击输出构筑；4 件套与 4/5/6 号位需同版本字段复核，不能从候选结论外推。',
    ],
    stats: {
      main: ['4/5/6号位：页面已定位为暴击/电伤/攻击取向，精确优先级待同版本字段核验。'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透；Cordis Germina 前提下须调整暴击率避免溢出。'],
    },
    progression: [
      '围绕 Silver Star、Azure Flash 与失衡窗口；120 能量双 EX 或双连携循环均为候选手动参考。',
    ],
    team: [
      'Aftershock 输出：奥菲丝&「鬼火」+扳机为页面计算队；也可与橘福福协同。邦布方向未作稳定候选。',
    ],
  },
  'agent-yidhari': {
    source: {
      id: 'prydwen-yidhari-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/yidhari',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/yidhari',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      "Kraken's Cradle",
      "Grill O'Wisp",
      'Cauldron of Clarity',
      'Qingming Birdcage',
      'Radiowave Journey',
      'Puzzle Sphere',
    ],
    sets: ['Yunkui Tales 4 件 + Woodpecker Electro / Branch & Blade Song 2 件'],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：冰伤或生命值%', '6号位：生命值%'],
      sub: ['暴击率、暴击伤害、生命值%、攻击力%；候选暴击率为 58.6–65.8%（战斗内可提高）。'],
    },
    progression: [
      '以耗血充能的 Frostbite Embrace、Glacial Crush 与失衡连携为核心；特殊、连携、普攻、支援、闪避按页面顺序投入。',
    ],
    team: [
      '裂隙输出：卢西娅为优先辅助，潘引壶为可获得替代；琉音优先击破、莱卡恩替代。邦布方向未作稳定候选。',
    ],
  },
}
