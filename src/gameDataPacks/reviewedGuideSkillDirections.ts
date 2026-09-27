import type { PlayerBuildSource } from './playerBuildProfiles'
import { stableContentHash } from './types'

/** Field-only adoption of reviewed public guide facts, not an entire build override. */
const harumasaPrydwenSkillPriorityFact = {
  id: 'prydwen-harumasa-current-2026-08-05',
  url: 'https://www.prydwen.gg/zenless/characters/harumasa',
  sourceVersion: null,
  pageLastUpdated: '20/August/2026',
  checkedAt: '2026-09-08T00:00:00.000Z',
  sourceText: {
    section: 'Skill priority',
    orderedLabels: ['Dodge', 'Chain Attack', 'Special Attack', 'Basic Attack', 'Assist'],
  },
} as const

export const reviewedGuideSkillDirections: Partial<
  Record<string, { directions: string[]; source: PlayerBuildSource }>
> = {
  ...Object.fromEntries(
    [
      {
        id: 'agent-grace',
        post: '56349316',
        image: '226493258',
        version: '1.0',
        hash: '613EC64A4E617686BEA522B7E759E7FFA8AC1E60245FF25D5CFF48A82BED2B54',
        directions: ['普攻 7+', '闪避 7+', '支援技 7+', '特殊技 12+', '终结技 9+', '核心技 F'],
      },
      {
        id: 'agent-seth',
        post: '57323848',
        image: '220288058',
        version: '1.1',
        hash: '1C1E3BE9318CF1F869B569AC233C5BB24A931F3B40B6916B3D9CFCB10E44A50E',
        directions: ['普攻 9+', '闪避 7+', '支援技 7+', '特殊技 9+', '终结技 10+', '核心技 F'],
      },
      {
        id: 'agent-lighter',
        post: '59713387',
        image: '228092032',
        version: '1.3',
        hash: 'A7B74A507B1A69408993A25A0AF0277E6D362502FE76AA2498562FE679D8FD85',
        directions: ['普攻 12+', '闪避 10+', '支援技 7+', '特殊技 12+', '终结技 11+', '核心技 F'],
      },
      {
        id: 'agent-manato',
        post: '69688062',
        image: '240631318',
        version: '2.3',
        hash: '5206D9D575EF2A7D1035399C4C57E67A93DFCAB7C37B5011E158EE2C1F591598',
        directions: ['普攻 12+', '闪避 10+', '支援技 11+', '特殊技 11+', '终结技 11+', '核心技 F'],
      },
    ].map(({ id, post, image, version, hash, directions }) => [
      id,
      {
        directions,
        source: {
          id: `miyoushe-post-${post}-skills-image-${image}`,
          url: `https://www.miyoushe.com/zzz/article/${post}`,
          sourceVersion: version,
          checkedAt: '2026-09-07T15:40:00.000Z',
          contentHash: hash,
          licenseBoundary:
            '公开原帖修订图经API与视觉核对；版本沿用原帖归档标签，不代表图片最后修订版本或当前最优。只采用等级下限，MAX映射既有核心满级F；未标优先，不从数字高低或图标颜色推排序。非潜能ON图，不分发原图。',
          verified: true,
        },
      },
    ]),
  ),
  ...Object.fromEntries(
    [
      {
        id: 'agent-jane',
        post: '57323897',
        image: '204102781',
        version: '1.1',
        hash: 'B19EC60A0E325A70C614A5BF2CA80090219AF74BA56DAB26AAC122E0FBF59237',
        directions: ['普攻优先升至 11+', '闪避 9+', '支援技 9+', '特殊技 9+', '连携技 7+'],
      },
      {
        id: 'agent-caesar',
        post: '57928556',
        image: '205566596',
        version: '1.2',
        hash: '022F1384875CD74841E86B5E8AFA8ED4EEFE6A6378317A18F7F9E4B01148E6F9',
        directions: ['普攻 7+', '闪避 7+', '支援技 9+', '特殊技优先升至 11+', '连携技 8+'],
      },
    ].map(({ id, post, image, version, hash, directions }) => [
      id,
      {
        directions,
        source: {
          id: `miyoushe-post-${post}-skills-image-${image}`,
          url: `https://www.miyoushe.com/zzz/article/${post}`,
          sourceVersion: version,
          checkedAt: '2026-09-07T15:30:00.000Z',
          contentHash: hash,
          licenseBoundary:
            '公开攻略原图经既有OCR API识别与技能区视觉复核；只采用明确优先标记和等级下限，图中未列核心技，不补推核心目标或完整排序。保留原版本，不声称当前版本最优，不分发原图。',
          verified: true,
        },
      },
    ]),
  ),
  'agent-seed': {
    directions: [
      '普攻优先升至 12',
      '核心技优先升至 F',
      '闪避 7+',
      '支援技 7+',
      '特殊技 11+',
      '终结技 11+',
    ],
    source: {
      id: 'miyoushe-2.7-post-74590835-skills-image-002',
      url: 'https://www.miyoushe.com/zzz/article/74590835',
      sourceVersion: '2.7',
      checkedAt: '2026-09-07T00:00:00.000Z',
      contentHash: 'E9D56E4CC2ADB0F6FEC9C30731F5ABF52E618E6C337EFDC434F01C20B36DFCCB',
      licenseBoundary:
        '已有本地002原图技能区视觉复核；普攻与核心明确优先，其余数字为等级目标，不推成升级顺序。不分发原图，不声称当前版本最优。',
      verified: true,
    },
  },
  ...Object.fromEntries(
    [
      {
        id: 'agent-yanagi',
        post: '59165099',
        version: '1.3',
        hash: '8EA85F0CAABC6553C1FC923C2707BF6E54A89D8F375C27E87ED69B047890C804',
        directions: [
          '技能等级不影响异常积蓄值，资源紧张时可先提高特殊技、核心技的等级。',
          '终结技的极性紊乱倍率会随着终结技的等级提升，如有需要也可升级。',
        ],
      },
      {
        id: 'agent-yuzuha',
        post: '66458093',
        version: '2.1',
        hash: 'F63894AFE3329AA3D10E6A911203BC60884AE6460636B917CABB604A133197F8',
        // Source says max core; F is the existing core-level vocabulary, not a priority rank.
        directions: ['升级核心技提高全队加攻幅度，推荐点满。', '核心技 F'],
      },
      {
        id: 'agent-yixuan',
        post: '65025747',
        version: '2.0',
        hash: '0323F067376D94BDE281A5E0C8D5A37FCAFADA9EDEA1569FA4507BA600885278',
        directions: [
          '推荐后期把终结技、特殊技、核心技和普攻这4个技能先拉满，闪避、支援技根据需求升级。',
        ],
      },
      {
        id: 'agent-zhu-yuan',
        post: '55577767',
        version: '1.0',
        hash: 'C894052D2E92B70B444D720383828B66E294A429FC33F8537BE6AF2707822AA9',
        directions: [
          '朱鸢的主要输出手段来源于【普通攻击】（长按普攻键的【压制模式】），因此优先升级普攻；其次考虑升级【特殊技】【支援技】和【连携技】，闪避最后升级。',
        ],
      },
      {
        id: 'agent-burnice',
        post: '58606692',
        version: '1.2',
        hash: 'E0DD387DA0AADCC8CEA28A30B468AF1A8501538A5C215B037CD94C002BC2AC80',
        // Retain original shorthand; do not invent skill IDs for "喷枪" or "大招".
        directions: ['优先升级核心技，其次喷枪和大招。'],
      },
      {
        id: 'agent-miyabi',
        post: '60271416',
        version: '1.4',
        hash: '63138E6D69878E50E2DA676FC61AD1FB1FBDF9357D1023F519304FB57CA8A2E3',
        directions: ['所以升级技能时，优先升级普攻提高蓄力普攻的伤害。'],
      },
      {
        id: 'agent-sunna',
        post: '72984392',
        version: '2.6',
        hash: 'B2B6A247BC0A6578F81084EC7D65B994E80EDD6A3F03B90A6ADC92AB8D2112D4',
        directions: [
          '千夏的增益幅度与【核心技】等级有关，推荐优先升级。',
          '虽然【强化特殊技】等级不影响增益能力，但作为重要的启动手段，仍可优先升级。',
        ],
      },
      {
        id: 'agent-cissia',
        post: '74635375',
        version: '2.7',
        hash: '0A0C8D683238461646F163D892CA981A4864AB029537DDDCFEE45F280124C1D7',
        directions: ['普攻、强化特殊技、终结技是希希芙主要输出手段，推荐优先升级。'],
      },
      {
        id: 'agent-starlight-billy',
        post: '75633121',
        version: '2.8',
        hash: 'E63344F2E3023CBB45699B8A8D0DB4B95536BC8B335A9E222519667E04E8C31A',
        directions: ['星徽·比利主要靠普攻、特殊技/强化特殊技、连携技/终结技输出，推荐优先升级。'],
      },
      {
        id: 'agent-norma',
        post: '76528334',
        version: '3.0',
        hash: '3098D6BA9C353E1F07E36757222D1E19EF5F26AEAB8307AD81EE8E06EF28E719',
        // Keep effect descriptions out of the priority clause: they name other skills.
        directions: [
          '核心技推荐优先升级。',
          '普攻、特殊技&强化特殊技、支援技（招架弹刀）、终结技等均是诺姆累积失衡值的主要手段，推荐优先升级。',
        ],
      },
      {
        id: 'agent-banyue',
        post: '71526574',
        version: '2.4',
        hash: 'F65AD6EDA9B4C10757C7A61A27C2082EF0783D513C2F14953F5BBA7914AB5E72',
        directions: [
          '般岳主要靠强化特殊技、普攻输出，推荐优先升级。',
          '所有技能均推荐升级，最好全部点满。',
        ],
      },
      {
        id: 'agent-soldier-0-anby',
        post: '62601775',
        version: '1.6',
        hash: '5F6EAEDB36C6B0393CAF12B3DF3BBD16C2AF9093B71F0907BF339ECE577FE3F2',
        directions: ['【白雷】【雷殛】的伤害占比最高，倍率与特殊技等级有关，推荐优先升级。'],
      },
      {
        id: 'agent-alice',
        post: '67197387',
        version: '2.1',
        hash: '4BE588291E62BF53E36A7B9F630BE176A1EBDA1B1D248B1B1960E9921873C3A6',
        directions: [
          '核心技可提高爱丽丝的物理异常积蓄效率，推荐优先升级。',
          '除核心技外，可根据自身需求酌情升级。',
        ],
      },
    ].map(({ id, post, version, hash, directions }) => [
      id,
      {
        directions,
        source: {
          id: `miyoushe-post-${post}-structured-skill-section`,
          url: `https://www.miyoushe.com/zzz/article/${post}`,
          sourceVersion: version,
          checkedAt: '2026-09-07T00:00:00.000Z',
          contentHash: hash,
          licenseBoundary:
            '已有归档完整富文本技能升级段落，保留原版本；只采用明确优先项，不把核心效果、伤害占比或全部点满推成完整排序，不声称当前版本最优。',
          verified: true,
        },
      },
    ]),
  ),
  'agent-aria': {
    directions: ['核心技优先升至 F', '普攻 11+', '闪避 7+', '支援技 9+', '特殊技 9+', '终结技 11+'],
    source: {
      id: 'miyoushe-3.1-post-76995934-author-79695828-skills-image-001',
      url: 'https://www.miyoushe.com/zzz/article/76995934',
      sourceVersion: '3.1',
      checkedAt: '2026-09-07T08:11:34.000Z',
      contentHash: 'C9D057ECCABB412188F000242862EC637CAB39ABE89C61232B66BA6E1A6F215A',
      licenseBoundary:
        '本地候选字段提取；归档主图 001.png 的技能加点区。仅核心标注优先，其余为等级下限，不推导先后顺序；不分发原图。',
      verified: true,
    },
  },
  'agent-harumasa': {
    // Prydwen's ordered Skill priority list is an ordinary build fact.  It is
    // deliberately kept apart from the historical Potential 6/6 level image.
    directions: ['技能优先级按页面顺序投入：闪避、连携技、特殊技、普攻、支援技。'],
    source: {
      id: harumasaPrydwenSkillPriorityFact.id,
      url: harumasaPrydwenSkillPriorityFact.url,
      sourceVersion: harumasaPrydwenSkillPriorityFact.sourceVersion,
      checkedAt: harumasaPrydwenSkillPriorityFact.checkedAt,
      contentHash: stableContentHash(harumasaPrydwenSkillPriorityFact),
      licenseBoundary:
        '公开 Prydwen BUILD 页经本轮读取：Skill priority 逐项顺序为 Dodge、Chain Attack、Special Attack、Basic Attack、Assist；页面 Last updated 为 20/August/2026，非游戏版本。只采用该普通技能排序，不补技能等级、不把历史潜能 6/6 等级图并入，也不声称正式最优或分发页面内容。',
      verified: true,
    },
  },
}
