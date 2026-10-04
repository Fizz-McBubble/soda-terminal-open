/**
 * Officially published integer white stats for the reviewed menu contexts.
 * These are source values, not rounded final panels or a general growth rule.
 * Unreviewed IDs, levels and ascensions must retain their existing source path.
 */
export type ReviewedMenuBaseSource = Readonly<{
  kind: 'official_published_menu_base'
  pageUrl: string
  apiUrl: string
  entryId: string
  entryVersion: string
  locator: string
  originalText: string
  verifiedOn: '2026-10-04'
}>

const apiBase = 'https://act-api-takumi-static.mihoyo.com/hoyowiki/zzz/wapi/entry_page'

const aria = {
  agentId: 'agent-aria',
  level: 60,
  ascension: 5,
  values: { hp: 7749, atk: 788, def: 619 },
  source: {
    kind: 'official_published_menu_base',
    pageUrl:
      'https://baike.mihoyo.com/zzz/wiki/content/1793/detail?mhy_presentation_style=fullscreen',
    apiUrl: `${apiBase}?app_sn=zzz_wiki&entry_page_id=1793&lang=zh-cn`,
    entryId: '1793',
    entryVersion: '1789311748',
    locator:
      'data.page.modules[8].components[0].data(JSON).list[0].children[0].growth[7].children[0].row[0][0]',
    originalText: '生命值：7749 攻击力：788 防御力：619',
    verifiedOn: '2026-10-04',
  } satisfies ReviewedMenuBaseSource,
} as const

const flightOfFancy = {
  wEngineId: 'wengine-14133',
  level: 60,
  ascension: 5,
  baseStat: { key: 'atk', value: 713 },
  source: {
    kind: 'official_published_menu_base',
    pageUrl:
      'https://baike.mihoyo.com/zzz/wiki/content/1277/detail?mhy_presentation_style=fullscreen',
    apiUrl: `${apiBase}?app_sn=zzz_wiki&entry_page_id=1277&lang=zh-cn`,
    entryId: '1277',
    entryVersion: '1762315236',
    locator: 'data.page.modules[4].components[0].data(JSON).tables[0].row[0][0]',
    originalText: '满级面板：基础攻击力+713 异常精通+90',
    verifiedOn: '2026-10-04',
  } satisfies ReviewedMenuBaseSource,
} as const

/** Exact adopted values and source revisions participate in saved-result invalidation. */
export const reviewedMenuBaseStatsIdentity = { aria, flightOfFancy } as const

/** Published character base before core growth and equipment contributions. */
export function getReviewedAgentMenuBaseStats(agentId: string, level: number, ascension: number) {
  return agentId === aria.agentId && level === aria.level && ascension === aria.ascension
    ? aria
    : undefined
}

/** Published W-Engine base before static percentages; passive effects are separate. */
export function getReviewedWEngineMenuBaseStat(
  wEngineId: string,
  level: number,
  ascension: number,
) {
  return wEngineId === flightOfFancy.wEngineId &&
    level === flightOfFancy.level &&
    ascension === flightOfFancy.ascension
    ? flightOfFancy
    : undefined
}
