import review from './data/reviewed-version-applicability.3.3.json'
import originalTeamReviews from './data/reviewed-team-analysis.3.2.json'
import originalSkillGuidance from './data/hoyobuild-current-skill-guidance.3.2.json'
import { stableContentHash } from '../domain/stableContentHash'

export type ReviewedFormulaBinding33 = { agentId: string; formulaSha256: string }
type ReferenceRequest = {
  targetVersion: string
  sourceVersion: string
  reviewVersion: string
  sourceDeltaHash: string
  /** Runtime, Formal and Import requests must fail even for unchanged static facts. */
  scope: string
}

const deltaHash = 'DD6B87A5CBFBB965726D2C79297F630EBCA85187AF09F7802A6F4D0D5B3A0AE0'
const exactTeamKey = (ids: readonly string[]) => [...ids].sort().join('|')
const sameFormula = (left: string, right: string) =>
  /^[a-f\d]{64}$/i.test(left) && left.toUpperCase() === right.toUpperCase()

function requestIsReviewed(input: ReferenceRequest) {
  return (
    review.schema === 'soda-reviewed-version-applicability/v1' &&
    input.targetVersion === '3.3' &&
    review.targetVersion === input.targetVersion &&
    input.sourceVersion === '3.2' &&
    input.reviewVersion === '3.2' &&
    input.sourceDeltaHash === deltaHash &&
    review.sourceDelta.contentHash === deltaHash &&
    review.sourceDelta.previousVersion === input.sourceVersion &&
    review.sourceDelta.targetVersion === input.targetVersion &&
    review.boundary.strengthPromotion === false &&
    review.boundary.formalPromotion === false &&
    review.boundary.importPromotion === false &&
    review.boundary.runtimePromotion === false
  )
}

function referenceIdentity(input: ReferenceRequest) {
  return {
    status: 'reference_continuity' as const,
    adoptionId: review.id,
    targetVersion: '3.3' as const,
    sourceVersion: input.sourceVersion,
    reviewVersion: input.reviewVersion,
    sourceDeltaHash: deltaHash,
    strengthPromotion: false as const,
    formalPromotion: false as const,
    importPromotion: false as const,
    runtimePromotion: false as const,
  }
}

/** Explicit review permission only. The installed package and all consumers stay unchanged
 * until their Owner adopts this result and reruns their existing mechanism/eligibility gates. */
export const reviewedVersionApplicability33 = Object.freeze({
  id: review.id,
  targetVersion: review.targetVersion,
  reviewedAt: review.reviewedAt,
  sourceDeltaHash: deltaHash,
  sourceDatasetHash: review.localTeamReviews.sourceDatasetHash,
  localTeamReviewCount: review.localTeamReviews.records.length,
  fieldReviewCount: review.fieldReviews.length,
  contentHash: stableContentHash(review),
  boundary: Object.freeze({ ...review.boundary }),
})

/** All three members, the original dataset, and every current formula must match.
 * This retains the exact previous local band with low confidence; it never reads
 * a static-source equality result as permission to carry arbitrary meta forward. */
export function resolveReviewedLocalTeamApplicability33(
  input: ReferenceRequest & {
    sourceDatasetHash: string
    reviewId: string
    memberIds: readonly string[]
    currentFormulaBindings: readonly ReviewedFormulaBinding33[]
  },
) {
  const source = review.localTeamReviews
  if (
    !requestIsReviewed(input) ||
    input.scope !== 'formed_generic_reference' ||
    input.sourceVersion !== source.sourceVersion ||
    input.reviewVersion !== source.reviewVersion ||
    source.authority !== 'local_editorial_estimate' ||
    source.confidence !== 'low' ||
    input.sourceDatasetHash !== source.sourceDatasetHash ||
    stableContentHash(originalTeamReviews) !== source.sourceDatasetHash ||
    input.memberIds.length !== 3 ||
    new Set(input.memberIds).size !== 3 ||
    input.currentFormulaBindings.length !== 3 ||
    new Set(input.currentFormulaBindings.map((binding) => binding.agentId)).size !== 3
  )
    return null
  const record = source.records.find((row) => row.reviewId === input.reviewId)
  const original = originalTeamReviews.records.find((row) => row.id === input.reviewId)
  if (
    !record ||
    !original ||
    ('withdrawn' in original && original.withdrawn) ||
    record.band !== original.band ||
    exactTeamKey(record.memberIds) !== exactTeamKey(input.memberIds) ||
    exactTeamKey(original.memberIds) !== exactTeamKey(input.memberIds) ||
    record.formulaBindings.length !== 3 ||
    new Set(record.formulaBindings.map((binding) => binding.agentId)).size !== 3 ||
    record.formulaBindings.some((binding) => {
      const current = input.currentFormulaBindings.find((row) => row.agentId === binding.agentId)
      return (
        !record.memberIds.includes(binding.agentId) ||
        !current ||
        !sameFormula(current.formulaSha256, binding.formulaSha256)
      )
    })
  )
    return null
  return {
    ...referenceIdentity(input),
    scope: 'formed_generic_reference' as const,
    authority: 'local_editorial_estimate' as const,
    confidence: 'low' as const,
    reviewId: record.reviewId,
    memberIds: [...record.memberIds],
    sourceDatasetHash: source.sourceDatasetHash,
    band: record.band,
  }
}

function skillSourceHash(entry: (typeof originalSkillGuidance.entries)[number]) {
  return stableContentHash({
    url: entry.url,
    pageVersion: entry.pageVersion,
    updatedAt: entry.updatedAt,
    talentPriority: entry.talentPriority,
    cinemaLevels: entry.cinemaLevels,
  })
}

/** Only the individually registered skill/cinema guide fields are currently adopted.
 * Other build fields, raw static data, tiers and runtime behavior receive no permission. */
export function resolveReviewedFieldApplicability33(
  input: ReferenceRequest & {
    subjectId: string
    field: string
    sourceContentHash: string
    currentFormulaSha256: string
  },
) {
  if (!requestIsReviewed(input) || input.scope !== 'skill_cinema_guide_reference') return null
  const record = review.fieldReviews.find(
    (row) => row.subjectId === input.subjectId && row.field === input.field,
  )
  const original = originalSkillGuidance.entries.find((row) => row.agentId === input.subjectId)
  if (
    !record ||
    !original ||
    record.scope !== input.scope ||
    record.sourceVersion !== input.sourceVersion ||
    record.reviewVersion !== input.reviewVersion ||
    original.pageVersion !== input.sourceVersion ||
    record.sourceContentHash !== input.sourceContentHash ||
    skillSourceHash(original) !== record.sourceContentHash ||
    record.formulaBinding.agentId !== input.subjectId ||
    !sameFormula(input.currentFormulaSha256, record.formulaBinding.formulaSha256)
  )
    return null
  return {
    ...referenceIdentity(input),
    scope: 'skill_cinema_guide_reference' as const,
    authority: 'source_guide_reference' as const,
    subjectId: record.subjectId,
    field: record.field,
    sourceContentHash: record.sourceContentHash,
  }
}
