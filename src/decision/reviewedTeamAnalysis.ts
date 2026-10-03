import { z } from 'zod'
import dataset from '../gameDataPacks/data/reviewed-team-analysis.3.1.json'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'

const evidenceSchema = z
  .object({
    url: z.url(),
    locator: z.string().min(1),
    sourceVersion: z.string().min(1),
  })
  .strict()
const recordSchema = z
  .object({
    id: z.string().min(1),
    memberIds: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    band: z.enum(['A+', 'A', 'B']),
    rationale: z.string().min(1),
    conditions: z.array(z.string().min(1)).min(1),
    limitations: z.array(z.string().min(1)).min(1),
    evidenceRefs: z.array(evidenceSchema).min(1),
    withdrawn: z.boolean().optional(),
  })
  .strict()
const datasetSchema = z
  .object({
    schema: z.literal('soda-reviewed-team-analysis/v1'),
    gameVersion: z.string().min(1),
    reviewedAt: z.iso.date(),
    authority: z.literal('local_editorial_estimate'),
    confidence: z.literal('low'),
    validationStatus: z.literal('not_independently_fitted'),
    methodology: z.string().min(1),
    records: z.array(recordSchema),
  })
  .strict()

export type ReviewedTeamAnalysis = Pick<
  z.infer<typeof recordSchema>,
  'band' | 'rationale' | 'conditions' | 'limitations' | 'evidenceRefs'
> & { confidence: 'low' }

function exactKey(memberIds: readonly string[]) {
  return memberIds.map(resolveCurrentReleasedIdentity).sort().join('|')
}

/** Reviewed judgements are versioned data, not a formula inferred from source frequency,
 * individual tiers, observation percentiles, or a shared two-agent core. */
export function createReviewedTeamAnalysisCatalog(input: unknown, currentVersion: string) {
  const parsed = datasetSchema.parse(input)
  const records = new Map<string, z.infer<typeof recordSchema>>()
  const ids = new Set<string>()
  for (const record of parsed.records) {
    const key = exactKey(record.memberIds)
    if (new Set(key.split('|')).size !== 3)
      throw new Error(`Analysis requires three distinct agents: ${record.id}`)
    if (ids.has(record.id) || records.has(key))
      throw new Error(`Duplicate team analysis: ${record.id}`)
    ids.add(record.id)
    records.set(key, record)
  }
  return {
    dataset: parsed,
    resolve(memberIds: readonly string[]): ReviewedTeamAnalysis | null {
      if (parsed.gameVersion !== currentVersion || memberIds.length !== 3) return null
      const record = records.get(exactKey(memberIds))
      if (!record || record.withdrawn) return null
      return {
        band: record.band,
        confidence: 'low',
        rationale: record.rationale,
        conditions: [...record.conditions],
        limitations: [...record.limitations],
        evidenceRefs: record.evidenceRefs.map((ref) => ({ ...ref })),
      }
    },
  }
}

const catalog = createReviewedTeamAnalysisCatalog(dataset, currentVersionProjection.gameVersion)
export const reviewedTeamAnalysis = Object.freeze({
  ...catalog.dataset,
  contentHash: stableContentHash(dataset),
})
const sourceVersionCatalog = createReviewedTeamAnalysisCatalog(dataset, dataset.gameVersion)
export function resolveReviewedTeamAnalysis(
  memberIds: readonly string[],
  reviewVersion: string = currentVersionProjection.gameVersion,
) {
  // The imported package keeps its own review version even when the available
  // agent directory grows. Another requested version cannot reuse this review.
  return reviewVersion === dataset.gameVersion ? sourceVersionCatalog.resolve(memberIds) : null
}
