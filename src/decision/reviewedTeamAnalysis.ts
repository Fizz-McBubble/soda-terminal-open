import { z } from 'zod'
import dataset from '../gameDataPacks/data/reviewed-team-analysis.3.1.json'
import currentDataset32 from '../gameDataPacks/data/reviewed-team-analysis.3.2.json'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { currentVersionAdoption32 } from '../gameDataPacks/currentVersionAdoption32'
import {
  resolveReviewedLocalTeamApplicability33,
  reviewedVersionApplicability33,
} from '../gameDataPacks/reviewedVersionApplicability33'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { inspectCurrent31FormationMechanicState } from '../teamEngine/current31FormationMechanicAudit'
import type { ReviewedTeamSourceDirection } from '../gameDataPacks/reviewedTeamSourceDirections'

const evidenceSchema = z
  .object({
    url: z.url(),
    locator: z.string().min(1),
    sourceVersion: z.string().min(1),
    sourceContentHash: z.string().min(1).optional(),
  })
  .strict()
const recordSchema = z
  .object({
    id: z.string().min(1),
    memberIds: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    band: z.enum(['S', 'A+', 'A', 'B']),
    rationale: z.string().min(1),
    conditions: z.array(z.string().min(1)).min(1),
    limitations: z.array(z.string().min(1)).min(1),
    evidenceRefs: z.array(evidenceSchema).min(1),
    mechanicReview: z
      .object({
        basis: z.literal('formed_generic'),
        agents: z
          .array(
            z
              .object({
                agentId: z.string().min(1),
                formulaSha256: z.string().regex(/^[a-f\d]{64}$/i),
              })
              .strict(),
          )
          .length(3),
      })
      .strict()
      .optional(),
    preferredOver: z
      .array(
        z
          .object({
            memberIds: z.tuple([z.string(), z.string(), z.string()]),
            rationale: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
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
  | 'band'
  | 'rationale'
  | 'conditions'
  | 'limitations'
  | 'evidenceRefs'
  | 'mechanicReview'
  | 'preferredOver'
> & {
  confidence: 'low'
  versionApplicability?: NonNullable<ReturnType<typeof resolveReviewedLocalTeamApplicability33>>
}

function exactKey(memberIds: readonly string[]) {
  return memberIds.map(resolveCurrentReleasedIdentity).sort().join('|')
}

/** Reviewed judgements are versioned data, not a formula inferred from source frequency,
 * individual tiers, observation percentiles, or a shared two-agent core. */
export function createReviewedTeamAnalysisCatalog(
  input: unknown,
  currentVersion: string,
  applicability?: typeof reviewedVersionApplicability33,
) {
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
  for (const record of parsed.records) {
    for (const alternative of record.preferredOver ?? []) {
      if (
        !record.mechanicReview ||
        !records.has(exactKey(alternative.memberIds)) ||
        record.memberIds.filter((id) => alternative.memberIds.includes(id)).length !== 2
      )
        throw new Error(
          `Generic preference requires two reviewed exact teams with a shared core: ${record.id}`,
        )
    }
  }
  return {
    dataset: parsed,
    resolve(memberIds: readonly string[]): ReviewedTeamAnalysis | null {
      if (memberIds.length !== 3) return null
      const record = records.get(exactKey(memberIds))
      if (!record || record.withdrawn) return null
      let versionApplicability: ReviewedTeamAnalysis['versionApplicability']
      if (parsed.gameVersion !== currentVersion) {
        if (applicability?.contentHash !== reviewedVersionApplicability33.contentHash) return null
        const bindings = record.memberIds.flatMap((agentId) => {
          const formulaSha256 =
            getCurrentAgentDecisionMechanicContract(agentId)?.effectContract?.source.formulaSha256
          return formulaSha256 ? [{ agentId, formulaSha256 }] : []
        })
        const resolved = resolveReviewedLocalTeamApplicability33({
          targetVersion: currentVersion,
          sourceVersion: parsed.gameVersion,
          reviewVersion: parsed.gameVersion,
          sourceDeltaHash: applicability.sourceDeltaHash,
          sourceDatasetHash: stableContentHash(input),
          scope: 'formed_generic_reference',
          reviewId: record.id,
          memberIds,
          currentFormulaBindings: bindings,
        })
        if (!resolved) return null
        versionApplicability = resolved
      }
      if (record.mechanicReview) {
        const review = record.mechanicReview
        if (
          new Set(review.agents.map((agent) => agent.agentId)).size !== 3 ||
          review.agents.some(
            (agent) =>
              !record.memberIds.includes(agent.agentId) ||
              getCurrentAgentDecisionMechanicContract(agent.agentId)?.effectContract?.source
                .formulaSha256 !== agent.formulaSha256,
          )
        )
          return null
        const state = inspectCurrent31FormationMechanicState(record.memberIds)
        if (
          !state.ruleComplete ||
          !state.activationAtBase ||
          !state.resourceLoopClosed ||
          !state.fieldTimeWithinBudget
        )
          return null
      }
      return {
        band: record.band,
        confidence: 'low',
        rationale: record.rationale,
        conditions: [...record.conditions],
        limitations: [...record.limitations],
        evidenceRefs: record.evidenceRefs.map((ref) => ({ ...ref })),
        ...(versionApplicability ? { versionApplicability } : {}),
        ...(record.mechanicReview
          ? { mechanicReview: structuredClone(record.mechanicReview) }
          : {}),
        ...(record.preferredOver ? { preferredOver: structuredClone(record.preferredOver) } : {}),
      }
    },
  }
}

/** A local review may use a historical composition or an author's comparison
 * setup as membership evidence. Its strength judgement remains Soda's, and
 * requires pinned current mechanics for all three agents; source recognition
 * and publisher tiers are never inferred from this route. */
export function hasReviewedCurrentTeamSourceBinding(
  analysis: ReviewedTeamAnalysis,
  sources: ReviewedTeamSourceDirection['sourceRefs'] | undefined,
) {
  return analysis.evidenceRefs.every((ref) =>
    sources?.some(
      (source) =>
        (analysis.mechanicReview ||
          (source.observationRole !== 'author_comparison_setup' &&
            source.verificationStatus !== 'historical_membership_reference')) &&
        source.url === ref.url &&
        source.sourceVersion === ref.sourceVersion &&
        (source.locator ?? source.id) === ref.locator &&
        source.contentHash === ref.sourceContentHash,
    ),
  )
}

/** Only the adopted read view carries the explicitly retained legacy review basis. */
export function reviewedTeamAnalysisVersion(currentVersion: string) {
  return currentVersion === currentVersionAdoption32.gameVersion
    ? currentVersionAdoption32.legacyFieldAuthority.gameVersion
    : currentVersion
}

const catalog = createReviewedTeamAnalysisCatalog(
  dataset,
  reviewedTeamAnalysisVersion(currentVersionProjection.gameVersion),
)
export const reviewedTeamAnalysis = Object.freeze({
  ...catalog.dataset,
  contentHash: stableContentHash(dataset),
})
const sourceVersionCatalog = createReviewedTeamAnalysisCatalog(dataset, dataset.gameVersion)
const currentCatalog32 = createReviewedTeamAnalysisCatalog(
  currentDataset32,
  currentDataset32.gameVersion,
)
const currentCatalog33 = createReviewedTeamAnalysisCatalog(
  currentDataset32,
  '3.3',
  reviewedVersionApplicability33,
)
export const reviewedCurrentTeamAnalysis32 = Object.freeze({
  ...currentCatalog32.dataset,
  contentHash: stableContentHash(currentDataset32),
})

/** Current local reviews retain their own version and provenance. They never
 * alter the frozen legacy training labels or automatically inherit forward. */
export function resolveReviewedCurrentTeamAnalysis(
  memberIds: readonly string[],
  reviewVersion: string,
): ReviewedTeamAnalysis | null {
  if (reviewVersion === currentDataset32.gameVersion) return currentCatalog32.resolve(memberIds)
  return reviewVersion === '3.3' && currentVersionProjection.gameVersion === reviewVersion
    ? currentCatalog33.resolve(memberIds)
    : null
}

export function resolveReviewedCurrentTeamPreferences(
  directions: readonly ReviewedTeamSourceDirection[],
) {
  const sources = new Map(directions.map((row) => [exactKey(row.memberIds), row.sourceRefs]))
  return reviewedCurrentTeamAnalysis32.records.flatMap((record) => {
    const review = resolveReviewedCurrentTeamAnalysis(
      record.memberIds,
      currentVersionProjection.gameVersion,
    )
    if (
      !review ||
      !hasReviewedCurrentTeamSourceBinding(review, sources.get(exactKey(record.memberIds)))
    )
      return []
    return (review.preferredOver ?? []).flatMap((alternative) => {
      const other = resolveReviewedCurrentTeamAnalysis(
        alternative.memberIds,
        currentVersionProjection.gameVersion,
      )
      return other &&
        hasReviewedCurrentTeamSourceBinding(other, sources.get(exactKey(alternative.memberIds)))
        ? [
            {
              preferredMemberIds: record.memberIds,
              alternativeMemberIds: alternative.memberIds,
              rationale: alternative.rationale,
            },
          ]
        : []
    })
  })
}

export function resolveReviewedTeamAnalysis(
  memberIds: readonly string[],
  reviewVersion: string = reviewedTeamAnalysisVersion(currentVersionProjection.gameVersion),
) {
  // The imported package keeps its own review version even when the available
  // agent directory grows. Another requested version cannot reuse this review.
  return reviewVersion === dataset.gameVersion ? sourceVersionCatalog.resolve(memberIds) : null
}
