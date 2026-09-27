import { stableContentHash } from './types'

export const playerBuildFieldStatuses = ['formal', 'candidate', 'missing'] as const
export type PlayerBuildFieldStatus = (typeof playerBuildFieldStatuses)[number]

export type PlayerBuildSource = {
  id: string
  url: string
  sourceVersion: string | null
  checkedAt: string
  contentHash: string
  licenseBoundary: string
  /** A locator is useful for a missing-field follow-up, but is not evidence until the page was checked. */
  verified: boolean
}

export type PlayerBuildField = {
  path: string
  status: PlayerBuildFieldStatus
  value: unknown | null
  source: PlayerBuildSource | null
  reason: string
}

export type PlayerBuildProfile = {
  agentId: string
  agentName: string
  gameVersion: '3.0'
  profileVersion: string
  fields: PlayerBuildField[]
  contentHash: string
}

export const checkedAt = '2026-07-27T00:00:00.000Z'
export const officialCatalogSource: PlayerBuildSource = {
  id: 'official-3.0-catalog',
  url: 'https://zenless.hoyoverse.com/zh-cn/character?catchSpider=1',
  sourceVersion: '3.0',
  checkedAt,
  contentHash: stableContentHash({
    url: 'https://zenless.hoyoverse.com/zh-cn/character',
    version: '3.0',
  }),
  licenseBoundary: '仅用于已核验的目录身份与分类事实。',
  verified: true,
}

export const bwikiPageEvidence: Record<
  string,
  { updatedAt: string; lv60: { hp: number; atk: number; def: number } | null }
> = {
  'agent-ellen': { updatedAt: '2026-02-09T00:00:00.000Z', lv60: { hp: 7673, atk: 863, def: 606 } },
  'agent-billy': { updatedAt: '2026-06-15T00:00:00.000Z', lv60: { hp: 6907, atk: 712, def: 606 } },
  'agent-velina': { updatedAt: '2026-07-08T00:00:00.000Z', lv60: null },
  'agent-norma': { updatedAt: '2026-07-08T00:00:00.000Z', lv60: null },
}
