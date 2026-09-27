import { z } from 'zod'
import dataset from '../gameDataPacks/data/reviewed-team-strength.v1.json'
import {
  currentReleasedIdentityMap,
  resolveCurrentReleasedIdentity,
} from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import { createTeamStrengthEvidenceIndex, type TeamStrengthFact } from './teamStrengthEvidence'

const band = z.enum(['S', 'A+', 'A', 'B'])
const sourceSchema = z
  .object({
    id: z.string().min(1),
    publisher: z.string().min(1),
    url: z.url(),
    sourceVersion: z.string().min(1),
    capturedAt: z.string().min(1),
    checkedAt: z.string().min(1),
    tierMapping: z.record(z.string(), band),
    boundary: z.string(),
  })
  .strict()
const datasetSchema = z
  .object({
    schema: z.literal('soda-reviewed-team-strength/v1'),
    sourceVersion: z.string().min(1),
    sources: z.array(sourceSchema),
    boundary: z.string(),
    records: z.array(
      z
        .object({
          claimId: z.string().min(1),
          sourceId: z.string().min(1),
          memberIds: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
          publisherTier: z.string().min(1),
          locator: z.string().min(1),
          withdrawn: z.boolean().optional(),
        })
        .strict(),
    ),
  })
  .strict()

/** New teams and versions update reviewed data; the selection rules stay unchanged. */
export function createPublishedTeamStrengthCatalog(input: unknown, currentVersion: string) {
  const parsed = datasetSchema.parse(input)
  const sources = new Map(parsed.sources.map((source) => [source.id, source]))
  if (sources.size !== parsed.sources.length)
    throw new Error('Duplicate team-strength source identity')
  if (parsed.sources.some((source) => source.sourceVersion !== parsed.sourceVersion))
    throw new Error('Team-strength source and dataset versions must agree')
  const facts: TeamStrengthFact[] = parsed.records.map((record) => {
    const source = sources.get(record.sourceId)
    const mappedBand = source?.tierMapping[record.publisherTier]
    if (!source || !mappedBand) throw new Error(`Missing reviewed tier mapping: ${record.claimId}`)
    const memberIds = record.memberIds.map(resolveCurrentReleasedIdentity) as [
      string,
      string,
      string,
    ]
    if (new Set(memberIds).size !== 3)
      throw new Error(`Team-strength evidence requires three distinct agents: ${record.claimId}`)
    return {
      claimId: record.claimId,
      memberIds,
      sourceVersion: source.sourceVersion,
      publisher: source.publisher,
      sourceUrl: source.url,
      sourceTier: record.publisherTier,
      band: mappedBand,
      authority: 'published_tier',
      checkedAt: source.checkedAt,
      locator: record.locator,
      ...(record.withdrawn === undefined ? {} : { withdrawn: record.withdrawn }),
    }
  })
  return { facts, index: createTeamStrengthEvidenceIndex(facts, currentVersion) }
}

const catalog = createPublishedTeamStrengthCatalog(dataset, currentReleasedIdentityMap.gameVersion)
export const reviewedTeamPublishedStrength = Object.freeze({
  ...dataset,
  grain: 'exact_3_agent',
  assessment: 'single_publisher_tier',
  confidence: 'low',
  facts: catalog.facts,
  rows: catalog.facts.map((fact) => [fact.sourceTier, fact.memberIds, fact.locator] as const),
  contentHash: stableContentHash(dataset),
})

export function resolveReviewedTeamPublishedStrength(memberIds: readonly [string, string, string]) {
  const result = catalog.index.resolve(memberIds)
  return {
    status: result.status,
    band: result.band,
    evidenceRefs: [...new Set(result.selectedFacts.map((fact) => fact.sourceUrl))],
    explanation:
      result.status === 'conflict'
        ? '同级来源对这支三人队的档位有分歧，暂不定档。'
        : result.status === 'unknown'
          ? '当前版本缺少有效的整队评级来源。'
          : `${result.selectedFacts.map((fact) => `${fact.publisher} ${fact.sourceVersion}：${fact.sourceTier}`).join('；')}，对应本工具 ${result.band} 档；参考评级，仍需更多独立对照。`,
  }
}
