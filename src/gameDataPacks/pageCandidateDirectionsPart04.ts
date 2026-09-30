import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart04: Partial<Record<string, PageCandidateDirection>> = {
  'agent-caesar': {
    source: {
      id: 'prydwen-caesar-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/caesar',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/caesar',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Tusks of Fury',
      'Original Transmorpher',
      'Spring Embrace',
      'Peacekeeper - Specialized',
    ],
    sets: [
      'Astral Voice 4 件 + Shockstar Disco / King of the Summit / Proto Punk 2 件',
      'Proto Punk 4 件 + Shockstar Disco / King of the Summit 2 件',
      '物理异常队可考虑 Freedom Blues 4 件',
    ],
    stats: {
      main: ['4号位：暴击率/异常精通', '5号位：物理伤害优先，其次攻击力%/穿透率', '6号位：冲击力'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透率、攻击力；物理异常方向保留异常精通分支。'],
    },
    progression: [
      '护盾/击破辅助：围绕格挡反击、强化特殊技与额外能力；核心与技能等级优先级需按当前版本另行核验。',
    ],
    team: [
      '通用护盾增益或物理异常支援方向；团队套装需避免与队内同一 4 件效果重复，邦布未作为稳定优先级录入。',
    ],
  },
  'agent-astra': {
    source: {
      id: 'prydwen-astra-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/astra-yao',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/astra-yao',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Elegant Vanity', 'Bashful Demon', 'Kaboom the Cannon', 'The Vault'],
    sets: [
      'Astral Voice 4 件 + Swing Jazz / Moonlight Lullaby / Hormone Punk 2 件',
      '队内已有 Astral Voice 时使用 Moonlight Lullaby 4 件 + Swing Jazz / Hormone Punk / Astral Voice 2 件',
    ],
    stats: {
      main: ['4号位：攻击力%', '5号位：攻击力%', '6号位：能量回复或攻击力%'],
      sub: [
        '先保证攻击力至约 3430 以满足核心团队增益上限；之后在暴击或异常方向二选一，能量回复随音擎/副套装调整。',
      ],
    },
    progression: [
      '特殊技进入 Idyllic Cadenza 后维持快速支援、连携和终结技；技能优先特殊技、连携、支援、闪避、普攻。',
    ],
    team: [
      '泛用低站场辅助；与伊芙琳及多数攻击特性角色、或雅/柳/简/柏妮思等异常角色协同。邦布方向未作稳定候选。',
    ],
  },
  'agent-rina': {
    source: {
      id: 'prydwen-rina-2.2',
      url: 'https://www.prydwen.gg/zenless/characters/rina',
      sourceVersion: '2.2',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/rina',
        buildVersion: '2.2',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面的构筑更新标为 2.2。',
      verified: true,
    },
    wengines: [
      'Weeping Cradle',
      'Kaboom the Cannon',
      'Slice of Time',
      '[Reverb] Mark II',
      'Unfettered Game Ball',
    ],
    sets: [
      'Moonlight Lullaby 4 件 + Puffer Electro / Astral Voice / Hormone Punk / Thunder Metal 2 件',
      'Astral Voice 4 件 + Puffer Electro / Hormone Punk / Thunder Metal 2 件',
      'Swing Jazz 4 件 + Puffer Electro / Astral Voice / Hormone Punk / Thunder Metal 2 件',
    ],
    stats: {
      main: ['4号位：攻击力%/异常精通', '5号位：穿透率', '6号位：能量回复优先，其次攻击力%'],
      sub: ['异常精通、攻击力%、穿透/攻击力；候选团队穿透方向为核心 6 时穿透率约 72%。'],
    },
    progression: ['连携技、特殊技优先，其次普攻、支援、闪避；保持人偶在场以维持穿透率增益。'],
    team: [
      '电异常：柳/简；电输出：悠真。通过同属性/阵营满足额外能力，并保持 Shock 与人偶部署。邦布方向未作稳定候选。',
    ],
  },
}
