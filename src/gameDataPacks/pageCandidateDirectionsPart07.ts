import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart07: Partial<Record<string, PageCandidateDirection>> = {
  'agent-lucia': {
    source: {
      id: 'prydwen-lucia-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/lucia',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/lucia',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Dreamlit Hearth'],
    sets: [
      '裂隙辅助候选方向；精确 4 件/2 件套与 4/5/6 号位需按页面当前构筑字段补齐，不能由角色机制推断。',
    ],
    stats: {
      main: ['生命值/能量回复方向；精确号位优先级待同版本字段核验。'],
      sub: ['生命值%、能量回复与核心增益相关属性；候选来源明确以生命值扩展裂隙队增益。'],
    },
    progression: [
      '通过 Whim、连携、强化特殊和支援追击积累 Dream Points，维持 Dream State / Ether Veil: Wellspring；技能优先特殊、连携、普攻、支援、闪避。',
    ],
    team: [
      '裂隙辅助：仪玄、狛野真斗、般岳与伊德海莉方向；以维持 Ether Veil 为适用前提。邦布方向未作稳定候选。',
    ],
  },
  'agent-alice': {
    source: {
      id: 'prydwen-alice-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/alice',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/alice',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Alice 的专属音擎', 'Fusion Compiler'],
    sets: ['物理异常输出方向；4 件套及精确 4/5/6 号位待同版本构筑区字段核验。'],
    stats: {
      main: ['异常精通/物理伤害/异常掌控方向；精确号位优先级待同版本字段核验。'],
      sub: ['异常精通、攻击力%、穿透；候选路线以物理异常和 Blade Etiquette 充能为前提。'],
    },
    progression: [
      '积累 Blade Etiquette 后施放蓄力普攻与 Polarized Assault；快速支援接普攻5、强化特殊和完美闪避用于资源循环。',
    ],
    team: [
      '物理异常主C；候选协同为柚叶或耀嘉音等快速支援辅助，异常队需按敌人与循环手动对照。邦布方向未作稳定候选。',
    ],
  },
  'agent-ju-fufu': {
    source: {
      id: 'prydwen-jufufu-2.0',
      url: 'https://www.prydwen.gg/zenless/characters/ju-fufu',
      sourceVersion: '2.0',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/ju-fufu',
        buildVersion: '2.0',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.0。',
      verified: true,
    },
    wengines: ['Ju Fufu 的专属音擎', 'Blazing Laurel 等击破音擎；精确排序需同版本构筑区字段核验。'],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Woodpecker Electro / Astral Voice / Hormone Punk / Swing Jazz 2 件',
      '队内已有 King of the Summit 时使用 Swing Jazz 4 件',
    ],
    stats: {
      main: ['4号位：暴击率/攻击力%', '5号位：攻击力%', '6号位：冲击力/攻击力%'],
      sub: [
        'King 4 件时暴击率至 50%，再堆攻击力至约 3400，随后暴击伤害/穿透；候选冲击力 139–160+。',
      ],
    },
    progression: [
      '围绕 Hu Wei、Might 与 Momentum 后台循环；技能优先连携、特殊、普攻、支援、闪避。',
    ],
    team: [
      '仪玄优先协同；亦可为零号·安比、艾莲、11号、伊芙琳、雨果等提供后台击破与连携/终结技增益。邦布方向未作稳定候选。',
    ],
  },
}
