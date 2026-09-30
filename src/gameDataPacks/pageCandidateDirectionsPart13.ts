import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart13: Partial<Record<string, PageCandidateDirection>> = {
  'agent-seth': {
    source: {
      id: 'prydwen-seth-1.5',
      url: 'https://www.prydwen.gg/zenless/characters/seth',
      sourceVersion: '1.5',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/seth',
        buildVersion: '1.5',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: [
      'Peacekeeper - Specialized',
      'Spring Embrace',
      'Bunny Band',
      'Original Transmorpher',
    ],
    sets: [
      'Astral Voice 4 件 + Swing Jazz / Freedom Blues 2 件',
      'Swing Jazz 4 件 + Proto Punk / Shockstar Disco 2 件',
      'Proto Punk 4 件 + Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：攻击力/异常精通', '5号位：攻击力/电伤', '6号位：能量回复/异常掌控'],
      sub: ['攻击力%、异常精通、攻击力、穿透'],
    },
    progression: ['候选页面强调强化特殊技与蓄力普攻的循环；技能/核心优先级需同版本独立核验。'],
    team: ['面向异常队的护盾与异常效率支援；不等同唯一队伍或正式最优。'],
  },
}
