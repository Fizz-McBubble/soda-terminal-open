import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart11: Partial<Record<string, PageCandidateDirection>> = {
  'agent-starlight-billy': {
    source: {
      id: 'prydwen-starlight-billy-2.8',
      url: 'https://www.prydwen.gg/zenless/characters/billy-starlight',
      sourceVersion: '2.8',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/billy-starlight',
        buildVersion: '2.8',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.8。',
      verified: true,
    },
    wengines: [
      'Starlight Rider Faceplate',
      'Qingming Birdcage',
      'Cauldron of Clarity',
      'Steel Cushion',
      "Grill O'Wisp",
    ],
    sets: [
      '裂隙暴击候选方向 + Hormone Punk / Bunny in Wonderland 2 件；主套精确名称待同版本构筑区核验。',
    ],
    stats: {
      main: [
        '4号位：暴击率/暴击伤害/生命值%',
        '5号位：物理伤害优先，其次生命值%',
        '6号位：生命值%',
      ],
      sub: ['暴击率、暴击伤害、生命值%、攻击力；候选 Sheer Force 2200+、生命 18000+。'],
    },
    progression: [
      '通过 Drive Suppression 耗血、普攻/闪避反击回血，积累 Determination 后释放 Full-Throttle Starlight；失衡内保留 Cool Wheelie、终结技和强化普攻。',
    ],
    team: ['裂隙：琉音+卢西娅候选计算队；诺姆可提供额外连携的替代方向。邦布方向未作稳定候选。'],
  },
  'agent-norma': {
    source: {
      id: 'prydwen-norma-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/norma',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/norma',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Chief Sidekick',
      'Hellfire Gears',
      'Steam Oven',
      'Blazing Laurel',
      'The Simmering Pot',
    ],
    sets: ['King of the Summit 4 件 + Swing Jazz / Moonlight Lullaby / Woodpecker Electro 2 件'],
    stats: {
      main: ['4号位：暴击率', '5号位：火伤优先，其次穿透率/攻击力%', '6号位：能量回复/冲击力'],
      sub: ['暴击率至战斗内 100%，随后暴击伤害、攻击力%、穿透、攻击力；候选攻击力 2400+。'],
    },
    progression: [
      '尽早强化特殊进入 En-Nah Barrage，后台炮塔叠 Daze；失衡中段以蓄力普攻给主C额外连携，注意 Preheated Chamber。',
    ],
    team: [
      '千夏泛用辅助组合，佩洛伊斯/11号、希希芙/奥菲丝、雨果或裂隙输出可选；团队按额外连携和失衡窗口调整。邦布方向未作稳定候选。',
    ],
  },
  'agent-yixuan': {
    source: {
      id: 'prydwen-yixuan-2.5',
      url: 'https://www.prydwen.gg/zenless/characters/yixuan',
      sourceVersion: '2.5',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/yixuan',
        updatedAt: '2026-06-14',
        buildVersion: '2.5',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Qingming Birdcage', 'Cauldron of Clarity', 'Radiowave Journey', 'Puzzle Sphere'],
    sets: ['Yunkui Tales 4 件 + Woodpecker Electro / Branch & Blade Song 2 件'],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：以太伤害/生命值', '6号位：生命值'],
      sub: ['暴击率/暴击伤害、生命值%、攻击力%'],
    },
    progression: ['候选页面包含构筑与终局面板；技能/核心优先级需同版本独立核验。'],
    team: ['页面计算假设：橘福福与卢西娅；不等同唯一队伍或正式最优。'],
  },
}
