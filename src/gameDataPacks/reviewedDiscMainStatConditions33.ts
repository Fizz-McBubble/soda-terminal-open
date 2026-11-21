import type { ReviewedMainStatAlternative } from './reviewedMainStatAlternatives'
import type { PlayerBuildSource } from './playerBuildSources'
import { gameData33BuildSources } from './gameData33BuildGuidance'
import { getReviewedMainStatAdditionSource } from './reviewedMainStatAdditions'
import { sigridReviewedMainStatSources } from './sigridReviewedMainStats'
import { stableContentHash } from './types'

/** Field-level evidence, not a site vote or a claim that every choice is optimal. */
const observations = {
  dialynImpact: {
    url: 'https://www.miyoushe.com/zzz/article/77534448',
    sourceVersion: '3.1',
    pagePublishedAt: '08-17',
    pageUpdatedAt: null,
    locator: 'Asgater 一图流驱动盘主词条；5-latest-posts/posts-and-deltas.json，浏览器目视记录',
    fact: '6号位：能量自动回复或冲击力；原图未列额外选用条件。',
  },
  phoenixPen: {
    url: 'https://www.prydwen.gg/zenless/characters/phoenix',
    sourceVersion: null,
    pagePublishedAt: null,
    pageUpdatedAt: null,
    locator:
      'Best Disk Drive Stats / Disk 5；归档prydwen-details-04.txt L599，文件SHA256 8d111bf3fd8c5f37cc1d20e6c02173b894ccf7bcfcf2c0a41f714bbefee72a8c',
    fact: 'Disk 5: Fire DMG% > PEN Ratio% > ATK%；来源未给出穿透率选用门槛。',
  },
  claret: {
    url: 'https://earlygg.com/news/claret-best-build-in-zzz-guide',
    sourceVersion: '3.2',
    pagePublishedAt: '2026-09-09',
    pageUpdatedAt: null,
    locator: 'Best Drive Discs: Disc 4; DEF only with sufficient CRIT from substats',
    fact: 'Disc 4: CRIT Rate first; DEF is a conditional alternative with sufficient CRIT.',
  },
  anton: {
    url: 'https://mobalytics.gg/zzz/builds/anton',
    sourceVersion: null,
    pagePublishedAt: null,
    pageUpdatedAt: '2026-08-07',
    locator: 'Drive Disc Stats / Partition 5; Drive Discs & Stats / Nicole condition',
    fact: 'Partition 5: ATK% / Electric DMG% / PEN Ratio; avoid PEN Ratio with Nicole.',
  },
  lucy: {
    url: 'https://mobalytics.gg/zzz/builds/lucy',
    sourceVersion: null,
    pagePublishedAt: null,
    pageUpdatedAt: '2026-08-07',
    locator: 'Drive Disc Stats / Partition 5; Stats / Cheer On cap before personal damage',
    fact: 'Partition 5: ATK% / Fire DMG / PEN Ratio; meet the skill-level-dependent ATK buff cap first.',
  },
  panYinhu: {
    url: 'https://www.miyoushe.com/zzz/article/65025747',
    sourceVersion: '2.0',
    pagePublishedAt: '2025-06-06',
    pageUpdatedAt: '2026-05-27',
    locator: 'Asgater / 仪潘队 / 关于潘引壶 / 4、5号攻击，6号回能',
    fact: '4/5号优选攻击盘，6号优先回能盘优化循环；F级核心攻击力需求3000。',
  },
} as const

function source(key: keyof typeof observations): PlayerBuildSource {
  const observation = observations[key]
  return {
    id: `reviewed-disc-main-stat-${key}-20261102`,
    url: observation.url,
    sourceVersion: observation.sourceVersion,
    checkedAt: '2026-11-02',
    ...(observation.pageUpdatedAt ? { pageUpdatedAt: observation.pageUpdatedAt } : {}),
    contentHash: stableContentHash(observation),
    verified: true,
    licenseBoundary: `最小字段事实；${observation.locator}；发布${observation.pagePublishedAt ?? '未标注'}，更新${observation.pageUpdatedAt ?? '未标注'}，${key === 'phoenixPen' ? '归档采集日期未标注，本地复核2026-11-02' : '采集2026-11-02'}。哈希标识采用事实，不冒充原始网页哈希。原版本与本地3.3评估分开，不继承全局最优、强度或使用率结论。`,
  }
}

