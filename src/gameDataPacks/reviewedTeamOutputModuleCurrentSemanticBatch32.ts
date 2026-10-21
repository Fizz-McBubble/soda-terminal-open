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
      id: `module-current-semantic-${claimId.slice('reviewed-nested-'.length)}`,
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
 * Exact teams that fill released-member branches between source versions.
 * Positive tags come from the cited prose; omitted dimensions remain unknown.
 */
export const reviewedTeamOutputModuleCurrentSemanticBatch32 = [
  reviewed(
    'reviewed-nested-1062d703e89afbcdf5bcf6e3',
    ['agent-remielle', 'agent-alice', 'agent-velina'],
    [
      'attribute_anomaly',
      ['luminize'],
      ['quick_swap', 'ultimate', 'stun_window'],
      ['support', 'anomaly_amplification'],
    ],
    [
      [61, 34, 46, '凭借极性强击也能为丹攒豆'],
      [61, 234, 243, '使蕾米流变物理属性'],
      [61, 339, 356, '蕾米长E时屏幕闪出白光就能提前切人'],
      [61, 467, 491, '蕾米的终结技通常在敌人进入失衡期的那轮爆发中使用'],
    ],
  ),
  reviewed(
    'reviewed-nested-02a91aec50d320ba417fcf1e',
    ['agent-remielle', 'agent-burnice', 'agent-miyabi'],
    ['direct_damage', ['disorder', 'luminize'], ['quick_swap'], []],
    [
      [54, 61, 77, '由柏妮思与雅互相触发紊乱为雅回豆'],
      [54, 78, 90, '再由蕾米登场打出耀变伤害'],
      [54, 91, 104, '该玩法的雅仍可考虑直伤流派'],
    ],
  ),
  reviewed(
    'reviewed-nested-c88c376bc5d057cdf2f2fd16',
    ['agent-remielle', 'agent-piper', 'agent-velina'],
    ['attribute_anomaly', ['luminize'], ['quick_swap', 'ultimate', 'stun_window'], []],
    [
      [57, 42, 64, '物理异常频率越高、切蕾米登场打耀变的次数越多'],
      [57, 167, 176, '使蕾米流变物理属性'],
      [57, 347, 371, '蕾米的终结技通常在敌人进入失衡期的那轮爆发中使用'],
    ],
  ),
  reviewed(
    'reviewed-nested-93473931f5eb97df64ea1325',
    ['agent-remielle', 'agent-promeia', 'agent-velina'],
    [
      'attribute_anomaly',
      ['abloom'],
      ['quick_swap', 'ultimate', 'stun_window'],
      ['anomaly_amplification'],
    ],
    [
      [59, 15, 26, '普罗米娅也主打异放伤害'],
      [59, 389, 403, '未到失衡前就消耗霜刑点打异放'],
      [59, 450, 474, '蕾米的终结技通常在敌人进入失衡期的那轮爆发中使用'],
    ],
  ),
  reviewed(
    'reviewed-nested-bd79887246f29cc73a37e8a1',
    ['agent-remielle', 'agent-promeia', 'agent-vivian'],
    [
      'attribute_anomaly',
      ['abloom'],
      ['quick_swap', 'ultimate', 'stun_window'],
      ['anomaly_amplification'],
    ],
    [
      [59, 15, 26, '普罗米娅也主打异放伤害'],
      [59, 389, 403, '未到失衡前就消耗霜刑点打异放'],
      [59, 450, 474, '蕾米的终结技通常在敌人进入失衡期的那轮爆发中使用'],
    ],
  ),
  reviewed(
    'reviewed-nested-4beefb78a2593af084ae9e41',
    ['agent-remielle', 'agent-yanagi', 'agent-velina'],
    ['attribute_anomaly', ['disorder'], ['quick_swap'], []],
    [
      [68, 33, 45, '柳的增益主要围绕紊乱展开'],
      [68, 62, 70, '搭配丹维表现尚可'],
    ],
  ),
  reviewed(
    'reviewed-nested-bff1d47ed22af67e0ef833da',
    ['agent-alice', 'agent-velina', 'agent-nangong'],
    ['attribute_anomaly', ['abloom', 'disorder'], ['quick_swap', 'stun_window'], []],
    [
      [60, 56, 72, '爱丽丝的极性强击也能触发乱流效果'],
      [60, 132, 147, '使爱丽丝在失衡爆发期的表现更强'],
      [60, 151, 165, '将【剑仪】资源攒到失衡期使用'],
      [60, 364, 378, '物理异放、紊乱等多种结算伤害'],
    ],
  ),
  reviewed(
    'reviewed-nested-cc5ba0110b0534933185e1b3',
    ['agent-alice', 'agent-velina', 'agent-yuzuha'],
    ['attribute_anomaly', ['abloom', 'disorder'], ['quick_swap', 'stun_window'], []],
    [
      [60, 56, 72, '爱丽丝的极性强击也能触发乱流效果'],
      [60, 364, 378, '物理异放、紊乱等多种结算伤害'],
      [60, 230, 256, '非失衡期爱丽丝利用强化特殊技打南十字，失衡期打北十字'],
    ],
  ),
  reviewed(
    'reviewed-nested-80546da551d645aa4bcd7f08',
    ['agent-burnice', 'agent-velina', 'agent-yuzuha'],
    ['attribute_anomaly', ['abloom'], ['quick_swap'], []],
    [
      [63, 70, 86, '利用【流火】在切出时触发一次异放'],
      [63, 120, 135, '维琳娜置于柏妮丝之后、柚叶之前'],
    ],
  ),
  reviewed(
    'reviewed-nested-ffc8f0de927d4c1951b3c6d1',
    ['agent-grace', 'agent-velina', 'agent-nangong'],
    ['attribute_anomaly', ['abloom'], ['quick_swap', 'stun_window'], ['stun']],
    [
      [65, 9, 27, '加强后的格莉丝能消耗脉冲触发异放伤害'],
      [65, 38, 57, '通常优先柚叶、南宫羽、耀嘉音等限定角色'],
      [65, 172, 182, '维琳娜置于格莉丝之后'],
    ],
  ),
  reviewed(
    'reviewed-nested-787f8b9f54df18cb7c33a8ba',
    ['agent-grace', 'agent-velina', 'agent-rina'],
    ['attribute_anomaly', ['abloom'], ['quick_swap'], ['anomaly_amplification']],
    [
      [65, 9, 27, '加强后的格莉丝能消耗脉冲触发异放伤害'],
      [65, 65, 82, '丽娜，能延长感电时间、提高结算倍率'],
    ],
  ),
  reviewed(
    'reviewed-nested-edc74bcbefd509a7de93e367',
    ['agent-promeia', 'agent-velina', 'agent-astra'],
    [
      'attribute_anomaly',
      ['abloom'],
      ['quick_swap', 'chain', 'ultimate', 'stun_window'],
      ['support'],
    ],
    [
      [55, 540, 554, '普罗米娅的连携技也能结算异放'],
      [55, 422, 427, '失衡双连携'],
      [55, 116, 144, '耀嘉音等辅助代替，前者更快累积失衡值、后者也能提高攻击力'],
    ],
  ),
  reviewed(
    'reviewed-nested-e4b460686baadbc3cd429b9e',
    ['agent-promeia', 'agent-velina', 'agent-nangong'],
    [
      'attribute_anomaly',
      ['abloom'],
      ['quick_swap', 'chain', 'ultimate', 'stun_window'],
      ['stun', 'support'],
    ],
    [
      [55, 540, 554, '普罗米娅的连携技也能结算异放'],
      [55, 422, 427, '失衡双连携'],
      [55, 125, 134, '前者更快累积失衡值'],
    ],
  ),
  reviewed(
    'reviewed-nested-c7c825da75cc8b91ff3081de',
    ['agent-promeia', 'agent-velina', 'agent-yuzuha'],
    [
      'attribute_anomaly',
      ['abloom'],
      ['quick_swap', 'chain', 'ultimate', 'stun_window'],
      ['support'],
    ],
    [
      [55, 540, 554, '普罗米娅的连携技也能结算异放'],
      [55, 62, 75, '染色机制能更快累积冰异常值'],
    ],
  ),
  reviewed(
    'reviewed-nested-e122f016f17291dc4782d75f',
    ['agent-yanagi', 'agent-velina', 'agent-yuzuha'],
    ['attribute_anomaly', ['polarity', 'disorder'], ['quick_swap'], ['support']],
    [
      [69, 34, 67, '施加风异常积蓄时不能触发紊乱、只触发乱流，但不影响柳的极性紊乱触发'],
      [69, 71, 82, '柳的一部分输出依靠紊乱'],
    ],
  ),
  reviewed(
    'reviewed-nested-c2422921f727d1516bb0c1ef',
    ['agent-yanagi', 'agent-velina', 'agent-nangong'],
    [
      'attribute_anomaly',
      ['polarity', 'disorder'],
      ['quick_swap', 'stun_window'],
      ['stun', 'support'],
    ],
    [
      [69, 34, 67, '施加风异常积蓄时不能触发紊乱、只触发乱流，但不影响柳的极性紊乱触发'],
      [69, 71, 82, '柳的一部分输出依靠紊乱'],
    ],
  ),
  reviewed(
    'reviewed-nested-883bd9993aba716d8a3af697',
    ['agent-evelyn', 'agent-norma', 'agent-astra'],
    ['direct_damage', [], ['stun_window', 'chain'], ['stun', 'support']],
    [
      [53, 29, 39, '伊芙琳主打连携技伤害'],
      [53, 40, 62, '失衡期恰当利用能让伊芙琳更轻松地打出多连携技'],
    ],
  ),
  reviewed(
    'reviewed-nested-455b6e83c70d2049e38ca8e7',
    ['agent-evelyn', 'agent-norma', 'agent-dialyn'],
    ['direct_damage', [], ['stun_window', 'chain'], ['stun', 'support']],
    [
      [53, 29, 39, '伊芙琳主打连携技伤害'],
      [53, 40, 62, '失衡期恰当利用能让伊芙琳更轻松地打出多连携技'],
    ],
  ),
  reviewed(
    'reviewed-nested-655b2d8c6ac16c600089b877',
    ['agent-starlight-billy', 'agent-norma', 'agent-astra'],
    ['rupture', ['penetration'], ['stun_window', 'chain', 'ultimate'], ['stun', 'support']],
    [
      [55, 19, 37, '比利等命破C也是“击破+辅助”的组合'],
      [55, 39, 57, '诺姆的快支升连携能让比利回复更多决意'],
      [55, 769, 788, '比利的招式在失衡期打出能获得更高的分数'],
    ],
  ),
  reviewed(
    'reviewed-nested-24a29bf32c23c8b22b334345',
    ['agent-cissia', 'agent-norma', 'agent-astra'],
    ['direct_damage', [], ['stun_window', 'chain'], ['stun', 'support']],
    [
      [57, 12, 28, '单C带队更适合解锁1、2影后考虑'],
      [57, 448, 459, '希希芙快支升连携进失衡'],
      [57, 561, 578, '通过主动取消连携来让希希芙持续输出'],
    ],
  ),
] as const satisfies readonly ReviewedTeamOutputModuleEvidence[]
