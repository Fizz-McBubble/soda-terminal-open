import {
  playerBuildProfiles30,
  type PlayerBuildField,
  type PlayerBuildSource,
} from './playerBuildProfiles'
import type { AgentProfileField } from './agentProfileFieldProjection'
import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'
import { stableContentHash } from './types'
import {
  getBuildApplicabilityIdentity,
  type BuildApplicabilityStatus,
} from './buildApplicabilityDependencyAnalysis'
import { getReviewedHoyoBuildDriveDiscSets32 } from './reviewedHoyoBuildDriveDiscSets32'
import { getReviewedHoyoBuildMiyabiMainSubStats32 } from './reviewedHoyoBuildMiyabiPanels32'
import { getGameData32BuildGuidanceFields } from './gameData32BuildGuidance'
import {
  candidateBuildGuidanceFieldPaths,
  type CandidateBuildGuidanceFieldPath,
  type CandidateWarehouseConstraint,
} from './candidateWarehouseConstraintTypes'

function sourceList(fields: PlayerBuildField[]) {
  return fields.flatMap((field) => [
    ...(field.source ? [field.source] : []),
    ...(field.supplementalSources ?? []).map((entry) => entry.source),
  ])
}

const currentConstraintSnapshots = new WeakMap<
  CandidateWarehouseConstraint,
  CandidateWarehouseConstraint
>()

