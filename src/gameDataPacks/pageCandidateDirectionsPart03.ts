import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart03: Partial<Record<string, PageCandidateDirection>> = {
  'agent-harumasa': {
    source: {
      id: 'prydwen-harumasa-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/harumasa',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/harumasa',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Cordis Germina',
      'Zanshin Herb Case',
      'The Brimstone',
      'Heartstring Nocturne',
      'Severed Innocence',
      'Starlight Engine',
    ],
    sets: [
      'Thunder Metal 4 件 + Hormone Punk / Astral Voice / Branch & Blade Song / Shadow Harmony / Woodpecker Electro 2 件',
      'Shadow Harmony 4 件 + Branch & Blade Song / Woodpecker Electro / Astral Voice / Hormone Punk 2 件',
    ],
    stats: {
      main: ['4号位：攻击力%优先，暴击伤害/暴击率', '5号位：攻击力%/电伤', '6号位：攻击力%'],
      sub: ['暴击率至面板 75%，其后攻击力%、暴击伤害、穿透值、攻击力'],
    },
    progression: [
      '失衡爆发：先布置箭矢，失衡内围绕强化冲刺；核心、影画与具体技能等级需同版本独立核验。',
    ],
    team: [
      '击破爆发：琉音/青衣/扳机/安比之一 + 柚叶/妮可/耀嘉音等辅助；电异常对齐会影响 Thunder Metal 覆盖。',
    ],
  },
  'agent-lighter': {
    source: {
      id: 'prydwen-lighter-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/lighter',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/lighter',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Blazing Laurel',
      'Ice-Jade Teapot',
      'Hellfire Gears',
      'Precious Fossilized Core',
      'The Restrained',
    ],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Swing Jazz 2 件',
      'Astral Voice 4 件 + King of the Summit / Shockstar Disco / Swing Jazz 2 件',
      'Proto Punk 4 件 + King of the Summit / Shockstar Disco / Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：暴击率优先，其次暴击伤害', '5号位：攻击力%/火伤/穿透率', '6号位：冲击力'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透率、攻击力；King of the Summit 方向需暴击率 50%+。'],
    },
    progression: ['击破辅助：保持 Morale 强化连段；核心与关键技能等级需按当前版本另行核验。'],
    team: [
      '火/冰暴击队的击破与增益方向；套装覆盖依赖队内是否已有 Astral Voice 持有者，邦布未作为稳定优先级录入。',
    ],
  },
  'agent-hugo': {
    source: {
      id: 'prydwen-hugo-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/hugo',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/hugo',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Myriad Eclipse',
      'Cordis Germina',
      'Heartstring Nocturne',
      'Steel Cushion',
      'Marcato Desire',
    ],
    sets: [
      'Hormone Punk 4 件 + Polar Metal / Woodpecker Electro / Puffer Electro / Astral Voice / Branch & Blade Song 2 件',
      'Dialyn 前提下可考虑 Puffer Electro 4 件 + Polar Metal 等 2 件',
    ],
    stats: {
      main: [
        '4号位：暴击伤害优先，其次暴击率',
        '5号位：冰伤优先，其次攻击力%/穿透率',
        '6号位：攻击力%',
      ],
      sub: [
        '暴击率、暴击伤害、攻击力%、攻击力、穿透；候选终局方向为暴击率 70–88%、暴击伤害 160–200%+。',
      ],
    },
    progression: [
      '爆发窗口优先特殊技与连携技，其次普攻、支援、闪避；以失衡期 Totalize 爆发为循环前提。',
    ],
    team: [
      '优先与莱特/莱卡恩/扳机等击破协同；可用青衣/普露夏，辅助方向列出苍角/耀嘉音。邦布方向未作稳定候选。',
    ],
  },
}
