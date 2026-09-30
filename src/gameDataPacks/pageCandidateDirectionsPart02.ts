import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart02: Partial<Record<string, PageCandidateDirection>> = {
  'agent-burnice': {
    source: {
      id: 'prydwen-burnice-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/burnice',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/burnice',
        checkedAt: '2026-07-27',
        evidence: 'page-level build and teams sections',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Flamemaker Shaker', 'Practiced Perfection', 'Electro-Lip Gloss', 'Weeping Gemini'],
    sets: ['Chaos Jazz 4 件 + 可选 2 件套'],
    stats: {
      main: [
        '4号位：异常精通',
        '5号位：火伤/穿透率',
        '6号位：异常掌控或能量回复（取决于音擎与热量循环）',
      ],
      sub: ['异常精通、攻击力%、穿透值；不把候选面板阈值升格为正式规则。'],
    },
    progression: [
      '维持 Heat、施加 Scorched 后离场触发 Afterburn；补能时短暂回场，避免在 50 Heat 以上浪费终结技补充。',
    ],
    team: [
      '火异常/紊乱副C方向；页面示例为爱丽丝 + 柚叶，或与其他异常主C协同；邦布未作为稳定优先级录入。',
    ],
  },
  'agent-vivian': {
    source: {
      id: 'prydwen-vivian-2.3',
      url: 'https://www.prydwen.gg/zenless/characters/vivian',
      sourceVersion: '2.3',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/vivian',
        buildVersion: '2.3',
        updatedAt: '2026-06-23',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Flight of Fancy', 'Weeping Gemini'],
    sets: [
      "Phaethon's Melody 4 件 + Chaos Jazz / Freedom Blues / Chaotic Metal / Astral Voice / Hormone Punk / Puffer Electro 2 件",
    ],
    stats: {
      main: ['4号位：异常精通', '5号位：以太伤害优先，其次穿透率/攻击力%', '6号位：异常掌控'],
      sub: ['异常精通优先，其次攻击力%、攻击力、穿透'],
    },
    progression: ['核心被动优先；通过飞羽转护羽后切人，以队友异常触发 Abloom。'],
    team: ['需要另一名异常主C；页面列出雅/柳/爱丽丝/简/派派/格莉丝与耀嘉音/柚叶/妮可/露西等协同。'],
  },
  'agent-jane': {
    source: {
      id: 'prydwen-jane-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/jane-doe',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/jane-doe',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Sharpened Stinger',
      'Practiced Perfection',
      'Weeping Gemini',
      'Electro-Lip Gloss',
      'Fusion Compiler',
    ],
    sets: [
      "Fanged Metal 4 件 + Phaethon's Melody / Puffer Electro / Freedom Blues / Chaos Jazz / Astral Voice / Hormone Punk 2 件",
    ],
    stats: {
      main: ['4号位：异常精通', '5号位：穿透率优先，其次物理伤害/攻击力%', '6号位：异常掌控'],
      sub: ['异常精通优先，其次攻击力%、穿透、攻击力'],
    },
    progression: ['页面终局候选以异常精通约 375–420、异常掌控 192+ 为前提；不升格为正式阈值。'],
    team: ['物理异常主C；页面列出薇薇安/柏妮思/赛斯/柚叶/爱丽丝等协同，依赖持续冲击/异常节奏。'],
  },
}
