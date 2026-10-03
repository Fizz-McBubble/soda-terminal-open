import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { CurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import {
  resolveRetentionActionFact,
  type RetentionActionTag,
} from './absoluteDiscRetentionActionFacts'
import type {
  RetentionUtilityEvidence,
  RetentionUtilityState,
} from './absoluteDiscRetentionUseFacts'
import {
  resolveReviewedUseScope,
  type Context,
  type Review,
  type Adoption,
} from './reviewedRetentionUseScope'

/** Explicit reviewed profile input; the ordinary caller cannot infer this from an actor name. */
export type ReviewedActionUseScope = {
  context: Context
  review: Review
  adoption: Adoption
}

export function resolveActionUtility(
  action: RetentionActionTag,
  agentId: string,
  constraint: CandidateWarehouseConstraint,
  eventContract: CurrentAgentEventContract | null,
  evidenceIds: string[],
  reviewedScope?: ReviewedActionUseScope,
): RetentionUtilityEvidence {
  const fact = resolveRetentionActionFact(
    action,
    resolveCurrentReleasedIdentity(agentId),
    constraint,
    eventContract,
  )
  const ev = (
    state: RetentionUtilityState,
    predicateId: string,
    detail: string,
  ): RetentionUtilityEvidence => {
    const result = {
      state,
      predicateId,
      evidenceIds: [...new Set([...evidenceIds, ...fact.sourceIds])],
      detail,
    }
    const { contentHash, ...constraintPayload } = constraint
    if (
      !reviewedScope ||
      constraint.status === 'missing' ||
      !constraint.sources.some((source) => source.verified) ||
      contentHash !== stableContentHash(constraintPayload) ||
      !/^[a-f\d]{64}$/i.test(reviewedScope.review.sourceArtifactSha256 ?? '') ||
      !eventContract ||
      reviewedScope.context.actorAgentId !== fact.actorAgentId ||
      reviewedScope.context.profileFingerprint !== constraint.contentHash ||
      reviewedScope.context.externalId !== eventContract.externalId ||
      reviewedScope.context.sourceCommit !== eventContract.source.commit ||
      reviewedScope.context.formulaSha256.toUpperCase() !==
        eventContract.source.formulaSha256.toUpperCase() ||
      reviewedScope.context.statsSha256.toUpperCase() !==
        eventContract.source.statsSha256.toUpperCase()
    )
      return result
    const scoped = resolveReviewedUseScope(
      { action, mechanicalPresence: fact.presence, utility: state, predicateId },
      reviewedScope.context,
      reviewedScope.review,
      reviewedScope.adoption,
    )
    return scoped.applied
      ? {
          state: scoped.utility,
          predicateId: scoped.predicateId,
          evidenceIds: [
            ...result.evidenceIds,
            `reviewed-use:${scoped.useReviewId}`,
            `reviewed-source-sha256:${reviewedScope.review.sourceArtifactSha256}`,
            ...scoped.evidenceUrls,
          ],
          detail: scoped.explanation,
        }
      : result
  }
  if (constraint.status === 'missing' || !constraint.sources.some((source) => source.verified))
    return ev(
      'missing_fact',
      'missing_build_source',
      `Verified action build source facts missing for ${agentId}.`,
    )
  if (fact.presence === 'unresolved')
    return ev(
      'missing_fact',
      `${action}_actor_action_contract_missing`,
      fact.detail ??
        `Missing reviewed self ${action} classification; guide text and teammate descriptions cannot prove this action.`,
    )
  if (fact.presence === 'absent')
    return ev(
      'incompatible',
      `no_${action}_mechanic_in_kit`,
      fact.detail ??
        `Reviewed source kit classifies no self ${action} damage events; this is a source-bound negative fact.`,
    )
  if (fact.currentBuildBenefit === 'primary' && fact.condition?.binding === 'reviewed_build')
    return ev(
      'valid',
      action === 'aftershock'
        ? 'aftershock_primary_damage_focus'
        : `${action}_attack_primary_damage`,
      `Reviewed Candidate build uses self ${action} damage under ${fact.condition.predicateId}; not a Formal damage claim.`,
    )
  if (action === 'aftershock')
    return ev(
      'conditional',
      'aftershock_current_build_benefit_unverified',
      'Source-classified self aftershock events exist; verify their activation and benefit in this build before claiming a primary damage use.',
    )
  return ev(
    'incidental',
    `generic_${action === 'basic' ? 'basic_attack' : 'dash_attack'}_action`,
    `Generic self ${action} inputs exist, but no source-bound primary damage focus is established for this build.`,
  )
}
