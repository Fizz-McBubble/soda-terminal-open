import { describe, expect, it } from 'vitest'
import {
  getReviewedAgentMenuBaseStats,
  getReviewedWEngineMenuBaseStat,
} from './reviewedMenuBaseStats'

describe('reviewed official menu base stats', () => {
  it('returns Aria published white stats before core growth with the exact official locator', () => {
    const result = getReviewedAgentMenuBaseStats('agent-aria', 60, 5)
    expect(result?.values).toEqual({ hp: 7749, atk: 788, def: 619 })
    expect(result?.source).toMatchObject({
      kind: 'official_published_menu_base',
      entryId: '1793',
      entryVersion: '1789311748',
      locator:
        'data.page.modules[8].components[0].data(JSON).list[0].children[0].growth[7].children[0].row[0][0]',
    })
    expect(result?.source.apiUrl).toContain('entry_page_id=1793')
  })

  it('returns Flight of Fancy published ATK base independently of its secondary or passive', () => {
    const result = getReviewedWEngineMenuBaseStat('wengine-14133', 60, 5)
    expect(result?.baseStat).toEqual({ key: 'atk', value: 713 })
    expect(result?.source).toMatchObject({
      kind: 'official_published_menu_base',
      entryId: '1277',
      entryVersion: '1762315236',
      locator: 'data.page.modules[4].components[0].data(JSON).tables[0].row[0][0]',
    })
    expect(result?.source.apiUrl).toContain('entry_page_id=1277')
  })

  it.each([
    ['agent-billy', 60, 5],
    ['agent-unknown', 60, 5],
    ['agent-aria', 59, 5],
    ['agent-aria', 60, 4],
  ])('does not infer character %s at level %s / ascension %s', (id, level, ascension) => {
    expect(getReviewedAgentMenuBaseStats(id as string, level as number, ascension as number)).toBe(
      undefined,
    )
  })

  it.each([
    ['wengine-14150', 60, 5],
    ['wengine-unknown', 60, 5],
    ['wengine-14133', 59, 5],
    ['wengine-14133', 60, 4],
  ])('does not infer W-Engine %s at level %s / ascension %s', (id, level, ascension) => {
    expect(getReviewedWEngineMenuBaseStat(id as string, level as number, ascension as number)).toBe(
      undefined,
    )
  })
})
