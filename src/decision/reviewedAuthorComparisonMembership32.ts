import {
  reviewedSourceTeamObservations32,
  reviewedSourceTeamObservations32Identity,
} from '../gameDataPacks/reviewedSourceTeamObservations32'
import { stableContentHash } from '../gameDataPacks/types'

/** Membership capability only; independent of the active recommendation lifecycle. */
export type AuthorComparisonMembership32 = {
  explicitSelectionOnly: true
  observationRole: 'author_comparison_setup'
  sourceVersion: '3.2'
  conditions: string[]
  equipmentConditions: Array<{ agentId: string; sourceEquipmentName: string }>
  fingerprint: string
}

export const authorComparisonMembership32Identity = Object.freeze({
  id: 'soda-explicit-author-comparison-membership-3.2-v1',
  source: reviewedSourceTeamObservations32Identity,
  boundary: 'owned_exact_membership_only; explicit_selection_only; no_strength_or_bangboo_claim',
})

export function reviewedAuthorComparisonMembership32(
  memberIds: readonly string[],
  ownedAgentIds: readonly string[],
  reviewVersion = '3.2',
): AuthorComparisonMembership32 | null {
  const identity = reviewedSourceTeamObservations32Identity
  if (
    reviewVersion !== '3.2' ||
    identity.sourceVersion !== '3.2' ||
    identity.id !== 'reviewed-source-team-observations-3.2-v1' ||
    identity.contentHash !== stableContentHash(reviewedSourceTeamObservations32) ||
    new Set(memberIds).size !== 3 ||
    memberIds.length !== 3 ||
    memberIds.some((id) => !ownedAgentIds.includes(id))
  )
    return null
  const key = [...memberIds].sort().join('|')
  const observation = reviewedSourceTeamObservations32.find(
    (row) =>
      [...row.memberIds].sort().join('|') === key &&
      row.sourceVersion === reviewVersion &&
      row.observationRole === 'author_comparison_setup',
  )
  if (!observation) return null
  return {
    explicitSelectionOnly: true,
    observationRole: observation.observationRole,
    sourceVersion: '3.2',
    conditions: [...observation.conditions],
    equipmentConditions: observation.equipmentConditions.map((row) => ({ ...row })),
    fingerprint: stableContentHash({ identity: authorComparisonMembership32Identity, observation }),
  }
}