export function getReviewedDiscMainStatConditions33(
  agentId: string,
): ReviewedMainStatAlternative[] {
  const conditions: Record<string, Omit<ReviewedMainStatAlternative, 'automaticEligibility'>[]> = {
    'agent-dialyn': [
      {
        slot: '6',
        stats: ['impact'],
        purpose: 'secondary',
        condition: '6号可在能量自动回复和冲击力之间，按循环与整套词条选择。',
        source: source('dialynImpact'),
      },
    ],
    'agent-phoenix': [
      {
        slot: '5',
        stats: ['pen_ratio'],
        purpose: 'secondary',
        condition: '5号也可选穿透率；结合队伍增益和整套副词条，与火伤、攻击盘比较。',
        source: source('phoenixPen'),
      },
      {
        slot: '6',
        stats: ['atk_percent'],
        purpose: 'secondary',
        condition:
          '6号优先异常掌控。改用攻击盘前，需确认换盘后的初始异常掌控仍满足灼蚀暴击条件；瞬时增益不计入初始值。',
        source: gameData33BuildSources.phoenixInGame33,
      },
    ],
    'agent-claret': [
      {
        slot: '4',
        stats: ['def_percent'],
        purpose: 'secondary',
        condition:
          '4号优先暴击率。已有充足暴击率副词条时，防御盘可作条件备选；保留超过100%暴击率的锐暴收益。',
        source: source('claret'),
      },
    ],
    'agent-sigrid': [
      {
        slot: '5',
        stats: ['ice_dmg'],
        purpose: 'secondary',
        condition: '冰伤与穿透率均有明确推荐；按整套副词条、音擎和队伍增益取舍。',
        source: sigridReviewedMainStatSources[1]!,
      },
    ],
    'agent-orphie-magus': [
      {
        slot: '5',
        stats: ['pen_ratio'],
        purpose: 'secondary',
        condition:
          '火伤、攻击和穿透率按副词条取舍；队内攻击增益较多时可考虑火伤，已有较多增伤时可考虑攻击或穿透。',
        source: getReviewedMainStatAdditionSource('agent-orphie-magus')!,
      },
    ],
    'agent-caesar': [
      {
        slot: '4',
        stats: ['crit_dmg'],
        purpose: 'personal_damage',
        condition:
          '直伤方向按双暴比例选暴击率或暴击伤害；物理异常方向选异常精通。6号位仍选冲击力。',
        source: getReviewedMainStatAdditionSource('agent-caesar')!,
      },
    ],
    'agent-pan-yinhu': [
      {
        slot: '6',
        stats: ['energy_regen'],
        purpose: 'secondary',
        condition:
          '回能盘用于维持强化特殊技循环；4、5号和副词条补攻击，按实际核心技等级满足贯穿力增益需求。',
        source: source('panYinhu'),
      },
    ],
    'agent-anby': [
      {
        slot: '5',
        stats: ['pen_ratio'],
        purpose: 'secondary',
        condition: '电伤、攻击和穿透率均可选；按整套副词条和队伍增益取舍。',
        source: getReviewedMainStatAdditionSource('agent-anby')!,
      },
    ],
    'agent-anton': [
      {
        slot: '5',
        stats: ['atk_percent', 'pen_ratio'],
        purpose: 'secondary',
        condition:
          '攻击、电伤和穿透率均可选；与妮可同队时优先考虑攻击或电伤，避免直接套用穿透方向。',
        source: source('anton'),
      },
    ],
    'agent-lucy': [
      {
        slot: '5',
        stats: ['fire_dmg'],
        purpose: 'personal_damage',
        condition: '先按特殊技等级满足「加油！」攻击增益需求，再考虑火伤盘提升自身输出。',
        source: source('lucy'),
      },
    ],
  }
  return (conditions[agentId] ?? []).map((entry) => ({ ...entry, automaticEligibility: false }))
}
