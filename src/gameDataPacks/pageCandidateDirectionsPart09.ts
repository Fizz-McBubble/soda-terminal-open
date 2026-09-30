import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart09: Partial<Record<string, PageCandidateDirection>> = {
  'agent-banyue': {
    source: {
      id: 'prydwen-banyue-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/banyue',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/banyue',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Wrathful Vajra', 'Qingming Birdcage'],
    sets: [
      '裂隙暴击输出套装 + Woodpecker Electro / Branch & Blade Song 2 件；主套精确名称待同版本构筑区核验。',
    ],
    stats: {
      main: ['4号位：暴击伤害优先，其次暴击率', '5号位：火伤优先，其次生命值%', '6号位：生命值%'],
      sub: ['暴击率/暴击伤害、生命值%、攻击力%、生命值；候选目标 Sheer Force 2200+、生命 18000+。'],
    },
    progression: [
      '保持场上完美招架以积累 Wrathful Fires；120 层后配合失衡爆发并利用 Adrenaline 返还循环。',
    ],
    team: [
      '裂隙主C：琉音优先击破、卢西娅辅助；来源页面强调二者的终结技转换和失衡延长协同。邦布方向未作稳定候选。',
    ],
  },
  'agent-zhao': {
    source: {
      id: 'prydwen-zhao-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/zhao',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/zhao',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Half-Sugar Bunny', 'Tusks of Fury'],
    sets: ['防御辅助候选方向；完整套装与号位需同版本构筑区字段核验。'],
    stats: {
      main: ['生命值/能量回复方向；精确号位待同版本字段核验。'],
      sub: ['生命值、能量回复与暴击方向；候选满层团队增益以初始生命约 27000 为前提。'],
    },
    progression: [
      '低站场循环：积累 Frostbite Points 后开启 Ether Veil: Wellspring，利用追击/强化特殊/终结技后自动蓄力的 Final Verdict。',
    ],
    team: [
      '叶瞬光优先；也可为猫又、艾莲、席德、柳、爱丽丝等攻击/异常角色提供增益。邦布方向未作稳定候选。',
    ],
  },
  'agent-sunna': {
    source: {
      id: 'prydwen-sunna-2.6',
      url: 'https://www.prydwen.gg/zenless/characters/sunna',
      sourceVersion: '2.6',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/sunna',
        buildVersion: '2.6',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.6。',
      verified: true,
    },
    wengines: ['Thoughtbop', 'Weeping Cradle', 'Kaboom the Cannon', 'Unfettered Game Ball'],
    sets: ['Moonlight Lullaby 4 件 + Swing Jazz / Astral Voice / Hormone Punk 2 件'],
    stats: {
      main: ['4号位：攻击力%', '5号位：攻击力%', '6号位：能量回复'],
      sub: ['攻击力至约 3500，再按异常或暴击分支选择异常精通或双暴/穿透。'],
    },
    progression: [
      'Bubblegum Barrage→Special Photography Technique 激活 Ether Veil，切出攻击角色触发 Cat’s Gaze，约 25 秒刷新 Moonlight Lullaby。',
    ],
    team: [
      '叶瞬光+赵/琉音，或比利/艾莲/悠真等攻击输出；Aria 队可走异常分支。邦布方向未作稳定候选。',
    ],
  },
}
