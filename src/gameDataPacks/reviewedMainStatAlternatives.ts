import type { StatKey } from '../domain/schemas'
import type { PlayerBuildSource } from './playerBuildSources'
import { stableContentHash } from './types'

/** Reviewed choices for a different purpose, not unconditional solver eligibility. */
export type ReviewedMainStatAlternative = {
  slot: '4' | '5' | '6'
  stats: readonly StatKey[]
  purpose: 'transition' | 'personal_damage' | 'anomaly_support' | 'short_fight' | 'secondary'
  condition: string
  automaticEligibility: false
  source: PlayerBuildSource
}

type Entry = Omit<ReviewedMainStatAlternative, 'source' | 'automaticEligibility'> & {
  agentId: string
  url: string
  sourceVersion: string | null
  locator: string
  sourceDate: string
}

const entries: readonly Entry[] = [
  {
    agentId: 'agent-koleda',
    slot: '4',
    stats: ['atk_percent'],
    purpose: 'transition',
    condition: '前期缺少合适双暴盘时，可用攻击力盘过渡；不作为毕业首选。',
    url: 'https://www.taptap.cn/moment/559350231276193617',
    sourceVersion: '1.0',
    sourceDate: '2024-07-08',
    locator: '檬涩味；两套驱动盘方案的4号位；攻击仅限前期过渡',
  },
  {
    agentId: 'agent-ben',
    slot: '4',
    stats: ['crit_rate'],
    purpose: 'personal_damage',
    condition: '以本的自身输出为目标时可选暴击率；以护盾为主时仍优先防御力。',
    url: 'https://mobalytics.gg/zzz/builds/ben',
    sourceVersion: null,
    sourceDate: '2026-08-07',
    locator: 'Drive Disc Stats / Partition 4；Drive Discs & Stats区分护盾与DPS',
  },
  {
    agentId: 'agent-soukaku',
    slot: '4',
    stats: ['crit_rate', 'crit_dmg'],
    purpose: 'personal_damage',
    condition:
      '摇摆爵士4件＋激素朋克2件的支援构筑可兼顾双暴；先保证展旗的攻击增益，攻击目标随核心技等级变化。',
    url: 'https://zenless.gg/soukaku-guide/',
    sourceVersion: '1.0',
    sourceDate: '2024-07-13',
    locator: 'Dkmariolink / Option 2 / Main Stats IV；兼顾自身伤害与攻击增益',
  },
  {
    agentId: 'agent-soukaku',
    slot: '4',
    stats: ['anomaly_proficiency'],
    purpose: 'anomaly_support',
    condition:
      '自由蓝调的异常支援方向可选异常精通；仍需兼顾展旗的攻击增益。精通提高异常伤害，不提高积蓄速度。',
    url: 'https://www.icy-veins.com/zenless-zone-zero/soukaku-guide-best-builds',
    sourceVersion: '2.4',
    sourceDate: '2025-11-25',
    locator: 'Shikhu / Best Drive Discs / Stat Priority / Disc 4；攻击增益优先',
  },
  {
    agentId: 'agent-soukaku',
    slot: '5',
    stats: ['pen_ratio'],
    purpose: 'secondary',
    condition: '穿透率是随队伍考虑的备选，仍需兼顾展旗的攻击增益；不保证优于冰伤或攻击力。',
    url: 'https://www.icy-veins.com/zenless-zone-zero/soukaku-guide-best-builds',
    sourceVersion: '2.4',
    sourceDate: '2025-11-25',
    locator: 'Shikhu / Stat Priority / Disc 5；PEN按合法5号主词条归一化为穿透率',
  },
  {
    agentId: 'agent-seth',
    slot: '6',
    stats: ['impact'],
    purpose: 'short_fight',
    condition: '短时间结束战斗、需要协助快速失衡时可选冲击力；常规循环优先能量回复。',
    url: 'https://news.17173.com/content/09062024/191241236.shtml',
    sourceVersion: null,
    sourceDate: '2024-09-06',
    locator: '绝区零工坊署名正文，17173刊载、来源公众号；主词条6号位',
  },
  {
    agentId: 'agent-trigger',
    slot: '5',
    stats: ['pen_ratio'],
    purpose: 'secondary',
    condition: '电属性伤害优先；副词条好的穿透率盘可作次选，需结合整套配装比较。',
    url: 'https://news.17173.com/content/04032025/162101810.shtml',
    sourceVersion: null,
    sourceDate: '2025-04-03',
    locator: '绝区零工坊署名正文，17173刊载、来源公众号；主词条5号位',
  },
]

const alternatives = entries.map(
  (entry): ReviewedMainStatAlternative => ({
    slot: entry.slot,
    stats: entry.stats,
    purpose: entry.purpose,
    condition: entry.condition,
    automaticEligibility: false,
    source: {
      id: `reviewed-main-stat-alternative-${entry.agentId}-${entry.slot}-${entry.purpose}`,
      url: entry.url,
      sourceVersion: entry.sourceVersion,
      checkedAt: '2026-09-19T00:00:00.000Z',
      contentHash: stableContentHash(entry),
      verified: true,
      licenseBoundary: `字段复核：${entry.locator}；来源日期${entry.sourceDate}。hash为采用字段摘要，非网页文件hash。保留作者原版本；只提供带用途的备选，不推断未知构筑意图、固定攻击门槛、实战最优或自动配装资格。`,
    },
  }),
)

export function getReviewedMainStatAlternatives(agentId: string): ReviewedMainStatAlternative[] {
  return entries.flatMap((entry, index) =>
    entry.agentId === agentId ? [alternatives[index]!] : [],
  )
}
