import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart08: Partial<Record<string, PageCandidateDirection>> = {
  'agent-dialyn': {
    source: {
      id: 'prydwen-dialyn-2.4',
      url: 'https://www.prydwen.gg/zenless/characters/dialyn',
      sourceVersion: '2.4',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/dialyn',
        buildVersion: '2.4',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.4。',
      verified: true,
    },
    wengines: ['Yesterday Calls', 'Hellfire Gears', 'Steam Oven'],
    sets: ['击破候选方向；精确 4 件/2 件套与 4/5/6 号位仍需从同版本构筑区抽取。'],
    stats: {
      main: ['以暴击率、能量回复与击破循环为方向；精确号位优先级待同版本字段核验。'],
      sub: ['暴击率（超过 50% 提高冲击）、能量回复与候选击破属性；不把机制文本转换为正式阈值。'],
    },
    progression: [
      '围绕 Positive Reviews、Rock→Scissors→Paper 强化特殊技，以及失衡期终结技转换；注意队伍站位影响额外能力。',
    ],
    team: [
      '攻击/裂隙队的击破：叶瞬光、狛野真斗、般岳、雨果、伊芙琳等；以延长失衡和终结技转换为适用前提。邦布方向未作稳定候选。',
    ],
  },
  'agent-yuzuha': {
    source: {
      id: 'prydwen-yuzuha-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/ukinami-yuzuha',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/ukinami-yuzuha',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Weeping Cradle',
      'Thoughtbop',
      'Metanukimorphosis',
      'Kaboom the Cannon',
      'Unfettered Game Ball',
    ],
    sets: ['Moonlight Lullaby 4 件；完整候选套装分支与 4/5/6 号位需按同版本构筑区继续核验。'],
    stats: {
      main: ['异常或暴击辅助的分支取决于队伍；精确号位优先级待同版本字段核验。'],
      sub: ['异常队考虑异常相关属性；其他队伍以能量/团队增益方向为准，不能转为正式约束。'],
    },
    progression: [
      '防御支援/招架后接支援追击，再以强化特殊或终结技触发快速支援；保持 Sweet Scare、Tanuki Wish 与 Sugar Point。',
    ],
    team: ['异常队优先柳/简/派派等，并可配薇薇安/柏妮思；雅队为例外候选。邦布方向未作稳定候选。'],
  },
  'agent-manato': {
    source: {
      id: 'prydwen-manato-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/manato',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/manato',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Qingming Birdcage 等裂隙候选音擎；完整排序需同版本构筑区字段核验。'],
    sets: ['裂隙输出候选方向；完整 4+2 / 2+2+2 组合与号位待同版本字段核验。'],
    stats: {
      main: ['裂隙/生命值与暴击方向；精确号位优先级待同版本字段核验。'],
      sub: ['暴击率、暴击伤害、生命值%、攻击力%；不将候选玩法描述升格为正式面板。'],
    },
    progression: [
      '通过防御支援和特殊技恢复 Blazing Heart，以支援追击、强化普攻消耗生命；失衡内保留强化特殊和终结技。',
    ],
    team: ['裂隙主C：卢西娅、潘引壶辅助，琉音优先击破、橘福福次选。邦布方向未作稳定候选。'],
  },
}
