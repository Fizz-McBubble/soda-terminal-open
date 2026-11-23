import type { SkillPriorityKey } from '../pages/agentDevelopmentSkillPriority'

export type ReviewedDevelopmentSkillOrder = {
  ordinaryPriority: readonly Exclude<SkillPriorityKey, 'core'>[]
  sourceUrl: string
  retrievedAt: string
  selectedGroups: readonly (readonly SkillPriorityKey[])[]
  reviewedSources: readonly { publisher: string; author: string; url: string; section: string }[]
  decisionReason: string
  utilityOnlyCombat?: true
}

/* Internal source locator omitted.


 */
export const reviewedDevelopmentSkillOrders33: Readonly<
  Record<string, ReviewedDevelopmentSkillOrder>
> = {
  'agent-phoenix': {
    ordinaryPriority: ['basic', 'chain', 'assist', 'special', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/phoenix',
    retrievedAt: '2026-10-30',
    selectedGroups: [
      ['core', 'basic'],
      ['special', 'chain'],
      ['assist', 'dodge'],
    ],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/phoenix-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/phoenix-build',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留游戏内并列；游戏技能成长与Lin-0均证明普攻影响异放，拒绝Icy仅核心成长的泛化。',
  },
  'agent-roxy': {
    ordinaryPriority: ['special', 'chain', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/roxy',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain', 'assist'], ['basic', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/roxy-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/roxy-build',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lin-0给出核心、特殊、连携与支援并列，Lily确认核心与主要输出技；普通招式不套攻击角色通用满级。',
  },
  'agent-claret': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/claret',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core', 'special'], ['chain', 'basic'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Darrus Myles Jr',
        url: 'https://www.icy-veins.com/zenless-zone-zero/claret-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/claret-build',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '特殊技关联创伤倍率；Lin-0明确核心与特殊并列，Darrus确认普攻与终结同为主要招式。',
  },
  'agent-sigrid': {
    ordinaryPriority: ['basic', 'chain', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/sigrid',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'chain'], ['special'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/sigrid-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/sigrid-build-guide',
        section: 'Skill Priority',
      },
    ],
    decisionReason: '核心暴击与长矛机制优先；采用Lin-0明确的普攻与终结并列，避免仅将普攻预算置顶。',
  },
  'agent-remielle': {
    ordinaryPriority: ['chain', 'basic', 'assist', 'special', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/remielle',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core', 'basic', 'assist', 'chain'], ['special'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Mistsplitter Reforged',
        url: 'https://www.icy-veins.com/zenless-zone-zero/remielle-dan-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/remielle-build-guide',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留已确认黄金样与四战斗技点满；两位归档作者、Lin-0及Mistsplitter均支持四技成长，闪避低投入。',
  },
  'agent-norma': {
    ordinaryPriority: ['special', 'chain', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/norma',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain', 'assist'], ['basic', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/norma-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/norma-build-guide',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '核心与强化特殊为启动及主要失衡；Lin-0明确连携和支援并列，烟雨如诗与Asgater折叠正文交叉支持。',
  },
  'agent-pyrois': {
    ordinaryPriority: ['chain', 'basic', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/pyrois',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core', 'chain', 'basic'], ['special'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Mistsplitter Reforged',
        url: 'https://www.icy-veins.com/zenless-zone-zero/pyrois-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/pyrois-build-guide',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lin-0将核心、终结和普攻并列；Mistsplitter与Asgater确认这些招式及特殊为主要输出，不拆开同组。',
  },
  'agent-velina': {
    ordinaryPriority: ['special', 'chain', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/velina',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain', 'assist'], ['basic', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Mistsplitter Reforged',
        url: 'https://www.icy-veins.com/zenless-zone-zero/velina-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/velina-build-guide',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '乱流与异放主要随核心成长；普通技能仅提升直伤和失衡，采用两份独立攻略一致的工具性预算，不把旧图高等级作为必要增益门槛。',
    utilityOnlyCombat: true,
  },
  'agent-starlight-billy': {
    ordinaryPriority: ['chain', 'special', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/billy-starlight',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core', 'special', 'chain'], ['basic'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/starlight-billy-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/starlight-billy-build-guide',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Jaymo确认特殊为主要输出，Lin-0把特殊和终结并列；Asgater明确点满中只采用独立证据共同支持的普攻、特殊、终结。',
  },
  'agent-promeia': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/promeia',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'special'], ['chain'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Mistsplitter Reforged',
        url: 'https://www.icy-veins.com/zenless-zone-zero/promeia-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/promeia-build-guide',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '两份独立攻略和Asgater均区分核心异放与普通技能失衡；拒绝旧单图全高等级作为必需输出条件，普通技能使用工具性预算。',
    utilityOnlyCombat: true,
  },
  'agent-cissia': {
    ordinaryPriority: ['basic', 'special', 'chain', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/cissia',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['special'], ['chain'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Mistsplitter Reforged',
        url: 'https://www.icy-veins.com/zenless-zone-zero/cissia-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/cissia',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留作者数值下限；Mistsplitter与Lin-0均确认蚀骨及蛇吻归普攻、特殊回资源、终结次之。',
  },
  'agent-nangong': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/nangong-yu',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'special'], ['chain'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/nangong-yu-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/nangong-yu',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '普攻蓄力与特殊均是主要失衡来源；Lin-0明确两者并列，Shikhu及Asgater确认全技能可投但闪避靠后。',
  },
  'agent-aria': {
    ordinaryPriority: ['basic', 'assist', 'special', 'chain', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/aria',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['special', 'chain'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/aria-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/aria',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留明确数值下限；异放倍率归核心，Lin-0和烟雨如诗支持普攻其次，Piyo对终结的偏好保留为次级直伤分歧，不转成异放成长。',
  },
  'agent-sunna': {
    ordinaryPriority: ['special', 'chain', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/sunna',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain'], ['assist'], ['basic', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Mistsplitter Reforged',
        url: 'https://www.icy-veins.com/zenless-zone-zero/sunna-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/sunna',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '千夏攻击增益与猫眼归核心；Mistsplitter、Lin-0及两份归档均说明其余为失衡、治疗用途，拒绝旧图普攻高等级作为泡泡倍率门槛。',
    utilityOnlyCombat: true,
  },
  'agent-zhao': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/zhao',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'special'], ['chain', 'assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/zhao-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/zhao',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '采用Lin-0普攻与特殊并列；Jaymo也确认普攻重要，保留青枫原图下限且不将战斗技等级当攻击增益等级。',
  },
  'agent-ye-shunguang': {
    ordinaryPriority: ['basic', 'chain', 'special', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/ye-shunguang',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'chain'], ['special'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Mistsplitter Reforged',
        url: 'https://www.icy-veins.com/zenless-zone-zero/ye-shunguang-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/ye-shunguang',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lin-0明确普攻终结并列；Mistsplitter和Asgater支持三主要输出技，采用原文推荐点满，替换未定基础口径的11+下限目标。',
  },
  'agent-banyue': {
    ordinaryPriority: ['chain', 'special', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/banyue',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'special', 'chain'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/banyue-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留Asgater全部点满事实；Jaymo明确普攻、特殊为主要手段，不再仅以聚合页终结第一解释伤害。',
  },
  'agent-dialyn': {
    ordinaryPriority: ['chain', 'special', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/dialyn',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special', 'chain'], ['assist'], ['basic'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/dialyn-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Shikhu与Asgater均强调特殊、终结失衡及招架；采纳青枫明确下限，闪避低频不误作主要投入。',
  },
  'agent-yidhari': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/yidhari',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special', 'basic'], ['chain'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/yidhari-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Jaymo及Asgater均确认普攻与特殊为主要输出；改为共同主要组，避免只按聚合顺序让普攻停在次级预算。',
  },
  'agent-lucia': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/lucia',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core', 'special'], ['chain'], ['basic', 'assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/lucia-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Piyo与Asgater均支持核心增伤及特殊贯穿增益；特殊到基础12上限是明确目标，治疗和追击不冒充同一增益来源。',
  },
  'agent-orphie-magus': {
    ordinaryPriority: ['special', 'chain', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/orphie-and-magus',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain'], ['assist', 'basic'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/orphie-and-magus-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lily与Asgater确认核心全队增益、特殊追击及终结爆发；保留普通技能顺序，加入独立核心优先依据。',
  },
  'agent-seed': {
    ordinaryPriority: ['basic', 'chain', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/seed',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core', 'basic'], ['chain'], ['special'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/seed-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: '17173',
        author: '绳匠小助手',
        url: 'https://news.17173.com/content/09052025/000602236.shtml',
        section: '二、技能加点',
      },
      {
        publisher: 'Mobalytics',
        author: 'Lin-0',
        url: 'https://mobalytics.gg/zzz/builds/seed',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lily与Lin-0确认普攻核心；绳匠小助手明确普攻推荐升满，单独采用该事实解开旧图12的基础/显示口径，不篡改旧图。',
  },
  'agent-alice': {
    ordinaryPriority: ['basic', 'chain', 'special', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/alice',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['chain', 'special'], ['dodge', 'assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/alice-thymefield-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Jaymo与Asgater均支持核心机制和普攻常用；保留作者下限，普通直伤不能解释为异常倍率成长。',
  },
  'agent-yuzuha': {
    ordinaryPriority: ['basic', 'chain', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/ukinami-yuzuha',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'special', 'chain'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/ukinami-yuzuha-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Shikhu与Asgater确认核心、普攻、特殊、终结分别有机制收益；保留明确作者下限及各技能效果边界。',
  },
  'agent-ju-fufu': {
    ordinaryPriority: ['chain', 'special', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/ju-fufu',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['chain'], ['special'], ['assist', 'basic'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/ju-fufu-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Piyo与Asgater均确认核心辅助和连携失衡；保留既有数字及补充原文，不因排序重算作者目标。',
  },
  'agent-yixuan': {
    ordinaryPriority: ['chain', 'special', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/yixuan',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core', 'special', 'chain', 'basic'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/yixuan-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留Asgater四技能点满，Jaymo交叉支持；青枫闪避10+支援11+作为原样下限，未声明影画口径不升格成基础精确值。',
  },
  'agent-hugo': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/hugo',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special', 'chain'], ['basic'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/hugo-vlad-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E9%9B%A8%E6%9E%9C',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason: 'Lily与BWIKI均支持特殊及终结决算同为主要爆发，保留并列而非让终结降一档。',
  },
  'agent-vivian': {
    ordinaryPriority: ['basic', 'chain', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/vivian',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core'], ['basic'], ['special', 'chain'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/vivian-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Shikhu与Asgater确认核心异放及普通技能工具用途；保留明确作者下限，不把普通技能升级解释成异放增长。',
  },
  'agent-trigger': {
    ordinaryPriority: ['basic', 'special', 'chain', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/trigger',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core'], ['basic'], ['special', 'chain'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/trigger-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason: 'Piyo与Asgater确认核心失衡倍率、普攻追击；追击双标签不能导致升级特殊取代普攻。',
  },
  'agent-soldier-0-anby': {
    ordinaryPriority: ['special', 'chain', 'basic', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/anby-demara-soldier-0',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core'], ['special'], ['chain'], ['basic'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/soldier-0-anby-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lily与1.6 Asgater共同核对P0白雷归特殊；P6独立资料继续由潜能选择器消费，不混到P0。',
  },
  'agent-evelyn': {
    ordinaryPriority: ['chain', 'basic', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/evelyn',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['chain'], ['basic', 'special'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/evelyn-chevalier-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留连携作为主要爆发的完整聚合顺序；Piyo确认普攻特殊常用，合为同一后续预算组，不将其忽略连携的简写当作删除依据。',
  },
  'agent-astra': {
    ordinaryPriority: ['special', 'chain', 'assist', 'dodge', 'basic'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/astra-yao',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core', 'special'], ['chain'], ['assist'], ['dodge', 'basic']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/astra-yao-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Jaymo及Asgater、青枫均支持核心和特殊全队增益；特殊必点满采用原文，终结只解释治疗成长。',
  },
  'agent-miyabi': {
    ordinaryPriority: ['basic', 'chain', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/miyabi',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['chain', 'special'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Seliathan',
        url: 'https://www.icy-veins.com/zenless-zone-zero/hoshimi-miyabi-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Seliathan支持普攻优先与终结特殊后续；保留聚合页主次，把两项后续技能置同一预算组。',
  },
  'agent-harumasa': {
    ordinaryPriority: ['dodge', 'chain', 'special', 'basic', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/harumasa',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['dodge'], ['special', 'chain', 'basic'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/asaba-harumasa-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E6%82%A0%E7%9C%9F',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'Lily与BWIKI的P0闪电出击归闪避一致；后续三技能并列，潜能版另用独立目标，旧“未对齐条件”不再留空。',
  },
  'agent-lighter': {
    ordinaryPriority: ['basic', 'special', 'chain', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/lighter',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'special'], ['chain'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/lighter-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Jaymo与既有Asgater数值确认普攻和特殊优先；保留作者明确下限而非按同职业模板重造。',
  },
  'agent-yanagi': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/yanagi',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['basic', 'chain'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/tsukishiro-yanagi-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Piyo与Asgater确认特殊极性紊乱、普攻姿态及终结用途；保留既有数值与原文明示条件。',
  },
  'agent-burnice': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/burnice',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special', 'chain'], ['basic'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Darrus Myles Jr',
        url: 'https://www.icy-veins.com/zenless-zone-zero/burnice-white-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Darrus与Asgater均支持P0喷枪及终结；既有低投入下限保留，P6升级目标独立，不按新顺序覆盖数字。',
  },
  'agent-caesar': {
    ordinaryPriority: ['assist', 'special', 'basic', 'dodge', 'chain'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/caesar',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core'], ['assist', 'special'], ['basic'], ['dodge'], ['chain']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/caesar-king-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason: 'Jaymo确认核心、支援、特殊；保留作者下限和优先提示，支援及特殊共同承担失衡。',
  },
  'agent-jane': {
    ordinaryPriority: ['chain', 'special', 'basic', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/jane-doe',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['chain', 'special'], ['basic'], ['dodge', 'assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/jane-doe-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lily区分P0异常核心与技能直伤，Asgater图中普攻11+仍作下限；P6独立，不将潜能高倍率写回P0。',
  },
  'agent-qingyi': {
    ordinaryPriority: ['basic', 'special', 'chain', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/qingyi',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['special', 'dodge'], ['chain'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/qingyi-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E9%9D%92%E8%A1%A3',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'Piyo与BWIKI确认核心及普攻失衡主轴；特殊与闪反按使用频率并列，连携不代替其主要失衡职能。',
  },
  'agent-zhu-yuan': {
    ordinaryPriority: ['basic', 'chain', 'special', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/zhu-yuan',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['chain', 'special'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/zhu-yuan-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lily及Asgater确认压制普攻第一；终结特殊为后续，保留支援优于闪避，不依赖伤害占比推导精确循环。',
  },
  'agent-nekomata': {
    ordinaryPriority: ['dodge', 'chain', 'special', 'basic', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/nekomata',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'special'], ['chain'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/nekomata-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E7%8C%AB%E5%8F%88',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'BWIKI常规P0普攻特殊并列，与Icy核心及爆发段交叉核对；聚合闪避第一含玩法差异，不把P6条件带入P0。',
  },
  'agent-soldier-11': {
    ordinaryPriority: ['basic', 'chain', 'special', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/soldier-11',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core', 'basic'], ['special', 'chain'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/soldier-11-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/11%E5%8F%B7',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'Lily、BWIKI及P0原档均确认普攻主轴；特殊终结并列，P6单独选择，不以最新聚合图覆盖基础加点。',
  },
  'agent-koleda': {
    ordinaryPriority: ['special', 'chain', 'assist', 'dodge', 'basic'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/koleda',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain', 'dodge'], ['basic'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/koleda-belobog-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E7%8F%82%E8%95%BE%E5%A6%B2',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason: 'Jaymo与BWIKI支持特殊失衡第一、终结及闪反后续；P0与P6不共用等级目标。',
  },
  'agent-lycaon': {
    ordinaryPriority: ['special', 'assist', 'chain', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/lycaon',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['basic', 'assist', 'chain'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/von-lycaon-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E8%8E%B1%E5%8D%A1%E6%81%A9',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'Icy确认站场普攻，BWIKI速切强调特殊和招架；共同部分特殊优先，普通第二组保留两种用途，不把速切独有降级作为全局规则。',
  },
  'agent-grace': {
    ordinaryPriority: ['special', 'chain', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/grace-howard',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['basic', 'chain'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/grace-howard-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Piyo与Asgater明确核心积蓄和特殊主要用途；保留作者数字，P0和P6分开，不把技能直伤等同异常倍率。',
  },
  'agent-ellen': {
    ordinaryPriority: ['chain', 'special', 'basic', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/ellen',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['special', 'chain'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/ellen-joe-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason: 'Shikhu及P0作者图确认普攻主轴、特殊终结后续；潜能后终结顺序只供P6，不回填P0。',
  },
  'agent-rina': {
    ordinaryPriority: ['chain', 'special', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/rina',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['chain'], ['special'], ['basic'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/alexandrina-sebastiane-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Piyo及HoYo青枫确认核心穿透增益；终结特殊为普通技能后续，P6仍消费01+等独立目标。',
  },
  'agent-manato': {
    ordinaryPriority: ['chain', 'assist', 'basic', 'special', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/manato',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core'], ['basic'], ['chain', 'assist'], ['special'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/komano-manato-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      '保留作者数值下限；Jaymo补充终结和支援实战价值，将两者后续并列而不改写原图数值。',
  },
  'agent-pan-yinhu': {
    ordinaryPriority: ['chain', 'assist', 'special', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/pan-yinhu',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core'], ['special', 'chain'], ['basic', 'assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/pan-yinhu-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Piyo确认核心贯穿增益、特殊输出和终结治疗；拒绝仅据聚合排序让支援先于特殊，与失衡/治疗用途分开。',
  },
  'agent-pulchra': {
    ordinaryPriority: ['special', 'chain', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/pulchra',
    retrievedAt: '2026-11-01',
    selectedGroups: [['core'], ['assist', 'chain'], ['special'], ['basic'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/pulchra-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Piyo明确核心猎步、支援和连携；改用具名攻略实际加点，避免聚合特殊第一被当作所有玩法唯一顺序。',
  },
  'agent-seth': {
    ordinaryPriority: ['chain', 'special', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/seth',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['assist', 'special'], ['chain'], ['basic'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/seth-lowell-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Jaymo确认核心、支援、特殊；保留Asgater等级下限，核心精通盾和普通失衡用途分开。',
  },
  'agent-anby': {
    ordinaryPriority: ['special', 'basic', 'chain', 'dodge', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/anby-demara',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['basic'], ['chain', 'dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Piyo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/anby-demara-guide-best-builds',
        section: 'Skill Priority / How to Play',
      },
    ],
    decisionReason:
      'Piyo独立正文以EX闪电为主要失衡、普攻落雷后续；排除零号安比62601775同名误命中，不将其白雷机制用于安比。',
  },
  'agent-nicole': {
    ordinaryPriority: ['chain', 'special', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/nicole-demara',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special', 'chain'], ['basic'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/nicole-demara-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Shikhu及Asgater同帖妮可段落确认核心辅助，特殊连携为失衡和直伤；不从同帖朱鸢段落借普攻优先。',
  },
  'agent-corin': {
    ordinaryPriority: ['chain', 'special', 'assist', 'dodge', 'basic'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/corin',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special', 'chain'], ['basic'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/corin-wickes-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E5%8F%AF%E7%90%B3',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'BWIKI明确特殊连携并列，Lily确认普攻有价值；纠正聚合列表将普攻排到最后导致基础7的预算。',
  },
  'agent-billy': {
    ordinaryPriority: ['chain', 'special', 'dodge', 'basic', 'assist'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/billy-kid',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic', 'chain'], ['special'], ['dodge'], ['assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Lily',
        url: 'https://www.icy-veins.com/zenless-zone-zero/billy-kid-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Lily明确普通比利普攻应升满；保留连携爆发并列，排除星徽比利75633121变体的全技能点满建议。',
  },
  'agent-anton': {
    ordinaryPriority: ['chain', 'basic', 'special', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/anton',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['basic'], ['special', 'chain'], ['assist'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/anton-ivanov-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E5%AE%89%E4%B8%9C',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'Jaymo明确爆发模式普攻为主输出；BWIKI的带耀支援流将支援置首，条件不同，不外推成全局加点；默认普攻先于终结。',
  },
  'agent-ben': {
    ordinaryPriority: ['chain', 'special', 'assist', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/ben',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain', 'assist'], ['basic'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/ben-bigger-guide-best-builds',
        section: 'Skill Priority',
      },
    ],
    decisionReason:
      'Shikhu与Asgater同帖本段落确认特殊格挡主机制；连携招架后续，不从同帖其他代理人借加点。',
  },
  'agent-soukaku': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/soukaku',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special'], ['chain'], ['basic'], ['assist', 'dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/soukaku-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E8%8B%8D%E8%A7%92',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'Shikhu与BWIKI区分辅助核心增益与输出特殊；本轮沿辅助默认，普通技能只作失衡预算，不把高频使用等同增益成长。',
  },
  'agent-lucy': {
    ordinaryPriority: ['special', 'chain', 'basic', 'assist', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/lucy',
    retrievedAt: '2026-11-01',
    selectedGroups: [['special'], ['core'], ['assist'], ['basic'], ['chain'], ['dodge']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Jaymo',
        url: 'https://www.icy-veins.com/zenless-zone-zero/lucy-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E9%9C%B2%E8%A5%BF',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'Jaymo和BWIKI均确认特殊决定攻击增益；支援失衡、普攻小猪后续，核心独立不挤占战斗技能预算。',
  },
  'agent-piper': {
    ordinaryPriority: ['special', 'assist', 'chain', 'basic', 'dodge'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/piper',
    retrievedAt: '2026-10-30',
    selectedGroups: [['core'], ['special', 'basic'], ['chain'], ['dodge', 'assist']],
    reviewedSources: [
      {
        publisher: 'Icy Veins',
        author: 'Shikhu',
        url: 'https://www.icy-veins.com/zenless-zone-zero/piper-wheel-guide-best-builds',
        section: 'Skill Priority',
      },
      {
        publisher: 'BWIKI',
        author: '未署名的社区编辑者',
        url: 'https://wiki.biligame.com/zzz/%E6%B4%BE%E6%B4%BE',
        section: '技能升级推荐（玩法条件单独裁决）',
      },
    ],
    decisionReason:
      'BWIKI明确旋转特殊与普攻同组，Shikhu确认核心与全技能用途；纠正支援先于主要普攻的聚合预算。',
  },
}

export const developmentSkillOrderReview33 = Object.freeze({
  reviewedAt: '2026-11-01',
  evaluatedForVersion: '3.3',
  sourceSection: 'Skill priority and skill-specific rationale',
  numericEvidence: 'none_from_order',
  independentEditorialReviews: 61,
  boundary:
    'Author identity and field content, not domain count; HoyoBuild cross-references are not independent evidence. Floors, maxima and local budgets remain distinct.',
})

export function getReviewedDevelopmentSkillOrder33(agentId: string, targetVersion: string) {
  return targetVersion === developmentSkillOrderReview33.evaluatedForVersion
    ? reviewedDevelopmentSkillOrders33[agentId]
    : undefined
}

export function getReviewedDevelopmentSkillGroups33(agentId: string, targetVersion: string) {
  return getReviewedDevelopmentSkillOrder33(agentId, targetVersion)?.selectedGroups
}

export type ReviewedDevelopmentSkillTargetSupplement = {
  skill: SkillPriorityKey
  replaces?: readonly string[]
  source: {
    url: string
    author: string
    sourceVersion: string | null
    imageSha256?: string
    evidenceFile?: string
    hashKind?: 'sha256_file'
    evidenceSha256?: string
  }
} & ({ kind: 'paid_maximum' } | { kind: 'image_floor'; level: number; levelBasis?: 'unspecified' })

/** Explicit cap prose and displayed image floors keep their own authorship.
 * Image floors do not claim paid/effective basis or the author's current meta.
 * Utility-only old full-investment images were reviewed, not blindly adopted. */
const reviewedDevelopmentSkillTargetSupplements33: Readonly<
  Record<string, readonly ReviewedDevelopmentSkillTargetSupplement[]>
> = {
  'agent-roxy': [
    {
      skill: 'chain',
      kind: 'image_floor',
      level: 11,
      levelBasis: 'unspecified',
      replaces: ['9+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/78535279',
        author: 'HoYo青枫',
        sourceVersion: '3.2',
        imageSha256: '91E91D56F047D49CD7A0858FA8E41B202C702C3A6FE33B8B69119AB4E53DA0BA',
      },
    },
  ],
  'agent-sigrid': [
    {
      skill: 'assist',
      kind: 'image_floor',
      level: 10,
      levelBasis: 'unspecified',
      replaces: ['7+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/77588722',
        author: 'HoYo青枫',
        sourceVersion: '3.1',
        imageSha256: '6DD0F6B43B081B552A15EBCD60D773B14D44786A4B95EE7394494A71091335A5',
      },
    },
    {
      skill: 'special',
      kind: 'image_floor',
      level: 11,
      levelBasis: 'unspecified',
      replaces: ['9+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/77588722',
        author: 'HoYo青枫',
        sourceVersion: '3.1',
        imageSha256: '6DD0F6B43B081B552A15EBCD60D773B14D44786A4B95EE7394494A71091335A5',
      },
    },
  ],
  'agent-yuzuha': [
    {
      skill: 'assist',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      replaces: ['9+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/77505241',
        author: 'Asgater',
        sourceVersion: '3.1',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
  ],
  'agent-starlight-billy': [
    {
      skill: 'dodge',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/75629280',
        author: 'HoYo青枫',
        sourceVersion: '2.8',
        imageSha256: '081B6F343124A6B1136942257E9821FB7C39C18ED427C9EB610BAD82F1EB949B',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/75629280',
        author: 'HoYo青枫',
        sourceVersion: '2.8',
        imageSha256: '081B6F343124A6B1136942257E9821FB7C39C18ED427C9EB610BAD82F1EB949B',
      },
    },
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/75629280',
        author: 'HoYo青枫',
        sourceVersion: '2.8',
        imageSha256: '081B6F343124A6B1136942257E9821FB7C39C18ED427C9EB610BAD82F1EB949B',
      },
    },
    {
      skill: 'basic',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/75633121',
        author: 'Asgater',
        sourceVersion: '2.8',
      },
    },
    {
      skill: 'special',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/75633121',
        author: 'Asgater',
        sourceVersion: '2.8',
      },
    },
    {
      skill: 'chain',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/75633121',
        author: 'Asgater',
        sourceVersion: '2.8',
      },
    },
  ],
  'agent-nangong': [
    {
      skill: 'basic',
      kind: 'image_floor',
      level: 12,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/74132145',
        author: 'HoYo青枫',
        sourceVersion: '2.7',
        imageSha256: '786BC4399A7D6BB3E78C39B0D44CC93DA4C1BA2DD91983BA17163C3E1C9D569D',
      },
    },
    {
      skill: 'dodge',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/74132145',
        author: 'HoYo青枫',
        sourceVersion: '2.7',
        imageSha256: '786BC4399A7D6BB3E78C39B0D44CC93DA4C1BA2DD91983BA17163C3E1C9D569D',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      replaces: ['10+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/78041905',
        author: 'Asgater',
        sourceVersion: '3.2',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'special',
      kind: 'image_floor',
      level: 12,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/74132145',
        author: 'HoYo青枫',
        sourceVersion: '2.7',
        imageSha256: '786BC4399A7D6BB3E78C39B0D44CC93DA4C1BA2DD91983BA17163C3E1C9D569D',
      },
    },
    {
      skill: 'chain',
      kind: 'image_floor',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/74132145',
        author: 'HoYo青枫',
        sourceVersion: '2.7',
        imageSha256: '786BC4399A7D6BB3E78C39B0D44CC93DA4C1BA2DD91983BA17163C3E1C9D569D',
      },
    },
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/74132145',
        author: 'HoYo青枫',
        sourceVersion: '2.7',
        imageSha256: '786BC4399A7D6BB3E78C39B0D44CC93DA4C1BA2DD91983BA17163C3E1C9D569D',
      },
    },
  ],
  'agent-zhao': [
    {
      skill: 'basic',
      kind: 'image_floor',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71895611',
        author: 'HoYo青枫',
        sourceVersion: '2.5',
        imageSha256: '75CBC73CC2941461D1E0986EE3A71E23DD0CB2806FC1C42185CCE14C5D782126',
      },
    },
    {
      skill: 'dodge',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71895611',
        author: 'HoYo青枫',
        sourceVersion: '2.5',
        imageSha256: '75CBC73CC2941461D1E0986EE3A71E23DD0CB2806FC1C42185CCE14C5D782126',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71895611',
        author: 'HoYo青枫',
        sourceVersion: '2.5',
        imageSha256: '75CBC73CC2941461D1E0986EE3A71E23DD0CB2806FC1C42185CCE14C5D782126',
      },
    },
    {
      skill: 'special',
      kind: 'image_floor',
      level: 12,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71895611',
        author: 'HoYo青枫',
        sourceVersion: '2.5',
        imageSha256: '75CBC73CC2941461D1E0986EE3A71E23DD0CB2806FC1C42185CCE14C5D782126',
      },
    },
    {
      skill: 'chain',
      kind: 'image_floor',
      level: 10,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71895611',
        author: 'HoYo青枫',
        sourceVersion: '2.5',
        imageSha256: '75CBC73CC2941461D1E0986EE3A71E23DD0CB2806FC1C42185CCE14C5D782126',
      },
    },
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71895611',
        author: 'HoYo青枫',
        sourceVersion: '2.5',
        imageSha256: '75CBC73CC2941461D1E0986EE3A71E23DD0CB2806FC1C42185CCE14C5D782126',
      },
    },
  ],
  'agent-dialyn': [
    {
      skill: 'basic',
      kind: 'image_floor',
      level: 10,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/70917235',
        author: 'HoYo青枫',
        sourceVersion: '2.4',
        imageSha256: 'A6CD77FDB3031691C591AABE78220BBC4D2D988EEE1C1015C8791325E7AAB758',
      },
    },
    {
      skill: 'dodge',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/70917235',
        author: 'HoYo青枫',
        sourceVersion: '2.4',
        imageSha256: 'A6CD77FDB3031691C591AABE78220BBC4D2D988EEE1C1015C8791325E7AAB758',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      replaces: ['10+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/77534448',
        author: 'Asgater',
        sourceVersion: '3.1',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'special',
      kind: 'image_floor',
      level: 12,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/70917235',
        author: 'HoYo青枫',
        sourceVersion: '2.4',
        imageSha256: 'A6CD77FDB3031691C591AABE78220BBC4D2D988EEE1C1015C8791325E7AAB758',
      },
    },
    {
      skill: 'chain',
      kind: 'image_floor',
      level: 12,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/70917235',
        author: 'HoYo青枫',
        sourceVersion: '2.4',
        imageSha256: 'A6CD77FDB3031691C591AABE78220BBC4D2D988EEE1C1015C8791325E7AAB758',
      },
    },
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/70917235',
        author: 'HoYo青枫',
        sourceVersion: '2.4',
        imageSha256: 'A6CD77FDB3031691C591AABE78220BBC4D2D988EEE1C1015C8791325E7AAB758',
      },
    },
  ],
  'agent-pyrois': [
    {
      skill: 'basic',
      kind: 'image_floor',
      level: 12,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/76053498',
        author: 'HoYo青枫',
        sourceVersion: '3.0',
        imageSha256: '7C28257D988ECDC0E19097D9660EFEDA0A3DCD9632633A7FB6B535D49793EECF',
      },
    },
    {
      skill: 'dodge',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/76053498',
        author: 'HoYo青枫',
        sourceVersion: '3.0',
        imageSha256: '7C28257D988ECDC0E19097D9660EFEDA0A3DCD9632633A7FB6B535D49793EECF',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/76053498',
        author: 'HoYo青枫',
        sourceVersion: '3.0',
        imageSha256: '7C28257D988ECDC0E19097D9660EFEDA0A3DCD9632633A7FB6B535D49793EECF',
      },
    },
    {
      skill: 'special',
      kind: 'image_floor',
      level: 10,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/76053498',
        author: 'HoYo青枫',
        sourceVersion: '3.0',
        imageSha256: '7C28257D988ECDC0E19097D9660EFEDA0A3DCD9632633A7FB6B535D49793EECF',
      },
    },
    {
      skill: 'chain',
      kind: 'image_floor',
      level: 12,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/76053498',
        author: 'HoYo青枫',
        sourceVersion: '3.0',
        imageSha256: '7C28257D988ECDC0E19097D9660EFEDA0A3DCD9632633A7FB6B535D49793EECF',
      },
    },
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/76053498',
        author: 'HoYo青枫',
        sourceVersion: '3.0',
        imageSha256: '7C28257D988ECDC0E19097D9660EFEDA0A3DCD9632633A7FB6B535D49793EECF',
      },
    },
  ],
  'agent-yixuan': [
    {
      skill: 'dodge',
      kind: 'image_floor',
      level: 10,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/73100348',
        author: 'HoYo青枫',
        sourceVersion: '2.6',
        imageSha256: 'C5356EDCD4CB3821B52370D92365ABCFF8D15503B2A8334F9CF65EB8D3BBD82D',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/73100348',
        author: 'HoYo青枫',
        sourceVersion: '2.6',
        imageSha256: 'C5356EDCD4CB3821B52370D92365ABCFF8D15503B2A8334F9CF65EB8D3BBD82D',
      },
    },
  ],
  'agent-sunna': [
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/72986462',
        author: 'HoYo青枫',
        sourceVersion: '2.6',
        imageSha256: '6FBBF02749829F2E51FEEA15B1343DE6E54C03CCBCD4C54BDA26821525AA1793',
      },
    },
  ],
  'agent-velina': [
    {
      skill: 'basic',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/79024163',
        author: 'Asgater',
        sourceVersion: '3.3',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'dodge',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 7,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/79024163',
        author: 'Asgater',
        sourceVersion: '3.3',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/79024163',
        author: 'Asgater',
        sourceVersion: '3.3',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'special',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/79024163',
        author: 'Asgater',
        sourceVersion: '3.3',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'chain',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/79024163',
        author: 'Asgater',
        sourceVersion: '3.3',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/76052835',
        author: 'HoYo青枫',
        sourceVersion: '3.0',
        imageSha256: '247AD6866C4931C3959369FE40BD87D2008CF7353AB5D7417DA56A6816C56CC4',
      },
    },
  ],
  'agent-promeia': [
    {
      skill: 'basic',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/78510123',
        author: 'Asgater',
        sourceVersion: '3.2',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'dodge',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 9,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/78510123',
        author: 'Asgater',
        sourceVersion: '3.2',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'assist',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 9,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/78510123',
        author: 'Asgater',
        sourceVersion: '3.2',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'special',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/78510123',
        author: 'Asgater',
        sourceVersion: '3.2',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'chain',
      kind: 'image_floor',
      levelBasis: 'unspecified',
      level: 11,
      source: {
        url: 'https://www.miyoushe.com/zzz/article/78510123',
        author: 'Asgater',
        sourceVersion: '3.2',
        evidenceFile:
          "soda-source-ref:db2f706ef0525f326c1dcfb4f44e3db0",
        hashKind: 'sha256_file',
        evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      },
    },
    {
      skill: 'core',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/75164124',
        author: 'HoYo青枫',
        sourceVersion: '2.8',
        imageSha256: '656B6EC58BB0169FE25F710F12A65BDE813DDACE3A3B73411358D219C7D0C3CE',
      },
    },
  ],
  'agent-seed': [
    {
      skill: 'basic',
      kind: 'paid_maximum',
      replaces: ['12'],
      source: {
        url: 'https://news.17173.com/content/09052025/000602236.shtml',
        author: '绳匠小助手',
        sourceVersion: '2.2',
      },
    },
  ],
  'agent-astra': [
    {
      skill: 'special',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.miyoushe.com/zzz/article/61285006',
        author: 'HoYo青枫',
        sourceVersion: '1.5',
      },
    },
  ],
  'agent-ye-shunguang': [
    {
      skill: 'basic',
      kind: 'paid_maximum',
      replaces: ['11+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71890615',
        author: 'Asgater',
        sourceVersion: '2.5',
      },
    },
    {
      skill: 'special',
      kind: 'paid_maximum',
      replaces: ['11+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71890615',
        author: 'Asgater',
        sourceVersion: '2.5',
      },
    },
    {
      skill: 'chain',
      kind: 'paid_maximum',
      replaces: ['11+'],
      source: {
        url: 'https://www.miyoushe.com/zzz/article/71890615',
        author: 'Asgater',
        sourceVersion: '2.5',
      },
    },
  ],
  'agent-billy': [
    {
      skill: 'basic',
      kind: 'paid_maximum',
      source: {
        url: 'https://www.icy-veins.com/zenless-zone-zero/billy-kid-guide-best-builds',
        author: 'Lily',
        sourceVersion: null,
      },
    },
  ],
}

export function getReviewedDevelopmentSkillTargetSupplements33(
  agentId: string,
  targetVersion: string,
): readonly ReviewedDevelopmentSkillTargetSupplement[] {
  return targetVersion === developmentSkillOrderReview33.evaluatedForVersion
    ? (reviewedDevelopmentSkillTargetSupplements33[agentId] ?? [])
    : []
}
