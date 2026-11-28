import {
  reviewedSourceTeamObservations32,
  reviewedSourceTeamObservations32Identity,
} from '../gameDataPacks/reviewedSourceTeamObservations32'
import { stableContentHash } from '../gameDataPacks/types'

/** Membership capability only; independent of the active recommendation lifecycle. */
export type AuthorComparisonMembership32 = {
  explicitSelectionOnly: true
  /** Current independent admission affects the team, not this historical source. */
  independentDefaultAdmission?: true
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

const identityValid =
  reviewedSourceTeamObservations32Identity.sourceVersion === '3.2' &&
  reviewedSourceTeamObservations32Identity.id === 'reviewed-source-team-observations-3.2-v1' &&
  reviewedSourceTeamObservations32Identity.contentHash ===
    stableContentHash(reviewedSourceTeamObservations32)

const authorComparisonByKey = new Map<
  string,
  {
    observation: (typeof reviewedSourceTeamObservations32)[number]
    fingerprint: string
  }
>()
if (identityValid) {
  for (const row of reviewedSourceTeamObservations32) {
    if (row.sourceVersion !== '3.2' || row.observationRole !== 'author_comparison_setup') continue
    const key = [...row.memberIds].sort().join('|')
    if (!authorComparisonByKey.has(key)) {
      authorComparisonByKey.set(key, {
        observation: row,
        fingerprint: stableContentHash({
          identity: authorComparisonMembership32Identity,
          observation: row,
        }),
      })
    }
  }
}

export function reviewedAuthorComparisonMembership32(
  memberIds: readonly string[],
  ownedAgentIds: readonly string[],
  reviewVersion = '3.2',
): AuthorComparisonMembership32 | null {
  if (
    reviewVersion !== '3.2' ||
    !identityValid ||
    memberIds.length !== 3 ||
    memberIds[0] === memberIds[1] ||
    memberIds[0] === memberIds[2] ||
    memberIds[1] === memberIds[2]
  )
    return null
  const key = [...memberIds].sort().join('|')
  const matched = authorComparisonByKey.get(key)
  if (!matched) return null
  if (memberIds.some((id) => !ownedAgentIds.includes(id))) return null
  // Only the two indexed historical trios reach this check. The exported facts
  // can change after startup; never attach an old fingerprint to a changed row.
  if (
    stableContentHash(reviewedSourceTeamObservations32) !==
    reviewedSourceTeamObservations32Identity.contentHash
  )
    return null
  const { observation, fingerprint } = matched
  return {
    explicitSelectionOnly: true,
    observationRole: observation.observationRole,
    sourceVersion: '3.2',
    conditions: [...observation.conditions],
    equipmentConditions: observation.equipmentConditions.map((row) => ({ ...row })),
    fingerprint,
  }
}
