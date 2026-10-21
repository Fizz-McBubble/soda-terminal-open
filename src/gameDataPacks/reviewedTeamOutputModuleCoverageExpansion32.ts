import nestedDirections from './data/reviewed-team-nested-directions.3.1.json'
import type { ReviewedTeamOutputModuleEvidence } from './reviewedTeamOutputModuleEvidence'
import type { TeamOutputModule } from './teamOutputModuleContract'

type ModuleSpec = readonly [
  TeamOutputModule['primaryOutputKind'],
  TeamOutputModule['reactionMechanisms'],
  TeamOutputModule['executionChannels'],
  TeamOutputModule['teamFunctions'],
]
type Quote = readonly [op: number, start: number, end: number, text: string]
const byClaim = new Map(nestedDirections.records.map((row) => [row.claimId, row]))

function reviewed(
  claimId: string,
  memberIds: readonly [string, string, string],
  spec: ModuleSpec,
  quotes: readonly Quote[],
): ReviewedTeamOutputModuleEvidence {
  const source = byClaim.get(claimId)
  if (!source || [...source.memberIds].sort().join('|') !== [...memberIds].sort().join('|'))
    throw new Error(`Reviewed team source membership changed: ${claimId}`)
  return {
    memberIds,
    classification: 'historical_exact_team_review',
    module: {
      contract: 'soda-team-output-module/v1',
      id: `module-coverage-${claimId.slice('reviewed-nested-'.length)}`,
      primaryOutputKind: spec[0],
      reactionMechanisms: spec[1],
      executionChannels: spec[2],
      teamFunctions: spec[3],
    },
    sourceEvidence: quotes.map(([op, start, end, text]) => ({
      sourceId: claimId,
      sourceVersion: source.source.sourceVersion,
      contentHash: source.nested.unitRawSha256,
      locator: `${source.source.url}#structured_content/op/${op}/text/${start}:${end};offset=UTF-16;archiveSha256=${source.source.archiveSha256}`,
      text,
    })),
  }
}

/**
 * Individually reviewed exact teams that improve released-member and role coverage.
 * Source versions remain historical. Main-driver prose is cross-checked against
 * locked action formula families; specialty alone never selects a primary kind.
 * Arrays contain proven positive tags, not claims that other properties are absent.
 */