export function withGuidanceApplicability(
  constraint: CandidateWarehouseConstraint,
): CandidateWarehouseConstraint {
  const agentId = resolveCurrentReleasedIdentity(constraint.agentId) ?? constraint.agentId
  const profile = playerBuildProfiles30.find(
    (item) => (resolveCurrentReleasedIdentity(item.agentId) ?? item.agentId) === agentId,
  )
  const fieldSources = (
    field: PlayerBuildField | AgentProfileField,
  ): readonly { id: string; contentHash: string | null; sourceVersion: string | null }[] =>
    'sourceRefs' in field ? (field.sourceRefs ?? []) : sourceList([field])
  const sourceIsPresent = (field: PlayerBuildField | AgentProfileField | undefined) =>
    Boolean(
      field &&
      fieldSources(field).some((source) =>
        constraint.sources.some((item) => item.id === source.id),
      ),
    )
  const sourceKey = (source: {
    id: string
    contentHash: string | null
    sourceVersion: string | null
  }) => [source.id, source.contentHash, source.sourceVersion].join('|')
  const sourceFields = new Map<string, CandidateBuildGuidanceFieldPath[]>()
  const declaredStatusBySourceField = new Map<string, BuildApplicabilityStatus>()
  const profileFields = [
    ...(profile?.fields ?? []),
    ...getGameData32BuildGuidanceFields(agentId),
    getReviewedHoyoBuildDriveDiscSets32(agentId),
    getReviewedHoyoBuildMiyabiMainSubStats32(),
  ].filter(
    (field): field is PlayerBuildField | AgentProfileField =>
      Boolean(field) &&
      (profile?.fields.some((entry) => entry === field) || sourceIsPresent(field)),
  )
  for (const field of profileFields) {
    if (!candidateBuildGuidanceFieldPaths.includes(field.path as CandidateBuildGuidanceFieldPath))
      continue
    for (const source of fieldSources(field)) {
      sourceFields.set(sourceKey(source), [
        ...(sourceFields.get(sourceKey(source)) ?? []),
        field.path as CandidateBuildGuidanceFieldPath,
      ])
      if (
        'currentApplicability' in field &&
        (field.currentApplicability === 'continuous' ||
          field.currentApplicability === 'affected_pending')
      )
        declaredStatusBySourceField.set(
          `${field.path}|${sourceKey(source)}`,
          field.currentApplicability,
        )
    }
  }
  const reviewedTeamSourceKey = constraint.reviewedTeamDirectionId
    ? sourceKey({
        id: `reviewed-team-disc-${constraint.reviewedTeamDirectionId}`,
        contentHash: constraint.reviewedTeamDirectionSource?.contentHash ?? '',
        sourceVersion: constraint.reviewedTeamDirectionSource?.sourceVersion ?? null,
      })
    : null
  const reviewedTeamPaths = [
    'build.drive_disc_sets',
    'build.main_sub_stats',
    'build.team_bangboo_scenario',
  ] as const
  const reviewedIndependentSource = constraint.reviewedIndependentDirectionId
    ? constraint.sources.find((source) => source.id === constraint.reviewedIndependentDirectionId)
    : undefined
  const reviewedIndependentSourceKey = reviewedIndependentSource
    ? sourceKey(reviewedIndependentSource)
    : null
  if (reviewedTeamSourceKey)
    for (const fieldPath of reviewedTeamPaths)
      declaredStatusBySourceField.set(`${fieldPath}|${reviewedTeamSourceKey}`, 'continuous')
  const matchedAnySource = constraint.sources.some((source) => sourceFields.has(sourceKey(source)))
  const pathsForSource = (source: PlayerBuildSource) => {
    if (reviewedIndependentSourceKey && sourceKey(source) === reviewedIndependentSourceKey)
      return ['build.main_sub_stats'] as const
    if (reviewedTeamSourceKey && sourceKey(source) === reviewedTeamSourceKey)
      return reviewedTeamPaths
    const matched = sourceFields.get(sourceKey(source))
    if (matched?.length) return [...new Set(matched)]
    // A reviewed team source added to an otherwise mapped profile is team-scoped.
    // Aggregate 3.1/3.2 guidance without a source-field map remains relevant to
    // every build field, with each identity evaluated at its own dependency path.
    return profileFields.length && matchedAnySource
      ? (['build.team_bangboo_scenario'] as const)
      : candidateBuildGuidanceFieldPaths
  }
  const input = {
    ...constraint,
    agentId,
    guidanceApplicability: constraint.sources.flatMap((source) =>
      pathsForSource(source).map((fieldPath) => {
        const identity = getBuildApplicabilityIdentity(agentId, { source, fieldPath })
        const declaredStatus = declaredStatusBySourceField.get(`${fieldPath}|${sourceKey(source)}`)
        if (!declaredStatus) return identity
        const isCurrentGuidanceComplete =
          declaredStatus === 'continuous' && identity.isCurrentGuidanceComplete
        return {
          ...identity,
          status: declaredStatus,
          isCurrentGuidanceComplete,
          dependencyFingerprint: stableContentHash({
            ...identity,
            status: declaredStatus,
            isCurrentGuidanceComplete,
            dependencyFingerprint: undefined,
          }),
        }
      }),
    ),
  }
  const contentHash = stableContentHash({ ...input, contentHash: undefined })
  const previous = currentConstraintSnapshots.get(constraint)
  if (previous?.contentHash === contentHash) return previous
  const snapshot = { ...input, contentHash }
  currentConstraintSnapshots.set(constraint, snapshot)
  return snapshot
}

/**
 * Field-level eligibility for candidate guidance. Missing metadata is retained
 * for historical snapshots; current constraints evaluate each source at its
 * actual dependency path instead of copying an agent-wide affected flag.
 */
export function candidateGuidanceFieldAvailable(
  constraint: CandidateWarehouseConstraint,
  fieldPath: CandidateBuildGuidanceFieldPath,
  sourceId?: string,
): boolean {
  // Older frozen snapshots did not record field applicability. Preserve their
  // existing bounded behavior; current constraints must carry per-field evidence.
  if (!constraint.guidanceApplicability) return true
  const fieldIdentities = constraint.guidanceApplicability.filter(
    (identity) => identity.fieldPath === fieldPath,
  )
  if (!fieldIdentities.length) return false
  const identities = sourceId
    ? fieldIdentities.filter((identity) => identity.source.id === sourceId)
    : fieldIdentities
  // Conditional plans carry their own verified source locator. That source may
  // be newer than the base profile and therefore absent from its field ledger.
  if (sourceId && !identities.length) return true
  // A current reviewed source can supersede older affected references for the
  // same field. Source-qualified branches still evaluate only their own source.
  if (!sourceId && identities.some((identity) => identity.status === 'continuous')) return true
  return !identities.some((identity) => identity.status === 'affected_pending')
}
