import { stableContentHash } from './types'
import type { PageCandidateDirection } from './pageCandidateDirections'
export const pageCandidateDirectionsPart01: Partial<Record<string, PageCandidateDirection>> = {
  'agent-ben': {
    source: {
      id: 'bwiki-ben-unversioned',
      url: 'https://wiki.biligame.com/zzz/%E6%9C%AC',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: 'sha256:b4b04a3ff8d2a3983717300675098914b6070c7646670227dee18355d9cd1b19',
      licenseBoundary:
        'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；页面未给出可核验的构筑版本，不能作为当前 3.0 正式求解输入。',
      verified: true,
    },
    wengines: ['本的专属音擎', '兔能环', '「恒等式」- 本格', '「恒等式」- 变格'],
    sets: ['摇摆爵士 4 件', '自由蓝调 4 件', '炎狱重金属 4 件 + 啄木鸟电音 / 灵魂摇滚 2 件'],
    stats: {
      main: ['4号位：防御力/暴击伤害', '5号位：火属性伤害/防御力', '6号位：能量回复效率/防御力'],
      sub: ['暴击率/暴击伤害、防御力、穿透值'],
    },
    progression: ['核心技 > 特殊技 > 连携技；以团队护盾与短轴火伤为适用前提。'],
    team: ['火队或团队防御辅助方向；来源仅列出「11号」协同，未给出可核验邦布优先级。'],
  },
  'agent-evelyn': {
    source: {
      id: 'bwiki-evelyn-unversioned',
      url: 'https://wiki.biligame.com/zzz/%E4%BC%8A%E8%8A%99%E7%90%B3',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://wiki.biligame.com/zzz/%E4%BC%8A%E8%8A%99%E7%90%B3',
        checkedAt: '2026-07-27',
        evidence: 'BWIKI candidate build sections, queried page identity',
      }),
      licenseBoundary:
        'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；页面构筑未给出可核验的适用版本，不能作为当前 3.0 正式求解输入。',
      verified: true,
    },
    wengines: ['伊芙琳的专属音擎', '硫磺石', '牺牲洁纯', '强音热望', '加农转子', '钢铁肉垫'],
    sets: ['炎狱重金属 4 件（需稳定灼烧）', '高暴击率时改用页面列出的其他 4 件或 2+2+2 方向'],
    stats: {
      main: ['4号位：暴击伤害优先/暴击率', '5号位：火伤或穿透率/攻击力%', '6号位：攻击力%'],
      sub: ['暴击率/暴击伤害优先，攻击力%/穿透值'],
    },
    progression: ['核心技=连携技优先，其次普攻、强化特殊技；支援技取决于快速支援循环。'],
    team: ['输出+击破+增伤辅助；页面示例为耀嘉音+莱特/珂蕾妲，邦布可用咔嚓仔或飚速布。'],
  },
  'agent-yanagi': {
    source: {
      id: 'bwiki-yanagi-2.1',
      url: 'https://wiki.biligame.com/zzz/%E6%9F%B3',
      sourceVersion: '2.1',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://wiki.biligame.com/zzz/%E6%9F%B3',
        pageBuildVersion: '2.1',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；旧版本候选不能作为当前 3.0 正式求解输入。',
      verified: true,
    },
    wengines: ['柳的专属音擎', '嵌合编译器'],
    sets: [
      '混沌爵士 4 件 + 自由蓝调 / 法厄同之歌 / 雷暴重金属 2 件',
      '丽娜穿透前提下可考虑河豚电音 2 件',
    ],
    stats: {
      main: ['4号位：异常精通', '5号位：电伤/穿透率', '6号位：攻击力%/异常掌控'],
      sub: ['异常精通优先，其次攻击力%、穿透值、攻击力'],
    },
    progression: ['页面定位为驻场异常输出；技能/核心的当前版本优先级仍需逐字段核验。'],
    team: ['站场紊乱：耀嘉音 + 扳机/妮可/丽娜/凯撒；页面示例邦布为插头布或恶魔布。'],
  },
}
