import {
  reviewedSourceTeamObservations32,
  reviewedSourceTeamObservations32Identity,
} from './reviewedSourceTeamObservations32'
import type { ReviewedTeamSourceDirection } from './reviewedTeamSourceDirections'
import { stableContentHash } from './types'

export function reviewedSourceTeamDirectionProjection32(
  reviewVersion: string,
): ReviewedTeamSourceDirection[] {
  if (reviewVersion !== '3.2') return []
  return reviewedSourceTeamObservations32.map((observation) => ({
    memberIds: observation.memberIds,
    sourceRefs: [
      {
        id: observation.id,
        url: observation.sourceUrl,
        sourceVersion: observation.sourceVersion,
        sourceUpdatedAt: observation.sourceUpdatedAt,
        checkedAt: observation.checkedAt,
        contentHash: stableContentHash(observation),
        observationRole: observation.observationRole,
        locator: observation.locator,
        hashDefinition: reviewedSourceTeamObservations32Identity.hashDefinition,
        equipmentConditions: observation.equipmentConditions,
        scenario: observation.scenario,
        verificationStatus: 'reviewed_author_comparison_membership',
      },
    ],
    conditions: [...observation.conditions],
  }))
}
