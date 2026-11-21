import reusedTeamDirections from './data/reviewed-team-direction-reuse.3.1.json'
import imageTeamDirections from './data/reviewed-team-image-directions.3.1.json'
import nestedTeamDirections from './data/reviewed-team-nested-directions.3.1.json'
import type { TeamOutputModuleResolution } from './teamOutputModuleContract'

export type NestedDirectionRecord = (typeof nestedTeamDirections.records)[number] & {
  additionalConditionSources?: NonNullable<
    (typeof nestedTeamDirections.records)[number]['additionalConditionSource']
  >[]
}

export type TeamRecommendationPrerequisite =
  | { kind: 'potential_minimum'; agentId: string; minimum: number }
  | { kind: 'wengine'; agentId: string; engineId: string }

export type ReviewedTeamSourceDirection = {
  memberIds: readonly [string, string, string]
  outputModule?: TeamOutputModuleResolution
  sourceRefs: {
    id: string
    url: string
    sourceVersion: string
    checkedAt: string
    contentHash: string
    observationRole?: 'author_comparison_setup'
    locator?: string
    hashDefinition?: string
    equipmentConditions?: readonly { agentId: string; sourceEquipmentName: string }[]
    /** Explicit recommendation gates only; effect windows are not team eligibility gates. */
    recommendationPrerequisites?: readonly TeamRecommendationPrerequisite[]
    scenario?: string
    /** Exact-team page replay, separate from the adopted coarse rating. */
    verificationStatus?: string
    sourceUpdatedAt?: string | null
    nestedEvidence?: NestedDirectionRecord['nested']
    imageEvidence?: { imageSha256: string; region: string; sourceLocator?: ImageSourceLocator }
    unresolvedAuthorBangbooOptions?: UnresolvedAuthorBangbooOption[]
    visualIdentityCorroboration?: ImageDirectionRecord['visualIdentityCorroboration']
    conditionReview?: { originalConditions: string[]; disposition: string }
    additionalConditionEvidence?: NestedDirectionRecord['additionalConditionSource']
    additionalConditionEvidences?: NestedDirectionRecord['additionalConditionSources']
    additionalMembershipEvidence?: NestedDirectionRecord['additionalMembershipSources']
    additionalImageMembershipEvidence?: ImageDirectionRecord['additionalMembershipSources']
    sourceConflictReview?: Record<string, unknown>
    imageLabelConflict?: unknown
    bangbooIdentityCrosschecks?: unknown
    imageIdentityReview?: unknown
    additionalBangbooEvidence?: NestedDirectionRecord['additionalBangbooSources']
    bangbooEffectExclusions?: NestedDirectionRecord['bangbooEffectExclusions']
    sourceLocalSlotId?: string
    legacyBodyHash?: string
  }[]
  conditions: string[]
  /** Keep observation conditions attached to their source when exact trios merge. */
  conditionsBySourceId?: Record<string, readonly string[]>
  /** Author-listed alternatives; never an activation or default recommendation. */
  sourceBangbooOptionIds?: string[]
}

export type ReusedDirectionRecord = (typeof reusedTeamDirections.records)[number] & {
  sourceBangbooOptionIds?: string[]
  sourceLocalSlotId?: string
  source?: {
    url: string
    sourceVersion: string
    checkedAt: string
    normalizedBodySha256: string
    sourceUpdatedAt?: string
  }
}

export type ImageSourceLocator = {
  opIndex: number
  fieldPath: (string | number)[]
  unitRawSha256: string
  imageId: string
  url: string
}
export type UnresolvedAuthorBangbooOption = {
  visibleLabel: string
  labelMappedStableId: string
  reason: string
}
export type ImageDirectionRecord = (typeof imageTeamDirections.records)[number] & {
  sourceLocalSlotId?: string
  sourceVersion?: string
  checkedAt?: string
  sourceUpdatedAt?: string
  conditionReview?: { originalConditions: string[]; disposition: string }
  imageSourceLocator?: ImageSourceLocator
  unresolvedAuthorBangbooOptions?: UnresolvedAuthorBangbooOption[]
  additionalConditionSources?: NestedDirectionRecord['additionalConditionSources']
  additionalMembershipSources?: {
    locator: { kind: string; opIndex: number; fieldPath: (string | number)[] }
    unitRawSha256: string
    textSha256: string
    text: string
  }[]
  sourceConflictReview?: Record<string, unknown>
  imageLabelConflict?: unknown
  bangbooIdentityCrosschecks?: unknown
  imageIdentityReview?: unknown
}
