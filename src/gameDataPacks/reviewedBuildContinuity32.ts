import { projectedReviewedBuild32Fields } from './agentProfileFieldProjection'
import { gameData32BuildGuidance } from './gameData32BuildGuidance'
import { stableContentHash } from './types'

/** Field adoption only. Static kit equality does not review historical build ranking or team meta. */
export const reviewedBuildContinuity32 = Object.values(gameData32BuildGuidance).flatMap((guide) =>
  projectedReviewedBuild32Fields(guide.agentId).map((field) => ({
    id: `reviewed-build-32:${guide.agentId}:${field.path}`,
    subjectId: guide.agentId,
    fieldPath: field.path,
    sourceVersion: field.originalSourceVersion ?? 'unknown',
    evaluatedForVersion: field.gameVersion,
    evidence: 'candidate' as const,
    currentApplicability: 'continuous' as const,
    affectedByDelta: true,
    freshness: 'current' as const,
    supersedes: [] as readonly string[],
    sourceRefs: field.sourceRefs.map((source) => source.id),
    contentHash: stableContentHash(field),
  })),
)
