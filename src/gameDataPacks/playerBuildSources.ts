import { stableContentHash } from './types'

export const playerBuildFieldStatuses = ['formal', 'candidate', 'missing'] as const
export type PlayerBuildFieldStatus = (typeof playerBuildFieldStatuses)[number]

export type PlayerBuildSource = {
  id: string
  url: string
  sourceVersion: string | null
  originalSourceVersion?: string | null
  checkedAt: string
  contentHash: string
  licenseBoundary: string
  /** A locator is useful for a missing-field follow-up, but is not evidence until the page was checked. */
  verified: boolean
  authorReviewedVersion?: string | null
  retrievedAt?: string | null
  pageUpdatedAt?: string | null
}

export type PlayerBuildField = {
  path: string
  status: PlayerBuildFieldStatus
  value: unknown | null
  source: PlayerBuildSource | null
  reason: string
  /** Field-local provenance for unions; the original source only supports its original values. */
  sourceValues?: string[]
  supplementalSources?: Array<{
    source: PlayerBuildSource
    values: string[]
    conditionsByValue?: Record<string, string[]>
  }>
  authorReviewedVersion?: string | null
  originalSourceVersion?: string | null
  applicabilityReason?: string
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
  originalSourceVersion: '3.0',
  authorReviewedVersion: null,
  checkedAt,
  contentHash: stableContentHash({
    url: 'https://zenless.hoyoverse.com/zh-cn/character',
    version: '3.0',
  }),
  licenseBoundary: '仅用于已核验的目录身份与分类事实。',
  verified: true,
}

/**
 * Wiki page edit timestamps are page-retrieval facts, not author reviewed build versions for 3.2.
 * Unreviewed pages do not invent current review versions.
 */
export const bwikiPageEvidence: Record<
  string,
  {
    updatedAt: string
    lv60: { hp: number; atk: number; def: number } | null
    authorReviewedVersion?: string | null
  }
> = {
  'agent-ellen': {
    updatedAt: '2026-02-09T00:00:00.000Z',
    lv60: { hp: 7673, atk: 863, def: 606 },
    authorReviewedVersion: null,
  },
  'agent-billy': {
    updatedAt: '2026-06-15T00:00:00.000Z',
    lv60: { hp: 6907, atk: 712, def: 606 },
    authorReviewedVersion: null,
  },
  'agent-velina': {
    updatedAt: '2026-07-08T00:00:00.000Z',
    lv60: null,
    authorReviewedVersion: null,
  },
  'agent-norma': {
    updatedAt: '2026-07-08T00:00:00.000Z',
    lv60: null,
    authorReviewedVersion: null,
  },
}
