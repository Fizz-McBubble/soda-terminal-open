import { canonicalJson } from '../application/contentHash'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import reviewedTeamGuides from '../gameDataPacks/data/reviewed-team-guide-verification.3.1.json'
import originalTeamReviews from '../gameDataPacks/data/reviewed-team-analysis.3.2.json'
import { reviewedCurrentTeamGuidance32 } from '../gameDataPacks/reviewedCurrentTeamGuidance32'
import { reviewedHoyoBuildCurrentTeams32 } from '../gameDataPacks/reviewedHoyoBuildCurrentTeams32'
import type { ReviewedTeamSourceDirection } from '../gameDataPacks/reviewedTeamSourceDirections'
import {
  resolveReviewedLocalTeamApplicability33,
  reviewedVersionApplicability33,
} from '../gameDataPacks/reviewedVersionApplicability33'
import { stableContentHash } from '../gameDataPacks/types'

type RecommendationSource = ReviewedTeamSourceDirection['sourceRefs'][number]
const teamKey = (ids: readonly string[]) => [...ids].sort().join('|')
const bindingKey = (ids: readonly string[], sourceId: string) =>
  JSON.stringify([teamKey(ids), sourceId])
const sourceReceiptKey = (
  memberIds: readonly string[],
  source: { url: string; sourceVersion: string | null },
) => JSON.stringify([teamKey(memberIds), source.url, source.sourceVersion])
const reviewedGuidanceAdoptionId = 'reviewed-source-guidance-3.2-to-3.3-r1' as const

// Index the small adopted review registry, never the candidate universe or the
// rating consumer. Source identity includes all metadata and typed prerequisites.
const reviewByTeam = new Map(
  originalTeamReviews.records.map((record) => [teamKey(record.memberIds), record]),
)
const exactGuideReceipts = new Set(
  reviewedTeamGuides.records
    .filter((record) => record.status === 'exact_match')
    .map((record) => sourceReceiptKey(record.memberIds, record)),
)
type SourceBinding = {
  sourceIdentity: string
  reviewId: string
  hasPrerequisites: boolean
  receiptKind: 'local_team_review' | 'reviewed_guide_identity'
  receiptConditions: readonly string[]
}
const bindings = new Map<string, SourceBinding>()
// Both adopted batches must pass the same exact source/condition receipt.
// Merely appearing on a guide page does not grant version or strength continuity.
for (const direction of [
  ...reviewedCurrentTeamGuidance32.entries,
  ...reviewedHoyoBuildCurrentTeams32.entries,
]) {
  const review = reviewByTeam.get(teamKey(direction.memberIds))
  for (const source of direction.sourceRefs) {
    if (source.verificationStatus !== 'reviewed_exact_team_current_32') continue
    const localReview =
      review &&
      review.evidenceRefs.some(
        (ref) =>
          ref.url === source.url &&
          ref.locator === source.locator &&
          ref.sourceVersion === source.sourceVersion &&
          ref.sourceContentHash === source.contentHash,
      )
    const reviewedGuideIdentity =
      source.sourceVersion !== '3.2' &&
      exactGuideReceipts.has(sourceReceiptKey(direction.memberIds, source))
    if (!localReview && !reviewedGuideIdentity) continue
    bindings.set(bindingKey(direction.memberIds, source.id), {
      sourceIdentity: canonicalJson(source),
      reviewId: localReview && review ? review.id : source.id,
      hasPrerequisites:
        'recommendationPrerequisites' in source &&
        Array.isArray(source.recommendationPrerequisites) &&
        source.recommendationPrerequisites.length > 0,
      receiptKind: localReview ? 'local_team_review' : 'reviewed_guide_identity',
      receiptConditions: [...direction.conditions],
    })
  }
}

/** A missing typed gate on a known source must reach the identity check rather
 * than taking the legacy unconditioned fallback. This grants no admission. */
export function hasRegisteredTeamRecommendationPrerequisites(input: {
  memberIds: readonly string[]
  sourceId: string
}) {
  return bindings.get(bindingKey(input.memberIds, input.sourceId))?.hasPrerequisites === true
}

/** Admit the original source to its existing condition assessor only. The
 * receipt retains the original local reference and never grants runtime,
 * Formal, Import, publisher-tier or new strength authority. */
export function resolveTeamRecommendationSourceContinuity(input: {
  memberIds: readonly string[]
  source: RecommendationSource
  reviewVersion: string
}) {
  const { memberIds, source, reviewVersion } = input
  if (
    reviewVersion !== '3.3' ||
    reviewedVersionApplicability33.targetVersion !== reviewVersion ||
    reviewedVersionApplicability33.boundary.strengthPromotion !== false ||
    reviewedVersionApplicability33.boundary.formalPromotion !== false ||
    reviewedVersionApplicability33.boundary.importPromotion !== false ||
    reviewedVersionApplicability33.boundary.runtimePromotion !== false ||
    memberIds.length !== 3 ||
    new Set(memberIds).size !== 3 ||
    source.verificationStatus !== 'reviewed_exact_team_current_32' ||
    source.observationRole === 'author_comparison_setup'
  )
    return null
  const binding = bindings.get(bindingKey(memberIds, source.id))
  if (!binding || canonicalJson(source) !== binding.sourceIdentity) return null
  const currentFormulaBindings = memberIds
    .map((agentId) => ({
      agentId,
      formulaSha256:
        getCurrentAgentDecisionMechanicContract(agentId)?.effectContract?.source.formulaSha256 ??
        '',
    }))
    .sort((left, right) => left.agentId.localeCompare(right.agentId))
  if (
    currentFormulaBindings.some(
      (binding) =>
        !/^[a-f\d]{64}$/i.test(binding.formulaSha256) || !memberIds.includes(binding.agentId),
    )
  )
    return null
  if (binding.receiptKind === 'local_team_review')
    return resolveReviewedLocalTeamApplicability33({
      targetVersion: reviewVersion,
      sourceVersion: originalTeamReviews.gameVersion,
      reviewVersion: reviewedCurrentTeamGuidance32.gameVersion,
      sourceDeltaHash: reviewedVersionApplicability33.sourceDeltaHash,
      sourceDatasetHash: reviewedVersionApplicability33.sourceDatasetHash,
      reviewId: binding.reviewId,
      memberIds,
      scope: 'formed_generic_reference',
      currentFormulaBindings,
    })

  // Older author pages can remain exact-current after a local review without
  // pretending their original sourceVersion changed. This branch grants only
  // the existing prerequisite assessment and preserves the original review
  // identity, conditions and source version.
  return {
    status: 'reference_continuity' as const,
    adoptionId: reviewedVersionApplicability33.id,
    continuityId: reviewedGuidanceAdoptionId,
    targetVersion: reviewVersion,
    sourceVersion: source.sourceVersion,
    reviewVersion: reviewedCurrentTeamGuidance32.gameVersion,
    sourceDeltaHash: reviewedVersionApplicability33.sourceDeltaHash,
    sourceDatasetHash: stableContentHash(reviewedCurrentTeamGuidance32),
    scope: 'formed_generic_reference' as const,
    authority: 'source_guide_reference' as const,
    confidence: 'low' as const,
    reviewId: binding.reviewId,
    memberIds: [...memberIds],
    currentFormulaBindings,
    receiptHash: stableContentHash({
      sourceIdentity: binding.sourceIdentity,
      conditions: binding.receiptConditions,
      reviewId: binding.reviewId,
    }),
    strengthPromotion: false as const,
    formalPromotion: false as const,
    importPromotion: false as const,
    runtimePromotion: false as const,
  }
}
