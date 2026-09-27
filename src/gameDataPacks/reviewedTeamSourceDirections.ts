import { current31IndependentConsensusGoldSet } from '../decision/current31IndependentConsensusGoldSet'
import { current31StrengthGoldSet } from '../decision/current31StrengthGoldSet'
import { current31VariantRealityProfileSet } from '../decision/current31VariantRealityProfile'
import { reviewedTeamPublishedStrength } from '../decision/reviewedTeamPublishedStrength'
import { currentReleasedIdentityMap } from './currentReleasedIdentityMap'
import { currentScopeManifest } from './currentScopeManifest'
import { current31ReviewedTeamSourceAtoms } from './generated/current31-reviewed-team-source-atoms'
import { stableContentHash } from './types'
import reviewedTeamGuides from './data/reviewed-team-guide-verification.3.1.json'
import reusedTeamDirections from './data/reviewed-team-direction-reuse.3.1.json'
import imageTeamDirections from './data/reviewed-team-image-directions.3.1.json'
import nestedTeamDirections from './data/reviewed-team-nested-directions.3.1.json'
import reviewedCompatibilityNotes from './data/reviewed-team-compatibility-notes.3.1.json'
import { current31ReviewedBangbooSourceAtoms } from './generated/current31-reviewed-bangboo-source-atoms'
import { isReviewedSourceAtomContractValid } from './reviewedBangbooSourceContract'

type NestedDirectionRecord = (typeof nestedTeamDirections.records)[number] & {
  additionalConditionSources?: NonNullable<
    (typeof nestedTeamDirections.records)[number]['additionalConditionSource']
  >[]
}

