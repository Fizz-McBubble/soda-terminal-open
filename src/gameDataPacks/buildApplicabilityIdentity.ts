export type BuildApplicabilityStatus =
  | 'continuous'
  | 'affected_pending'
  | 'unreviewed_reference'
  | 'missing'

export type BuildApplicabilityIdentity = {
  readonly agentId: string
  /** Canonical dependency field this identity evaluates; absent only on legacy snapshots. */
  readonly fieldPath?: string
  readonly status: BuildApplicabilityStatus
  readonly version: string
  readonly source: {
    readonly id: string | null
    readonly sourceVersion: string | null
    readonly originalSourceVersion: string | null
    readonly checkedAt: string | null
  }
  readonly authorReview: {
    readonly isExplicitAuthorReview: boolean
    readonly authorReviewedVersion: string | null
  }
  readonly localAdoptionReviewId: string | null
  readonly dependencyFingerprint: string
  /**
   * Historical continuity alone does not prove current guidance review.
   */
  readonly isCurrentGuidanceComplete: boolean
  readonly affectedFieldPaths: readonly string[]
  readonly applicabilityReasons: readonly string[]
}
