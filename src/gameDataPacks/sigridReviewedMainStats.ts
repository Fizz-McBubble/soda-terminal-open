import type { StatKey } from '../domain/schemas'
import { source } from './gameData31CatalogSources'
import { stableContentHash } from './types'

// Minimal derived fields reviewed on 2026-09-19; hashes identify this extraction,
// not the entire live pages. Source preferences are not a universal damage ranking.
const prydwenFields = {
  locator: 'Build > Best Disk Drives Stats > Disk 4 / Disk 5 / Disk 6',
  mainStats: { '4': ['crit_dmg', 'atk_percent'], '5': ['pen_ratio'], '6': ['atk_percent'] },
  preference: 'Disk 4: critical damage preferred to attack percentage',
}
const icyVeinsFields = {
  locator: "Sigrid's Stat Priority > Disc 4 / Disc 5 / Disc 6",
  mainStats: { '4': ['crit_dmg'], '5': ['ice_dmg'], '6': ['atk_percent'] },
}

export const sigridReviewedMainStatSources = [
  source(
    'prydwen-sigrid-main-stats-reviewed-2026-09-19',
    'https://www.prydwen.gg/zenless/characters/sigrid',
    stableContentHash(prydwenFields),
    `仅保存候选词条最小派生；${prydwenFields.locator}。页面构筑版本3.1，2026-09-09更新；4号暴伤优先，攻击百分比备选；5号穿透率；6号攻击百分比。派生字段哈希，不冒充整页哈希或正式最优。`,
    '2026-09-19T00:00:00.000Z',
  ),
  source(
    'icy-veins-sigrid-main-stats-reviewed-2026-09-19',
    'https://www.icy-veins.com/zenless-zone-zero/sigrid-guide-best-builds',
    stableContentHash(icyVeinsFields),
    `仅保存候选词条最小派生；${icyVeinsFields.locator}。页面2026-08-17实装更新；4号暴伤；5号冰伤；6号攻击百分比。保留5号作者差异，不声称任一选项通用最优。`,
    '2026-09-19T00:00:00.000Z',
  ),
]

export const sigridReviewedMainStats: Partial<Record<'4' | '5' | '6', StatKey[]>> = {
  '4': ['crit_dmg', 'atk_percent'],
  '5': ['pen_ratio', 'ice_dmg'],
  '6': ['atk_percent'],
}
