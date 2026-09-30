import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart05: Partial<Record<string, PageCandidateDirection>> = {
  'agent-lycaon': {
    source: {
      id: 'prydwen-lycaon-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/lycaon',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/lycaon',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Blazing Laurel',
      'Precious Fossilized Core',
      'Steam Oven',
      'Hellfire Gears',
      'The Restrained',
    ],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Swing Jazz 2 件；需 50% 暴击率以触发该套装方向',
      'Shockstar Disco 4 件 + King of the Summit / Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：暴击率/暴击伤害', '5号位：冰伤优先，其次攻击力%', '6号位：冲击力'],
      sub: ['暴击率/暴击伤害、攻击力%、穿透、攻击力；候选冲击力目标 169–190+。'],
    },
    progression: [
      '特殊技、支援优先，随后连携、普攻、闪避；由支援追击进入 Encircle Prey，并以 EX 特殊技开启失衡。',
    ],
    team: [
      '冰队：雅/艾莲；也可与雨果双击破，通用辅助方向为耀嘉音/柚叶/妮可，冰队可配苍角。邦布方向未作稳定候选。',
    ],
  },
  'agent-grace': {
    source: {
      id: 'prydwen-grace-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/grace-howard',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/grace-howard',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Timeweaver',
      'Practiced Perfection',
      'Fusion Compiler',
      'Electro-Lip Gloss',
      'Weeping Gemini',
    ],
    sets: ['Thunder Metal 4 件 + 候选 2 件套；以 Shock 覆盖为前提，异常/紊乱方向需按队伍复核。'],
    stats: {
      main: ['4号位：异常精通', '5号位：电伤/穿透率', '6号位：异常掌控'],
      sub: ['异常精通、攻击力%、穿透、攻击力；不把候选面板阈值升格为正式规则。'],
    },
    progression: [
      'B1-B2-B3→特殊/强化特殊→B4→特殊/强化特殊以生成并消耗 Zap；终结技后以 Pulse/Abloom 循环为适用前提。',
    ],
    team: ['电异常或紊乱副C方向；来源计算队示例为柏妮思+柚叶，具体邦布和版本化异常顺序仍待核验。'],
  },
  'agent-trigger': {
    source: {
      id: 'prydwen-trigger-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/trigger',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/trigger',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Spectral Gaze',
      'Blazing Laurel',
      'Ice-Jade Teapot',
      'The Restrained',
      'Precious Fossilized Core',
      'Steam Oven',
    ],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Swing Jazz 2 件',
      'Astral Voice 4 件 + King of the Summit / Shockstar Disco / Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：暴击率', '5号位：电伤优先，其次攻击力%', '6号位：冲击力'],
      sub: [
        '暴击率、暴击伤害、攻击力%、穿透、攻击力；候选冲击力 162–186+，额外能力上限前暴击率可至 90%。',
      ],
    },
    progression: [
      '先完成 4 发 Silenced Shot 与收招，再切出触发后台 Aftershock；普攻、特殊、连携、支援、闪避按页面顺序投入。',
    ],
    team: [
      '后台击破/Aftershock：优先零号·安比，亦可为火/冰队提供击破与团队增益；邦布方向未作稳定候选。',
    ],
  },
}
