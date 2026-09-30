import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart12: Partial<Record<string, PageCandidateDirection>> = {
  'agent-seed': {
    source: {
      id: 'prydwen-seed-2.2',
      url: 'https://www.prydwen.gg/zenless/characters/seed',
      sourceVersion: '2.2',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/seed',
        updatedAt: '2026-06-14',
        buildVersion: '2.2',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Cordis Germina', 'Heartstring Nocturne', 'Myriad Eclipse', 'Zanshin Herb Case'],
    sets: ["Dawn's Bloom 4 件 + Woodpecker Electro 2 件"],
    stats: {
      main: ['页面构筑区已定位；需同版本抽取4/5/6号位精确优先级。'],
      sub: ['暴击率/暴击伤害与攻击力方向；需同版本字段核验。'],
    },
    progression: ['候选页面包含音擎与套装方向；技能优先级需同版本独立核验。'],
    team: ['页面计算假设：零号·安比与耀嘉音；不等同唯一队伍或正式最优。'],
  },
  'agent-zhu-yuan': {
    source: {
      id: 'prydwen-zhuyuan-2.4',
      url: 'https://www.prydwen.gg/zenless/characters/zhu-yuan',
      sourceVersion: '2.4',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/zhu-yuan',
        buildVersion: '2.4',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Cordis Germina', 'The Brimstone', 'Riot Suppressor Mark VI', 'Marcato Desire'],
    sets: [
      'Chaotic Metal 4 件 + Woodpecker Electro / Astral Voice 2 件',
      'Puffer Electro 4 件（需琉音前提）',
    ],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：攻击力/以太伤害/穿透率', '6号位：攻击力'],
      sub: ['暴击率/暴击伤害/攻击力/穿透'],
    },
    progression: ['候选页面包含终局面板；技能/核心优先级需同版本独立核验。'],
    team: ['页面计算假设：琉音与妮可；不等同唯一队伍或正式最优。'],
  },
  'agent-miyabi': {
    source: {
      id: 'prydwen-miyabi-2.1',
      url: 'https://www.prydwen.gg/zenless/characters/miyabi',
      sourceVersion: '2.1',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/miyabi',
        buildVersion: '2.1',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Hailstorm Shrine', 'Fusion Compiler', 'Electro-Lip Gloss', 'Rainforest Gourmet'],
    sets: [
      'Branch & Blade Song 4 件 + Polar Metal / Astral Voice / Hormone Punk 2 件',
      'Woodpecker Electro 4 件 + Polar Metal 2 件',
    ],
    stats: {
      main: ['4号位：暴击率/攻击力', '5号位：冰伤/攻击力', '6号位：攻击力'],
      sub: ['暴击率（至80%）、暴击伤害、攻击力、异常精通/穿透'],
    },
    progression: ['候选页面包含终局面板；技能/核心优先级需同版本独立核验。'],
    team: ['需持续属性异常覆盖；不等同唯一队伍或正式最优。'],
  },
}