export const reviewedTeamOutputModuleCoverageExpansion32 = [
  reviewed(
    'reviewed-nested-1bf6f997f109e603a66a7f61',
    ['agent-zhu-yuan', 'agent-anby', 'agent-nicole'],
    ['direct_damage', [], ['stun_window', 'chain', 'quick_swap'], ['stun', 'defense_reduction']],
    [
      [101, 96, 119, '安比（进失衡）、妮可（连携1）、朱鸢（连携2）'],
      [101, 279, 315, '让朱鸢的连携伤害获得能量场的减防，后续朱鸢快速入战可再攒一枚【强化霰弹】'],
      [44, 13, 26, '朱鸢主要以普攻作为输出方式'],
    ],
  ),
  reviewed(
    'reviewed-nested-0b308f203bffc65c5b04808d',
    ['agent-qingyi', 'agent-zhu-yuan', 'agent-nicole'],
    ['direct_damage', [], ['stun_window', 'chain'], ['stun', 'defense_reduction']],
    [
      [82, 90, 113, '青衣（进失衡）、妮可（连携1）、朱鸢（连携2）'],
      [82, 277, 293, '让朱鸢的连携伤害获得能量场的减防'],
    ],
  ),
  reviewed(
    'reviewed-nested-077c01cfd920610186787fd2',
    ['agent-zhu-yuan', 'agent-trigger', 'agent-qingyi'],
    ['direct_damage', [], ['stun_window', 'chain'], ['stun']],
    [
      [66, 14, 47, '双击破阵容能更快地累积失衡值，失衡期前主要由青衣站场触发扳机的追击'],
      [66, 255, 272, '朱鸢每次连携可获得3枚【强化霰弹】'],
    ],
  ),
  reviewed(
    'reviewed-nested-4018abd24af2fa2b674eca5c',
    ['agent-harumasa', 'agent-trigger', 'agent-qingyi'],
    ['direct_damage', [], ['stun_window', 'chain'], ['stun']],
    [
      [66, 14, 47, '双击破阵容能更快地累积失衡值，失衡期前主要由青衣站场触发扳机的追击'],
      [66, 340, 360, '作为主C的悠真仍可以双连携打出不错的伤害'],
    ],
  ),
  reviewed(
    'reviewed-nested-3f0fc7b2aa7f8d9188075a4d',
    ['agent-ellen', 'agent-anby', 'agent-soukaku'],
    ['direct_damage', [], ['chain', 'quick_swap'], ['stun', 'support']],
    [
      [101, 133, 153, '艾莲的输出，是当前苍角最为契合的输出角色'],
      [101, 196, 232, '苍角连携入场施放展旗消耗涡流，再提高由支援或连携入场的艾莲的攻击力、冰伤'],
      [101, 235, 261, '如果没有莱卡恩，也可以暂时使用安比暂时作为击破手过渡'],
    ],
  ),
  reviewed(
    'reviewed-nested-37151237d296de325e10ccb4',
    ['agent-ellen', 'agent-soukaku', 'agent-lycaon'],
    ['direct_damage', [], ['quick_swap'], ['support']],
    [
      [16, 136, 160, '这样可让苍角每次触发支援时可直接切出艾莲登场输出'],
      [16, 219, 231, '即“艾莲+莱卡恩+苍角”'],
    ],
  ),
  reviewed(
    'reviewed-nested-4a0cc42093d190b74e00b873',
    ['agent-caesar', 'agent-qingyi', 'agent-corin'],
    ['direct_damage', [], ['stun_window'], ['defense', 'stun']],
    [
      [76, 68, 106, '将敌人（主要是精英/boss类敌人）打入失衡前，确保青衣已经打出一次蓄力普攻'],
      [76, 130, 158, '可琳仍可依靠【荣光之盾】继续切割输出，无需担心被敌人打断'],
    ],
  ),
  reviewed(
    'reviewed-nested-54ff4c782923b0f537485a2a',
    ['agent-billy', 'agent-anby', 'agent-nicole'],
    ['direct_damage', [], [], ['defense_reduction']],
    [
      [
        32,
        29,
        68,
        '【狡兔屋】阵营的强攻角色（如比利、猫又），通过触发核心技的效果来降低敌人防御力',
      ],
      [32, 85, 93, '比利/安比/妮可'],
    ],
  ),
  reviewed(
    'reviewed-nested-c60f1ca83dd89577688d74dd',
    ['agent-anton', 'agent-qingyi', 'agent-rina'],
    ['direct_damage', [], ['stun_window'], ['stun']],
    [
      [126, 32, 64, '安东在入战后点按施放【强化特殊技】，之后再由青衣持续攻击打入失衡'],
      [126, 66, 82, '安东的输出也主要集中在敌人失衡后'],
    ],
  ),
  reviewed(
    'reviewed-nested-261352404eade335a25a5cf2',
    ['agent-caesar', 'agent-piper', 'agent-seth'],
    ['attribute_anomaly', [], [], ['defense', 'support']],
    [
      [84, 40, 48, '凯撒+派派+赛斯'],
      [84, 68, 93, '派派主站场，在获得凯撒、赛斯的buff后再进行输出'],
      [84, 94, 122, '多次利用凯撒的招架支援获得穿插强化特殊技获得【荣光之盾】'],
      [84, 5, 10, '凯派强击队'],
    ],
  ),
  reviewed(
    'reviewed-nested-41165fa5c689c88f301cc518',
    ['agent-grace', 'agent-vivian', 'agent-seth'],
    ['attribute_anomaly', ['abloom'], [], ['defense', 'support']],
    [
      [56, 12, 40, '通过利用薇薇安的异放机制来打出感电异放、增加感电伤害占比'],
      [56, 222, 241, '格莉丝也可考虑体验，持续站场积蓄电异常'],
      [56, 158, 169, '赛斯（护盾/精通提升）'],
    ],
  ),
  reviewed(
    'reviewed-nested-0776f00daea103c7d41a608f',
    ['agent-evelyn', 'agent-lighter', 'agent-nicole'],
    ['direct_damage', [], ['stun_window', 'chain', 'ultimate'], ['stun', 'defense_reduction']],
    [
      [59, 116, 139, '主要思路是“攒机制、打失衡、失衡期多打连携技”'],
      [59, 15, 38, '推荐将主动连携技、终结技等技能在敌人失衡时施放'],
      [61, 220, 234, '莱特、珂蕾妲、青衣等击破角色'],
      [61, 388, 394, '妮可（减防）'],
    ],
  ),
  reviewed(
    'reviewed-nested-078731beafcab21f125b449b',
    ['agent-evelyn', 'agent-nicole', 'agent-lucy'],
    ['direct_damage', [], ['stun_window', 'chain'], ['support']],
    [
      [64, 1, 12, '妮可-露西双支援的失衡'],
      [64, 50, 75, '有露西加攻时：妮可进失衡→伊芙琳失衡连携→取消连携'],
    ],
  ),
  reviewed(
    'reviewed-nested-6658481dc403c87d0434752b',
    ['agent-manato', 'agent-lucia', 'agent-trigger'],
    ['rupture', [], ['quick_swap', 'stun_window'], ['stun']],
    [
      [
        55,
        157,
        214,
        '真斗的核心资源是【炽心】，主要通过长按特殊技蓄力消耗生命、招架支援登场获得，进而进入【熔峰】状态，持续打出火伤普攻',
      ],
      [55, 314, 343, '失衡期长按特殊技获得炽心进入【熔峰】状态，持续进行普攻输出'],
      [55, 22, 40, '可让卢西娅弹出【快速支援】时切至真斗'],
      [55, 80, 89, '选择扳机作为击破手'],
    ],
  ),
  reviewed(
    'reviewed-nested-9a50d94408f12ab0fbd966db',
    ['agent-manato', 'agent-lucia', 'agent-koleda'],
    ['rupture', [], ['quick_swap', 'stun_window'], ['stun']],
    [
      [
        55,
        157,
        214,
        '真斗的核心资源是【炽心】，主要通过长按特殊技蓄力消耗生命、招架支援登场获得，进而进入【熔峰】状态，持续打出火伤普攻',
      ],
      [55, 314, 343, '失衡期长按特殊技获得炽心进入【熔峰】状态，持续进行普攻输出'],
      [55, 22, 40, '可让卢西娅弹出【快速支援】时切至真斗'],
      [55, 132, 142, '也可选择珂蕾妲击破手'],
    ],
  ),
  reviewed(
    'reviewed-nested-be2aa36f1f7eab8787940545',
    ['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao'],
    ['direct_damage', [], ['chain', 'ultimate'], ['ether_veil', 'support']],
    [
      [58, 314, 338, '弹出连携窗口切叶瞬光登场进入白发形态开始一轮输出'],
      [58, 15, 34, '该队的一大优势就是琉音的“连携升大招”'],
      [58, 247, 269, '消耗100点【霜寒值】开启【以太帷幕·涌泉】'],
      [58, 440, 456, '照的加攻持续50秒，增益时间较长'],
    ],
  ),
  reviewed(
    'reviewed-nested-d08402a35005e41ad9bcdee7',
    ['agent-ye-shunguang', 'agent-zhao', 'agent-astra'],
    ['direct_damage', [], ['quick_swap'], ['ether_veil', 'support']],
    [
      [61, 85, 93, '小光白发一直输出'],
      [61, 16, 28, '照、嘉音能提供高额攻击力'],
      [61, 224, 257, '小光攒满剑势后切照登场消耗100点【霜寒值】开启【以太帷幕·涌泉】'],
      [61, 261, 284, '弹出支援窗口后切回小光直接进入白发形态开始输出'],
    ],
  ),
  reviewed(
    'reviewed-nested-b3b7ae9d26951a4dcde1461d',
    ['agent-seed', 'agent-cissia', 'agent-astra'],
    [
      'direct_damage',
      [],
      ['quick_swap', 'stun_window', 'ultimate'],
      ['support', 'resource_supply'],
    ],
    [
      [50, 60, 82, '席德进行下砸等招式时都能切希希芙进行合轴攻击'],
      [
        50,
        84,
        132,
        '希希芙发动强化特殊技、长按普攻等招式既能打出不错输出，又能为全队提供电伤无视防御、暴伤加成等增益',
      ],
      [50, 30, 42, '能为席德持续回复【钢能】'],
      [50, 455, 463, '希希芙发动终结技'],
      [50, 418, 423, '【失衡期】'],
    ],
  ),
  reviewed(
    'reviewed-nested-3148816d6aea5d226a4163cd',
    ['agent-seed', 'agent-cissia', 'agent-trigger'],
    [
      'direct_damage',
      [],
      ['quick_swap', 'stun_window', 'ultimate'],
      ['support', 'resource_supply', 'stun'],
    ],
    [
      [50, 60, 82, '席德进行下砸等招式时都能切希希芙进行合轴攻击'],
      [
        50,
        84,
        132,
        '希希芙发动强化特殊技、长按普攻等招式既能打出不错输出，又能为全队提供电伤无视防御、暴伤加成等增益',
      ],
      [50, 30, 42, '能为席德持续回复【钢能】'],
      [50, 455, 463, '希希芙发动终结技'],
      [50, 418, 423, '【失衡期】'],
      [50, 202, 221, '也可选琉音、扳机等击破手，加速失衡速度'],
    ],
  ),
  reviewed(
    'reviewed-nested-3f1f989b3e0ab09cfde5f2df',
    ['agent-seed', 'agent-cissia', 'agent-dialyn'],
    [
      'direct_damage',
      [],
      ['quick_swap', 'stun_window', 'ultimate'],
      ['support', 'resource_supply', 'stun'],
    ],
    [
      [50, 60, 82, '席德进行下砸等招式时都能切希希芙进行合轴攻击'],
      [
        50,
        84,
        132,
        '希希芙发动强化特殊技、长按普攻等招式既能打出不错输出，又能为全队提供电伤无视防御、暴伤加成等增益',
      ],
      [50, 30, 42, '能为席德持续回复【钢能】'],
      [50, 455, 463, '希希芙发动终结技'],
      [50, 418, 423, '【失衡期】'],
      [50, 202, 221, '也可选琉音、扳机等击破手，加速失衡速度'],
    ],
  ),
  reviewed(
    'reviewed-nested-2963277129d22ab5944d9400',
    ['agent-soldier-0-anby', 'agent-anby', 'agent-rina'],
    ['aftershock', [], ['chain', 'stun_window', 'ultimate'], ['stun']],
    [
      [62, 198, 209, '安比的追加攻击占比最高'],
      [67, 88, 101, '其次用珂蕾妲、A级安比代替'],
      [67, 114, 127, '队友进失衡再由安比失衡连携'],
      [67, 167, 189, '保留终结技，这样在失衡期可打出12次白雷追击'],
    ],
  ),
  reviewed(
    'reviewed-nested-103bad0e63e1ea22919ec4a9',
    ['agent-ben', 'agent-koleda', 'agent-soldier-11'],
    ['direct_damage', [], ['quick_swap', 'stun_window'], ['stun', 'defense']],
    [
      [42, 38, 70, '依靠本和珂蕾妲的多次切换使敌人累积失衡值，进而切出11号爆发输出'],
      [38, 63, 72, '还可为全队施加护盾'],
    ],
  ),
  reviewed(
    'reviewed-nested-7e0c7e85bdd74d8f0b915303',
    ['agent-jane', 'agent-piper', 'agent-seth'],
    ['attribute_anomaly', [], ['quick_swap'], []],
    [
      [69, 48, 85, '利用简派两人互相地触发招架支援来快速累积物理异常积蓄，提高【强击】触发频率'],
      [69, 13, 38, '派派站场积蓄会挤占简打积蓄的占比，可能影响强击伤害'],
    ],
  ),
  reviewed(
    'reviewed-nested-2f752bb76d133882eed52aec',
    ['agent-grace', 'agent-velina', 'agent-yuzuha'],
    ['attribute_anomaly', ['abloom'], ['quick_swap'], ['support']],
    [
      [65, 9, 27, '加强后的格莉丝能消耗脉冲触发异放伤害'],
      [65, 148, 158, '格莉丝一定要解锁潜能'],
      [65, 191, 213, '维琳娜快支上切格莉丝、柚叶强E快支下切格莉丝'],
      [65, 285, 317, '柚叶的增益时间即将结束时切出柚叶发动强化特殊技/终结技续Buff'],
    ],
  ),
  reviewed(
    'reviewed-nested-33d46b7438763f43f8af2ee8',
    ['agent-piper', 'agent-velina', 'agent-yuzuha'],
    ['attribute_anomaly', [], [], []],
    [
      [70, 11, 27, '参考配队：派派+维琳娜+浮波柚叶'],
      [70, 37, 62, '虽然派派没有特别的强击机制，但也完全能与维琳娜组队'],
    ],
  ),
] as const satisfies readonly ReviewedTeamOutputModuleEvidence[]