export type ReviewedTeamSourceDirection = {
  memberIds: readonly [string, string, string]
  sourceRefs: {
    id: string
    url: string
    sourceVersion: string
    checkedAt: string
    contentHash: string
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
  /** Author-listed alternatives; never an activation or default recommendation. */
  sourceBangbooOptionIds?: string[]
}

type ReusedDirectionRecord = (typeof reusedTeamDirections.records)[number] & {
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

type ImageSourceLocator = {
  opIndex: number
  fieldPath: (string | number)[]
  unitRawSha256: string
  imageId: string
  url: string
}
type UnresolvedAuthorBangbooOption = {
  visibleLabel: string
  labelMappedStableId: string
  reason: string
}
type ImageDirectionRecord = (typeof imageTeamDirections.records)[number] & {
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

/** Separate negative/conditional notes; this function never contributes candidates. */
export function currentReviewedTeamCompatibilityNotes(): ReviewedTeamSourceDirection[] {
  return reviewedCompatibilityNotes.records.map((record) => ({
    memberIds: record.memberIds as [string, string, string],
    conditions: [...record.conditions],
    sourceRefs: record.sourceRefs,
  }))
}

function memberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

type ReviewedTeamSlotObservation = {
  members: readonly [string, string, string]
  derivation: 'source_local_slot_enumeration'
  source: { url: string; bodyHash: string }
  locator: {
    kind: string
    start: number
    end: number
    textSha256: string
    nestedUnitKey?: string
    sourceLocalSlotId?: string
  }
}

function reviewedTeamSlotObservations(): ReviewedTeamSlotObservation[] {
  return [
    ...nestedTeamDirections.records.map((record: NestedDirectionRecord) => ({
      members: record.memberIds as [string, string, string],
      derivation: 'source_local_slot_enumeration' as const,
      source: { url: record.source.url, bodyHash: record.source.normalizedBodySha256 },
      locator: {
        kind: 'nested_text_unit',
        start: record.nested.span.start,
        end: record.nested.span.end,
        textSha256: record.nested.span.textSha256,
        nestedUnitKey: JSON.stringify([
          record.nested.locator,
          record.nested.unitRawSha256,
          ...(record.additionalMembershipSources ?? []).map((source) => [
            source.locator,
            source.unitRawSha256,
          ]),
        ]),
        sourceLocalSlotId: record.sourceLocalSlotId,
      },
    })),
    ...current31ReviewedTeamSourceAtoms,
    ...reusedTeamDirections.records.map((record: ReusedDirectionRecord) => ({
      members: record.memberIds as [string, string, string],
      derivation: 'source_local_slot_enumeration' as const,
      source: {
        url: record.source?.url ?? reusedTeamDirections.url,
        bodyHash: record.source?.normalizedBodySha256 ?? reusedTeamDirections.normalizedBodySha256,
      },
      locator: {
        kind: 'structured_text_span',
        start: record.charStart,
        end: record.charEnd,
        textSha256: record.textSha256,
        sourceLocalSlotId: record.sourceLocalSlotId,
      },
    })),
    ...imageTeamDirections.records.map((record: ImageDirectionRecord) => ({
      members: record.memberIds as [string, string, string],
      derivation: 'source_local_slot_enumeration' as const,
      source: { url: record.sourceUrl, bodyHash: record.imageSha256 },
      locator: {
        kind: 'reviewed_image_region',
        start: 0,
        end: 0,
        textSha256: stableContentHash(record.imageRegion),
        sourceLocalSlotId: record.sourceLocalSlotId,
      },
    })),
  ]
}

function isSameSourceLocalSlot(
  left: ReviewedTeamSlotObservation,
  right: ReviewedTeamSlotObservation,
) {
  return (
    left.derivation === 'source_local_slot_enumeration' &&
    right.derivation === 'source_local_slot_enumeration' &&
    left.source.url === right.source.url &&
    left.source.bodyHash === right.source.bodyHash &&
    left.locator.kind === right.locator.kind &&
    left.locator.start === right.locator.start &&
    left.locator.end === right.locator.end &&
    left.locator.textSha256 === right.locator.textSha256 &&
    (!(left.locator.sourceLocalSlotId || right.locator.sourceLocalSlotId) ||
      left.locator.sourceLocalSlotId === right.locator.sourceLocalSlotId) &&
    (left.locator.kind !== 'nested_text_unit' ||
      (Boolean(left.locator.nestedUnitKey) &&
        Boolean(left.locator.sourceLocalSlotId) &&
        left.locator.nestedUnitKey === right.locator.nestedUnitKey &&
        left.locator.sourceLocalSlotId === right.locator.sourceLocalSlotId))
  )
}

/** Whole author slots, before a selected formation can union unrelated cores. */
export function currentReviewedTeamSourceSlotGroups() {
  const pending = reviewedTeamSlotObservations()
  const groups: (readonly [string, string, string])[][] = []
  while (pending.length) {
    const first = pending.pop()!
    const group = [first.members]
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      if (!isSameSourceLocalSlot(first, pending[index]!)) continue
      group.push(pending[index]!.members)
      pending.splice(index, 1)
    }
    const unique = [...new Map(group.map((members) => [memberKey(members), members])).values()]
    if (unique.length > 1) groups.push(unique)
  }
  return groups
}

/**
 * Returns only exact three-agent variants explicitly enumerated from the same
 * source-local slot. The shared pair is accepted only when the entire locator
 * group proves exactly two fixed members; a shared pair from another source
 * paragraph is never treated as a family relation.
 */
export function currentReviewedTeamSourceSlotSiblings(
  memberIds: readonly [string, string, string],
  sourceAtoms: readonly ReviewedTeamSlotObservation[] = reviewedTeamSlotObservations(),
): readonly (readonly [string, string, string])[] {
  const selectedKey = memberKey(memberIds)
  const selectedAtoms = sourceAtoms.filter((atom) => memberKey(atom.members) === selectedKey)
  const siblings = new Map<string, readonly [string, string, string]>()
  for (const selected of selectedAtoms) {
    const slotAtoms = sourceAtoms.filter((atom) => isSameSourceLocalSlot(selected, atom))
    if (slotAtoms.length < 2) continue
    const fixedMemberIds = slotAtoms
      .map((atom) => new Set(atom.members))
      .reduce((shared, members) => new Set([...shared].filter((memberId) => members.has(memberId))))
    if (fixedMemberIds.size !== 2) continue
    for (const sibling of slotAtoms) siblings.set(memberKey(sibling.members), sibling.members)
  }
  return [...siblings.values()]
}

/** Exact team observations are discovery inputs, never strength/Bangboo defaults. */
export function currentReviewedTeamSourceDirections(): readonly ReviewedTeamSourceDirection[] {
  const released = new Set(
    currentScopeManifest.entries
      .filter(
        (entry) =>
          entry.domain === 'agent' && entry.releaseState === 'released' && entry.accountOwnable,
      )
      .map((entry) => entry.stableId),
  )
  const observations: ReviewedTeamSourceDirection[] = [
    ...reviewedTeamPublishedStrength.facts
      .filter(
        (fact) => !fact.withdrawn && fact.sourceVersion === currentReleasedIdentityMap.gameVersion,
      )
      .map((fact) => ({
        memberIds: fact.memberIds,
        sourceRefs: [
          {
            id: fact.claimId,
            url: fact.sourceUrl,
            sourceVersion: fact.sourceVersion,
            checkedAt: fact.checkedAt,
            contentHash: stableContentHash(fact),
            verificationStatus: 'reviewed_published_exact_team',
          },
        ],
        conditions: [],
      })),
    ...nestedTeamDirections.records.map((record) => ({
      memberIds: record.memberIds as [string, string, string],
      sourceRefs: [
        {
          id: record.claimId,
          url: record.source.url,
          sourceVersion: record.source.sourceVersion,
          checkedAt: record.source.checkedAt,
          sourceUpdatedAt: record.source.sourceUpdatedAt,
          contentHash: record.nested.unitRawSha256,
          legacyBodyHash: record.source.normalizedBodySha256,
          nestedEvidence: record.nested,
          additionalConditionEvidence: record.additionalConditionSource,
          additionalConditionEvidences: record.additionalConditionSources,
          additionalMembershipEvidence: record.additionalMembershipSources,
          additionalBangbooEvidence: record.additionalBangbooSources,
          bangbooEffectExclusions: record.bangbooEffectExclusions,
          sourceLocalSlotId: record.sourceLocalSlotId,
          verificationStatus:
            record.source.sourceVersion === currentReleasedIdentityMap.gameVersion
              ? 'reviewed_exact_nested_membership'
              : 'historical_membership_reference',
        },
      ],
      conditions: [
        ...record.conditions,
        ...(record.bangbooEffectExclusions ?? []).map((effect) => effect.reason),
      ],
      sourceBangbooOptionIds: [...record.sourceBangbooOptionIds],
    })),
    ...imageTeamDirections.records.map((record: ImageDirectionRecord) => ({
      memberIds: record.memberIds as [string, string, string],
      sourceRefs: [
        {
          id: record.claimId,
          url: record.sourceUrl,
          sourceVersion: record.sourceVersion ?? imageTeamDirections.sourceVersion,
          checkedAt: record.checkedAt ?? imageTeamDirections.checkedAt,
          sourceUpdatedAt: record.sourceUpdatedAt ?? null,
          contentHash: record.imageSha256,
          imageEvidence: {
            imageSha256: record.imageSha256,
            region: record.imageRegion,
            ...(record.imageSourceLocator ? { sourceLocator: record.imageSourceLocator } : {}),
          },
          unresolvedAuthorBangbooOptions: record.unresolvedAuthorBangbooOptions,
          visualIdentityCorroboration: record.visualIdentityCorroboration,
          conditionReview: record.conditionReview,
          sourceLocalSlotId: record.sourceLocalSlotId,
          additionalConditionEvidences: record.additionalConditionSources,
          additionalImageMembershipEvidence: record.additionalMembershipSources,
          sourceConflictReview: record.sourceConflictReview,
          imageLabelConflict: record.imageLabelConflict,
          bangbooIdentityCrosschecks: record.bangbooIdentityCrosschecks,
          imageIdentityReview: record.imageIdentityReview,
          verificationStatus:
            (record.sourceVersion ?? imageTeamDirections.sourceVersion) !==
            currentReleasedIdentityMap.gameVersion
              ? 'historical_membership_reference'
              : 'reviewed_exact_image_slots',
        },
      ],
      conditions: [...record.conditions],
      sourceBangbooOptionIds: [...record.sourceBangbooOptionIds],
    })),
    ...(isReviewedSourceAtomContractValid() ? current31ReviewedBangbooSourceAtoms.atoms : []).map(
      (atom) => ({
        memberIds: atom.lineup.filter((id) => id.startsWith('agent-')) as [string, string, string],
        sourceRefs: [
          {
            id: `${atom.sourceId}#${atom.locator}`,
            url: atom.sourceUrl,
            sourceVersion: atom.gameVersion,
            checkedAt: '2026-08-06',
            // This is the reviewed semantic census hash, not upstream page bytes.
            contentHash: current31ReviewedBangbooSourceAtoms.sourceCensus.sha256,
            verificationStatus: 'reviewed_exact_lineup_membership',
          },
        ],
        // A complete lineup observation supports discovery only. It does not
        // turn the source's reference-only relationship into strength evidence.
        conditions: [],
      }),
    ),
    ...reusedTeamDirections.records.map((record: ReusedDirectionRecord) => ({
      memberIds: record.memberIds as [string, string, string],
      sourceRefs: [
        {
          id: record.claimId,
          url: record.source?.url ?? reusedTeamDirections.url,
          sourceVersion: record.source?.sourceVersion ?? reusedTeamDirections.sourceVersion,
          checkedAt: record.source?.checkedAt ?? reusedTeamDirections.checkedAt,
          contentHash:
            record.source?.normalizedBodySha256 ?? reusedTeamDirections.normalizedBodySha256,
          verificationStatus:
            (record.source?.sourceVersion ?? reusedTeamDirections.sourceVersion) !==
            currentReleasedIdentityMap.gameVersion
              ? 'historical_membership_reference'
              : 'reviewed_exact_trio_reused',
          sourceUpdatedAt: record.source?.sourceUpdatedAt ?? null,
        },
      ],
      conditions: [...record.conditions],
      sourceBangbooOptionIds: [...(record.sourceBangbooOptionIds ?? [])],
    })),
    // Adopted exact-team identities must reach discovery regardless of which
    // reviewed catalogue supplied them. This projection does not copy its tier.
    ...[
      ...current31StrengthGoldSet.cases.map((item) => ({
        id: item.caseId,
        memberIds: item.memberIds,
        urls: item.evidenceRefs.map((ref) => ref.url),
      })),
      ...current31StrengthGoldSet.versionedTeamStrengthSupplements.map((item) => ({
        id: item.claimId,
        memberIds: item.memberIds,
        urls: [...item.evidenceRefs],
      })),
      ...current31VariantRealityProfileSet.profiles.map((item) => ({
        id: item.profileId,
        memberIds: item.memberIds,
        urls: [...item.evidenceRefs],
      })),
    ].map((item) => ({
      memberIds: item.memberIds,
      sourceRefs: item.urls.map((url) => ({
        id: item.id,
        url,
        sourceVersion: 'unspecified',
        checkedAt: '2026-09-08',
        // Fingerprints the adopted claim, not the upstream page bytes.
        contentHash: stableContentHash({ members: item.memberIds, url, claimId: item.id }),
      })),
      conditions: [],
    })),
    ...current31IndependentConsensusGoldSet.observations.map((item) => ({
      memberIds: item.memberIds,
      sourceRefs: item.calibrationEvidenceRefs.map((ref) => ({
        id: item.observationId,
        url: ref.url,
        sourceVersion: current31IndependentConsensusGoldSet.gameVersion,
        checkedAt: '2026-09-08',
        // Semantic observation fingerprint, not a claimed hash of the web page.
        contentHash: stableContentHash({ members: item.memberIds, ref }),
      })),
      conditions: [],
    })),
    ...current31ReviewedTeamSourceAtoms.map((atom) => ({
      memberIds: atom.members,
      sourceRefs: [
        {
          id: atom.atomId,
          url: atom.source.url,
          sourceVersion: atom.source.sourceVersion,
          checkedAt: '2026-09-08',
          contentHash: atom.source.bodyHash,
        },
      ],
      conditions: [...(atom.conditions ?? [])],
    })),
  ]
  const byMembers = new Map<string, ReviewedTeamSourceDirection>()
  for (const observation of observations) {
    if (
      new Set(observation.memberIds).size !== 3 ||
      observation.memberIds.some((id) => !released.has(id))
    )
      continue
    const key = memberKey(observation.memberIds)
    observation.sourceRefs = observation.sourceRefs
      .map((ref) => {
        // Nested replay is an independent unit, not an older top-level page verification.
        if (ref.nestedEvidence || ref.imageEvidence) return ref
        const replay = reviewedTeamGuides.records.find(
          (record) => record.url === ref.url && memberKey(record.memberIds) === key,
        )
        if (!replay) return ref
        return {
          ...ref,
          sourceVersion: replay.sourceVersion ?? ref.sourceVersion,
          checkedAt: reviewedTeamGuides.retrievedAt,
          sourceUpdatedAt: replay.sourceUpdatedAt,
          verificationStatus: replay.status,
          contentHash: stableContentHash({ adoptedClaimHash: ref.contentHash, replay }),
        }
      })
      .map((ref) =>
        ref.sourceVersion === currentReleasedIdentityMap.gameVersion
          ? ref
          : { ...ref, verificationStatus: 'historical_membership_reference' },
      )
    const existing = byMembers.get(key)
    if (existing) {
      existing.sourceRefs.push(...observation.sourceRefs)
      existing.conditions = [...new Set([...existing.conditions, ...observation.conditions])]
      existing.sourceBangbooOptionIds = [
        ...new Set([
          ...(existing.sourceBangbooOptionIds ?? []),
          ...(observation.sourceBangbooOptionIds ?? []),
        ]),
      ]
    } else byMembers.set(key, { ...observation, sourceRefs: [...observation.sourceRefs] })
  }
  return [...byMembers.values()]
}
