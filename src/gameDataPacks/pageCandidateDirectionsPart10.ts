import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart10: Partial<Record<string, PageCandidateDirection>> = {
  'agent-aria': {
    source: {
      id: 'prydwen-aria-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/aria',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/aria',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Angel in the Shell', 'Flight of Fancy'],
    sets: ["Phaethon's Melody 4 件 + Freedom Blues / Chaos Jazz 2 件"],
    stats: {
      main: ['4号位：异常精通', '5号位：以太伤害/攻击力%/穿透率', '6号位：异常掌控'],
      sub: ['异常精通、攻击力%、穿透、攻击力；候选异常精通 330–420、异常掌控 184–244。'],
    },
    progression: [
      '普攻4/替代特殊/强化特殊积累 Fandom Power，消费后触发三级 Perfect Pitch 与 Abloom；无异常目标时不应强行触发。',
    ],
    team: [
      '候选计算队为千夏+柚叶；与南宫羽等异常协同需按异常与失衡时机手动对照。邦布方向未作稳定候选。',
    ],
  },
  'agent-nangong': {
    source: {
      id: 'prydwen-nangong-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/nangong-yu',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/nangong-yu',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Neon Fantasies',
      'Hellfire Gears',
      'The Simmering Pot',
      'Precious Fossilized Core',
      'Roaring Fur-nace',
    ],
    sets: ["Phaethon's Melody 4 件 + Phaethon's Melody 2 件"],
    stats: {
      main: ['4号位：异常精通', '5号位：以太伤害/攻击力%/穿透率', '6号位：异常掌控'],
      sub: ['异常精通、攻击力%、穿透、攻击力；候选异常精通 280–350、异常掌控 173–211。'],
    },
    progression: ['依异常与失衡时机管理资源和强化特殊；技能优先特殊、连携、普攻、支援、闪避。'],
    team: [
      '异常协同：爱芮/爱丽丝/简/派派/格莉丝/柏妮思/雅/柳等；不同队伍的能量与异常顺序不可混用。邦布方向未作稳定候选。',
    ],
  },
  'agent-cissia': {
    source: {
      id: 'prydwen-cissia-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/cissia',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/cissia',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Serpentine Seeker', 'Bellicose Blaze'],
    sets: [
      '电队可用 Thunder Metal 4 件 + Swing Jazz / Moonlight Lullaby / Branch & Blade Song 2 件；其余主套方向需同版本字段核验。',
    ],
    stats: {
      main: ['4号位：暴击率优先，其次暴击伤害', '5号位：电伤优先，其次攻击力%', '6号位：能量回复'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透、攻击力；候选暴击率 50–57%、暴击伤害 110%+。'],
    },
    progression: [
      '频繁强化特殊积累 Venom，Serpentine Shadow 后以强化普攻消耗并触发 Corrode Bone；失衡内保留能量进行爆发。',
    ],
    team: ['席德优先，千夏/耀嘉音等攻击辅助可用；电队可配扳机。邦布方向未作稳定候选。'],
  },
}
